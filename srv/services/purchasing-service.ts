import cds, { Request } from "@sap/cds";

import { registerTenantGuard } from "../organizations/tenant-guard";
import { recordPayment, rejectDomainError, removeManualPayments } from "../payments/payments";
import { createSupplierInvoice, processDocument } from "../purchases/inbox";
import { prefillInvoiceDraft } from "../purchases/supplier-invoice-prefill";

/**
 * Money out: suppliers, supplier invoices with their payments, the document inbox and expense categories.
 */
const documentMediaTypes = ["application/pdf", "image/png", "image/jpeg"];

export default class PurchasingService extends cds.ApplicationService {
	async init() {
		const { IncomingDocuments, SupplierInvoices } = this.entities as Record<
			string,
			cds.entity & { drafts: cds.entity }
		>;
		registerTenantGuard(this);

		this.before("UPDATE", [SupplierInvoices, SupplierInvoices.drafts], (req) =>
			checkMediaType(req, "documentMediaType", "documentContent"),
		);
		this.before("UPDATE", [IncomingDocuments, IncomingDocuments.drafts], (req) =>
			checkMediaType(req, "mediaType", "content"),
		);
		this.before(["CREATE", "UPDATE"], SupplierInvoices, (req) => {
			// Payment fields follow from the payments
			delete req.data.paymentStatus_code;
			delete req.data.paymentDate;
			delete req.data.paidAmount;
		});

		// Payments
		this.on("markInvoicePaid", SupplierInvoices, (req) =>
			guarded(req, () => recordPayment({ invoiceID: key(req), kind: "supplier" })),
		);
		this.on("recordPayment", SupplierInvoices, (req) => {
			const { amount, paymentDate, reference } = req.data;
			return guarded(req, () =>
				recordPayment({ amount, invoiceID: key(req), kind: "supplier", paymentDate, reference }),
			);
		});
		this.on("markInvoiceOpen", SupplierInvoices, (req) =>
			guarded(req, () => removeManualPayments("supplier", key(req))),
		);

		// Explains the upload while editing
		this.after("READ", [SupplierInvoices, SupplierInvoices.drafts], (result, req) => {
			const hint = cds.i18n.labels.at("SupplierInvoiceDocumentHint", req.locale);
			for (const row of (Array.isArray(result) ? result : [result]) as { documentHint?: string }[]) {
				if (row) {
					row.documentHint = hint;
				}
			}
		});

		// An uploaded invoice document proposes the invoice data in the draft
		this.after("UPDATE", SupplierInvoices.drafts, async (_result, req) => {
			const ID = (req.data as { ID?: string }).ID ?? key(req);
			if (ID && "documentContent" in req.data) {
				await prefillInvoiceDraft(ID);
			}
		});

		// Inbox: read the document after every save, and on request
		this.after(["CREATE", "UPDATE"], IncomingDocuments, async (_result, req) => {
			const ID = (req.data as { ID?: string }).ID;
			if (ID) {
				await processDocument(ID);
			}
		});
		this.on("process", IncomingDocuments, async (req) => {
			await processDocument(key(req));
			return SELECT.one.from(req.subject);
		});
		this.on("createSupplierInvoice", IncomingDocuments, async (req) => {
			try {
				const invoiceID = await createSupplierInvoice(req, key(req), req.data);
				return SELECT.one.from(SupplierInvoices).where({ ID: invoiceID });
			} catch (error) {
				return rejectDomainError(req, error);
			}
		});
		this.on("ignore", IncomingDocuments, async (req) => {
			await UPDATE("swiver.IncomingDocuments", key(req)).with({ processingStatus_code: "IGNORED" });
			return SELECT.one.from(req.subject);
		});
		return super.init();
	}
}

function checkMediaType(req: Request, mediaTypeField: string, contentField: string) {
	const mediaType = req.data[mediaTypeField];
	if (mediaType && !documentMediaTypes.includes(mediaType)) {
		req.reject(415, "UNSUPPORTED_DOCUMENT_TYPE", contentField, [mediaType]);
	}
}

async function guarded(req: Request, operation: () => Promise<unknown>) {
	try {
		await operation();
		return await SELECT.one.from(req.subject);
	} catch (error) {
		return rejectDomainError(req, error);
	}
}

function key(req: Request): string {
	const value = req.params.at(-1);
	return (typeof value === "object" ? (value as { ID: string }).ID : value) as string;
}
