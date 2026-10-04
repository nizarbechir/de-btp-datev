import cds from "@sap/cds";

import { registerChangeHistoryGuard } from "../authorization/change-history-guard";
import { registerReadOnlyFlag } from "../authorization/read-only-flag";
import { auditActions } from "../collaboration/audit";
import { registerComments } from "../collaboration/comments";
import { invoiceDocumentTypes, validateUpload } from "../core/document-upload";
import { boundID, guardedSubject, rejectDomainError } from "../core/requests";
import { requireOrganization } from "../organizations/organization-context";
import { registerTenantGuard } from "../organizations/tenant-guard";
import { recordPayment, refreshInvoicePayments, removeManualPayments } from "../payments/payments";
import { bookGoodsReceipt, registerSupplierInvoiceItems } from "../purchases/goods-receipt";
import { createSupplierInvoice, processDocument } from "../purchases/inbox";
import { prefillInvoiceDraft } from "../purchases/supplier-invoice-prefill";

/**
 * Money out: suppliers, supplier invoices with their payments, the document inbox and expense categories.
 */

export default class PurchasingService extends cds.ApplicationService {
	async init() {
		const { IncomingDocuments, SupplierInvoiceItems, SupplierInvoices } = this.entities as Record<
			string,
			cds.entity & { drafts: cds.entity }
		>;
		registerTenantGuard(this);
		registerChangeHistoryGuard(this);
		registerReadOnlyFlag(this);
		registerComments(this, { IncomingDocuments: "incomingDocument", SupplierInvoices: "supplierInvoice" });
		auditActions(this, {
			SupplierInvoiceItems: ["receiveGoods"],
			SupplierInvoices: ["markInvoicePaid", "markInvoiceOpen", "recordPayment", "bookGoodsReceipt"],
		});
		registerSupplierInvoiceItems(this);

		this.before(["CREATE", "UPDATE"], [SupplierInvoices, SupplierInvoices.drafts], (req) =>
			validateUpload(req, {
				allowed: invoiceDocumentTypes,
				content: "documentContent",
				fileName: "documentFileName",
				mediaType: "documentMediaType",
			}),
		);
		this.before(["CREATE", "UPDATE"], [IncomingDocuments, IncomingDocuments.drafts], (req) =>
			validateUpload(req, {
				allowed: invoiceDocumentTypes,
				content: "content",
				fileName: "originalFileName",
				mediaType: "mediaType",
			}),
		);
		this.before(["CREATE", "UPDATE"], SupplierInvoices, (req) => {
			// Payment fields follow from the payments
			delete req.data.paymentStatus_code;
			delete req.data.paymentDate;
			delete req.data.paidAmount;
		});

		// Changed amounts of a saved invoice change its payment status (e.g. a corrected total after a payment)
		this.after("UPDATE", SupplierInvoices, async (_result, req) => {
			const ID = (req.data as { ID?: string }).ID ?? boundID(req);
			if (ID && ("netAmount" in req.data || "taxAmount" in req.data)) {
				await refreshInvoicePayments("supplier", ID);
			}
		});

		// Payments
		this.on("markInvoicePaid", SupplierInvoices, (req) =>
			guardedSubject(req, () => recordPayment({ invoiceID: boundID(req), kind: "supplier" })),
		);
		this.on("recordPayment", SupplierInvoices, (req) => {
			const { amount, paymentDate, reference } = req.data;
			return guardedSubject(req, () =>
				recordPayment({ amount, invoiceID: boundID(req), kind: "supplier", paymentDate, reference }),
			);
		});
		this.on("markInvoiceOpen", SupplierInvoices, (req) =>
			guardedSubject(req, () => removeManualPayments("supplier", boundID(req))),
		);

		// Goods receipt: of all open items, or of a part of one item
		this.on("bookGoodsReceipt", SupplierInvoices, (req) =>
			guardedSubject(req, async () => {
				if (!(await bookGoodsReceipt(boundID(req)))) {
					req.info("NOTHING_TO_RECEIVE");
				}
			}),
		);
		this.on("receiveGoods", SupplierInvoiceItems, async (req) => {
			const item = await SELECT.one
				.from("swiver.SupplierInvoiceItems")
				.columns("supplierInvoice_ID")
				.where({ ID: boundID(req) });
			if (!item) {
				return req.reject(404, "RECORD_NOT_FOUND");
			}
			return guardedSubject(req, () => bookGoodsReceipt(item.supplierInvoice_ID, boundID(req), req.data.quantity));
		});

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
			const ID = (req.data as { ID?: string }).ID ?? boundID(req);
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
			await processDocument(boundID(req));
			return SELECT.one.from(req.subject);
		});
		this.on("createSupplierInvoice", IncomingDocuments, async (req) => {
			try {
				const invoiceID = await createSupplierInvoice(req, boundID(req), req.data);
				return SELECT.one.from(SupplierInvoices).where({ ID: invoiceID });
			} catch (error) {
				return rejectDomainError(req, error);
			}
		});
		this.before("uploadDocument", (req) =>
			validateUpload(req, {
				allowed: invoiceDocumentTypes,
				content: "content",
				fileName: "fileName",
				mediaType: "mediaType",
			}),
		);
		this.on("uploadDocument", async (req) => {
			const { content, fileName, mediaType } = req.data as Record<string, unknown>;
			if (!content) {
				return req.reject(400, "DOCUMENT_MISSING");
			}
			const ID = cds.utils.uuid();
			await INSERT.into("swiver.IncomingDocuments").entries({
				content,
				ID,
				mediaType,
				organization_ID: requireOrganization(req),
				originalFileName: fileName,
			});
			await processDocument(ID);
			return SELECT.one
				.from(IncomingDocuments)
				.columns("ID", "originalFileName", "processingStatus_code")
				.where({ ID });
		});
		this.on("ignore", IncomingDocuments, async (req) => {
			await UPDATE("swiver.IncomingDocuments", boundID(req)).with({ processingStatus_code: "IGNORED" });
			return SELECT.one.from(req.subject);
		});
		return super.init();
	}
}
