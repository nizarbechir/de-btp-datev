import cds, { Request } from "@sap/cds";

import { extract } from "../integrations/einvoice/zugferd";
import { requireOrganization } from "../organizations/organization-context";
import { assertOwned } from "../organizations/tenant-guard";
import { DomainError } from "../payments/payments";
import { toBuffer } from "../sales/sales-documents";
import { findSupplier } from "./supplier-matching";

/**
 * Document inbox: supplier documents are uploaded first and turned into supplier invoices later.
 * ZUGFeRD PDFs are read automatically and the supplier is matched where it is certain.
 */
// TODO(feature): Add OCR extraction
// TODO(feature): external document storage/object storage if needed at scale
const Documents = "swiver.IncomingDocuments";

export interface SupplierInvoiceInput {
	dueDate?: null | string;
	expenseCategory?: null | string;
	invoiceDate?: null | string;
	invoiceNumber?: null | string;
	netAmount?: null | number | string;
	newSupplierName?: null | string;
	supplier?: null | string;
	taxAmount?: null | number | string;
}

/**
 * Creates the supplier invoice from the document: the values entered by the user win over the
 * extracted ones. The document file moves to the supplier invoice, so it is stored only once.
 */
export async function createSupplierInvoice(
	req: Request,
	documentID: string,
	input: SupplierInvoiceInput,
): Promise<string> {
	const organization_ID = requireOrganization(req);
	const document = await SELECT.one.from(Documents).where({ ID: documentID, organization_ID });
	if (!document) {
		throw new DomainError("DOCUMENT_NOT_FOUND", 404);
	}
	if (document.processingStatus_code === "PROCESSED") {
		throw new DomainError("DOCUMENT_ALREADY_PROCESSED");
	}
	await assertOwned(req, "swiver.Suppliers", input.supplier, "REFERENCE_OTHER_ORGANIZATION");
	await assertOwned(req, "swiver.ExpenseCategories", input.expenseCategory, "REFERENCE_OTHER_ORGANIZATION");
	const supplierID =
		input.supplier ||
		(!input.newSupplierName && document.extractedSupplier_ID) ||
		(await createSupplier(document, input.newSupplierName));
	const invoiceNumber = input.invoiceNumber || document.extractedInvoiceNumber;
	const invoiceDate = input.invoiceDate || document.extractedInvoiceDate;
	const netAmount = input.netAmount ?? document.extractedNetAmount;
	if (!invoiceNumber || !invoiceDate || netAmount === null || netAmount === undefined) {
		throw new DomainError("INVOICE_DATA_MISSING", 400);
	}
	if (
		await SELECT.one
			.from("swiver.SupplierInvoices")
			.columns("ID")
			.where({ invoiceNumber, organization_ID, supplier_ID: supplierID })
	) {
		throw new DomainError("SUPPLIER_INVOICE_EXISTS");
	}
	const content = await SELECT.one.from(Documents).columns("content").where({ ID: documentID });
	const invoiceID = cds.utils.uuid();
	await INSERT.into("swiver.SupplierInvoices").entries({
		currency_code: document.extractedCurrency_code || "EUR",
		documentContent: await toBuffer(content?.content),
		documentFileName: document.originalFileName,
		documentMediaType: document.mediaType,
		dueDate: input.dueDate || document.extractedDueDate || null,
		expenseCategory_ID: input.expenseCategory || null,
		ID: invoiceID,
		incomingDocument_ID: documentID,
		invoiceDate,
		invoiceNumber,
		netAmount: String(netAmount),
		organization_ID,
		paymentStatus_code: "OPEN",
		supplier_ID: supplierID,
		taxAmount: String(input.taxAmount ?? document.extractedTaxAmount ?? 0),
	});
	await UPDATE(Documents, documentID).with({
		content: null,
		linkedSupplierInvoice_ID: invoiceID,
		processingMessage: "Supplier invoice created; the document is stored with the invoice.",
		processingStatus_code: "PROCESSED",
	});
	return invoiceID;
}

/** Detects the document type and reads an embedded e-invoice. Errors are kept on the document. */
export async function processDocument(documentID: string): Promise<void> {
	const document = await SELECT.one
		.from(Documents)
		.columns("ID", "mediaType", "processingStatus_code", "content")
		.where({ ID: documentID, organization_ID: requireOrganization() });
	if (!document || document.processingStatus_code === "PROCESSED") {
		return;
	}
	const content = await toBuffer(document.content);
	if (!content) {
		await UPDATE(Documents, documentID).with({
			processingMessage: "Upload the document file.",
			processingStatus_code: "NEW",
		});
		return;
	}
	if (document.mediaType !== "application/pdf") {
		await UPDATE(Documents, documentID).with({
			detectedDocumentType: "IMAGE",
			processingMessage: "Enter the invoice data.",
		});
		return;
	}
	try {
		const einvoice = await extract(content);
		if (!einvoice) {
			await UPDATE(Documents, documentID).with({
				detectedDocumentType: "PDF",
				processingMessage: "Enter the invoice data.",
			});
			return;
		}
		const { data } = einvoice;
		const supplierID = await findSupplier({
			iban: data.iban,
			name: data.sellerName,
			taxNumber: data.sellerTaxNumber,
			vatId: data.sellerVatId,
		});
		await UPDATE(Documents, documentID).with({
			detectedDocumentType: "ZUGFERD",
			extractedCurrency_code: data.currency ?? null,
			extractedDueDate: data.dueDate ?? null,
			extractedGrossAmount: data.grossAmount ?? null,
			extractedIBAN: data.iban ?? null,
			extractedInvoiceDate: data.invoiceDate ?? null,
			extractedInvoiceNumber: data.invoiceNumber ?? null,
			extractedNetAmount: data.netAmount ?? null,
			extractedSupplier_ID: supplierID ?? null,
			extractedSupplierName: data.sellerName ?? null,
			extractedTaxAmount: data.taxAmount ?? null,
			extractedVatId: data.sellerVatId ?? null,
			processingMessage: supplierID
				? "E-invoice read and supplier recognized. Check the data and create the supplier invoice."
				: "E-invoice read. Choose the supplier or enter a new supplier name, then create the supplier invoice.",
			processingStatus_code: "NEW",
		});
	} catch (error) {
		cds.log("inbox").warn("Could not read the e-invoice", error);
		await UPDATE(Documents, documentID).with({
			detectedDocumentType: "PDF",
			processingMessage: "The embedded e-invoice could not be read. Enter the invoice data.",
			processingStatus_code: "ERROR",
		});
	}
}

async function createSupplier(document: Record<string, unknown>, newSupplierName?: null | string): Promise<string> {
	const name = newSupplierName?.trim() || (document.extractedSupplierName as null | string);
	if (!name) {
		throw new DomainError("SUPPLIER_REQUIRED", 400);
	}
	const ID = cds.utils.uuid();
	await INSERT.into("swiver.Suppliers").entries({
		iban: document.extractedIBAN ?? null,
		ID,
		name,
		organization_ID: requireOrganization(),
		vatId: document.extractedVatId ?? null,
	});
	return ID;
}
