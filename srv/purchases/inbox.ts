import cds, { Request } from "@sap/cds";

import { requireOrganization } from "../organizations/organization-context";
import { assertOwned } from "../organizations/tenant-guard";
import { DomainError } from "../payments/payments";
import { toBuffer } from "../sales/sales-documents";
import { extractInvoice } from "./extraction";
import { findSupplier } from "./supplier-matching";

/**
 * Document inbox: supplier documents are uploaded first and turned into supplier invoices later.
 * The invoice data is read automatically (see ./extraction) and only proposed: the user checks it
 * in the create dialog. The supplier is matched where it is certain.
 */
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
	// Locked until the transaction ends: a second, parallel request waits and then finds it processed.
	const document = await SELECT.one.from(Documents).where({ ID: documentID, organization_ID }).forUpdate();
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

/** Detects the document type and reads the invoice data. Errors are kept on the document. */
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
	const { data, documentType, failed, message } = await extractInvoice({ content, mediaType: document.mediaType });
	const supplierID = await findSupplier({
		iban: data.iban,
		name: data.sellerName,
		taxNumber: data.sellerTaxNumber,
		vatId: data.sellerVatId,
	});
	const recognized = Object.keys(data).length > 0;
	await UPDATE(Documents, documentID).with({
		detectedDocumentType: documentType,
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
		processingMessage: !recognized
			? message
			: supplierID
				? `${message} Supplier recognized. Check the data and create the supplier invoice.`
				: `${message} Choose the supplier or enter a new supplier name, then create the supplier invoice.`,
		processingStatus_code: failed ? "ERROR" : "NEW",
	});
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
