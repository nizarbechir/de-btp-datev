import { requireOrganization } from "../organizations/organization-context";
import { toBuffer } from "../sales/sales-documents";
import { extractInvoice } from "./extraction";
import { findSupplier } from "./supplier-matching";

/**
 * When a document is uploaded to a supplier invoice draft, its invoice data fills the fields that
 * are still empty. The draft is only a proposal: the user checks it and saves it.
 */
const InvoiceDrafts = "PurchasingService.SupplierInvoices.drafts";

export async function prefillInvoiceDraft(invoiceID: string): Promise<void> {
	const draft = await SELECT.one
		.from(InvoiceDrafts)
		.columns(
			"currency_code",
			"documentContent",
			"documentMediaType",
			"dueDate",
			"invoiceDate",
			"invoiceNumber",
			"netAmount",
			"supplier_ID",
			"taxAmount",
		)
		.where({ ID: invoiceID, organization_ID: requireOrganization() });
	const content = draft && (await toBuffer(draft.documentContent));
	if (!content || !draft.documentMediaType) {
		return;
	}
	const { data } = await extractInvoice({ content, mediaType: draft.documentMediaType });
	if (!Object.keys(data).length) {
		return;
	}
	const isEmpty = (value: unknown) => value === null || value === undefined || value === "";
	const amountsEmpty = isEmpty(draft.netAmount);
	const changes: Record<string, unknown> = {};
	const propose = (field: string, value: unknown, empty = isEmpty(draft[field])) => {
		if (empty && !isEmpty(value)) {
			changes[field] = value;
		}
	};
	propose(
		"supplier_ID",
		isEmpty(draft.supplier_ID)
			? await findSupplier({
					iban: data.iban,
					name: data.sellerName,
					taxNumber: data.sellerTaxNumber,
					vatId: data.sellerVatId,
				})
			: undefined,
	);
	propose("invoiceNumber", data.invoiceNumber);
	propose("invoiceDate", data.invoiceDate);
	propose("dueDate", data.dueDate);
	// Currency and tax have defaults, so they follow the document as long as no amount is entered
	propose("currency_code", data.currency, amountsEmpty);
	propose("netAmount", data.netAmount);
	propose("taxAmount", data.taxAmount, amountsEmpty);
	if (Object.keys(changes).length) {
		await UPDATE(InvoiceDrafts, invoiceID).with(changes);
	}
}
