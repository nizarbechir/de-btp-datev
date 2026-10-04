import cds, { Request } from "@sap/cds";

import { addDays, isoDate } from "../core/dates";
import { renderSalesInvoicePdf } from "../core/invoice-pdf";
import { nextQuoteNumber } from "../core/numbering";
import { boundID, boundKey, DomainError, guarded } from "../core/requests";
import { getCompanySettings } from "../core/settings";
import { requireOrganization } from "../organizations/organization-context";
import { sendQuote } from "./document-emails";
import { applyTotals, DocumentConfig, recalculateDraft, registerItemCalculation } from "./document-items";
import { DocumentData, loadQuoteDocument, pdfResponse } from "./sales-documents";
import { invoiceDocument } from "./sales-invoices";

/**
 * Quotes: same item and total rules as sales invoices, own numbering and statuses
 * (DRAFT → SENT → ACCEPTED / REJECTED; expired is derived from the validity date),
 * and conversion of an accepted quote into a draft sales invoice.
 */
const Quotes = "SalesService.Quotes";
const QuoteDrafts = "SalesService.Quotes.drafts";
const QuoteItems = "SalesService.QuoteItems";
const quoteValidityDays = 30;

const quoteDocument: DocumentConfig = {
	documentDrafts: QuoteDrafts,
	itemDrafts: "SalesService.QuoteItems.drafts",
	itemKey: "quote_ID",
};

type Data = Record<string, unknown>;

const transitions: Record<string, { from: string[]; to: string }> = {
	accept: { from: ["DRAFT", "SENT"], to: "ACCEPTED" },
	markAsSent: { from: ["DRAFT", "SENT"], to: "SENT" },
	rejectQuote: { from: ["DRAFT", "SENT"], to: "REJECTED" },
};

const backendFields = ["quoteNumber", "status_code", "convertedInvoice_ID", "sentAt", "sentTo"] as const;

/**
 * Creates a draft sales invoice with the quote's customer, currency, texts and items, dated today
 * with the company's payment terms. A quote is only converted once, unless forced.
 */
export async function convertQuote(srv: cds.ApplicationService, quoteID: string, force = false) {
	const quote = await requireQuote({ ID: quoteID });
	if (quote.convertedInvoice_ID && !force) {
		throw new DomainError("QUOTE_ALREADY_CONVERTED");
	}
	if (quote.status_code === "REJECTED") {
		throw new DomainError("QUOTE_REJECTED");
	}
	const source = await SELECT.one
		.from(Quotes)
		.columns("customer_ID", "currency_code", "subject", "introductionText", "footerText")
		.where({ ID: quote.ID });
	const items = await SELECT.from(QuoteItems)
		.columns("position", "description", "quantity", "unit", "unitPrice", "taxRate", "productService_ID")
		.where({ quote_ID: quote.ID })
		.orderBy("position");
	const invoiceID = cds.utils.uuid();
	await srv.send("NEW", invoiceDocument.documentDrafts, {
		...source,
		ID: invoiceID,
		items: items.map((item: Data) => ({ ...item, ID: cds.utils.uuid() })),
	});
	await recalculateDraft(invoiceDocument, invoiceID);
	await UPDATE(invoiceDocument.documentDrafts).set({ quote_ID: quote.ID }).where({ ID: invoiceID });
	await UPDATE(Quotes).set({ convertedInvoice_ID: invoiceID, status_code: "ACCEPTED" }).where({ ID: quote.ID });
	return SELECT.one.from(invoiceDocument.documentDrafts).where({ ID: invoiceID });
}

export function registerQuotes(srv: cds.ApplicationService) {
	srv.before("NEW", QuoteDrafts, async (req) => {
		const settings = await getCompanySettings();
		const data = req.data as Data;
		const quoteDate = (data.quoteDate as string | undefined) ?? isoDate(new Date());
		data.quoteDate = quoteDate;
		data.validUntil ??= isoDate(addDays(new Date(quoteDate), quoteValidityDays));
		data.currency_code ??= settings.defaultCurrency_code;
		data.status_code = "DRAFT";
	});
	srv.before("NEW", quoteDocument.itemDrafts, async (req) => {
		req.data.taxRate ??= (await getCompanySettings()).defaultTaxRate;
	});
	registerItemCalculation(srv, quoteDocument.itemDrafts, quoteDocument);

	srv.before(["CREATE", "UPDATE"], Quotes, async (req) => {
		const data = req.data as Data;
		for (const field of backendFields) {
			Reflect.deleteProperty(data, field);
		}
		if (req.event === "CREATE") {
			data.status_code = "DRAFT";
		}
		if (!applyTotals(req, false, "QUOTE_WITHOUT_ITEMS")) {
			return;
		}
		if (req.event === "CREATE") {
			const { quotePrefix } = await getCompanySettings();
			data.quoteNumber = await nextQuoteNumber(quotePrefix, String(data.quoteDate));
		}
	});
	srv.before("EDIT", Quotes, async (req) => {
		const quote = await loadQuote(boundKey(req));
		if (quote && !["DRAFT", "SENT"].includes(quote.status_code)) {
			return req.reject(409, "QUOTE_CLOSED");
		}
	});

	for (const action of Object.keys(transitions)) {
		srv.on(action, Quotes, (req) => guarded(req, () => changeStatus(req, action)));
	}
	srv.on("convertToInvoice", Quotes, (req) =>
		guarded(req, () => convertQuote(srv, boundID(req), Boolean(req.data.force))),
	);
	srv.on("sendByEmail", Quotes, (req) => guarded(req, () => sendByEmail(req)));
	srv.on("pdf", [Quotes, QuoteDrafts], (req) => pdf(req));
}

async function changeStatus(req: Request, action: string) {
	const quote = await requireQuote(boundKey(req));
	const { from, to } = transitions[action];
	if (!from.includes(quote.status_code)) {
		throw new DomainError("QUOTE_STATUS_CHANGE_NOT_ALLOWED");
	}
	await UPDATE(Quotes).set({ status_code: to }).where({ ID: quote.ID });
	return SELECT.one.from(Quotes).where({ ID: quote.ID });
}

async function loadQuote({ ID: id }: { ID: string }) {
	return SELECT.one
		.from(Quotes)
		.columns("ID", "status_code", "convertedInvoice_ID", "HasDraftEntity")
		.where({ ID: id, organization_ID: requireOrganization() }) as unknown as Promise<null | {
		convertedInvoice_ID: null | string;
		HasDraftEntity: boolean;
		ID: string;
		status_code: string;
	}>;
}

async function pdf(req: Request) {
	const { ID, IsActiveEntity } = boundKey(req);
	const active = IsActiveEntity === undefined || IsActiveEntity === true || IsActiveEntity === "true";
	const document = await loadQuoteDocument(ID, active);
	if (!document) {
		return req.reject(404, "QUOTE_NOT_FOUND");
	}
	const content = await renderSalesInvoicePdf(document);
	return pdfResponse(content, `${document.invoice.invoiceNumber ?? "Quote-Draft"}.pdf`, Boolean(req.data.download));
}

async function requireQuote(quoteKey: { ID: string }) {
	const quote = await loadQuote(quoteKey);
	if (!quote) {
		throw new DomainError("QUOTE_NOT_FOUND", 404);
	}
	if (quote.HasDraftEntity) {
		throw new DomainError("QUOTE_BEING_EDITED");
	}
	return quote;
}

async function sendByEmail(req: Request) {
	const quote = await requireQuote(boundKey(req));
	if (!["ACCEPTED", "DRAFT", "SENT"].includes(quote.status_code)) {
		throw new DomainError("QUOTE_STATUS_CHANGE_NOT_ALLOWED");
	}
	const document = (await loadQuoteDocument(quote.ID)) as DocumentData;
	const customer = document.invoice.customer as (Data & { email?: string }) | undefined;
	const recipient = (req.data.recipient as string | undefined)?.trim() || customer?.email;
	if (!recipient) {
		throw new DomainError("RECIPIENT_MISSING", 400);
	}
	const number = document.invoice.invoiceNumber ?? "Quote";
	const sent = await sendQuote(
		{
			attachment: {
				content: await renderSalesInvoicePdf(document),
				contentType: "application/pdf",
				name: `${number}.pdf`,
			},
			currency: document.invoice.currency_code || "EUR",
			customerName: String(customer?.name || customer?.companyName || "Sir or Madam"),
			dueDate: document.invoice.dueDate,
			grossAmount: document.invoice.grossAmount,
			invoiceDate: document.invoice.invoiceDate,
			number: String(number),
		},
		{ message: req.data.message, recipient, subject: req.data.subject },
	);
	const status = quote.status_code === "DRAFT" ? "SENT" : quote.status_code;
	await UPDATE(Quotes).set({ sentAt: sent.sentAt, sentTo: recipient, status_code: status }).where({ ID: quote.ID });
	return SELECT.one.from(Quotes).where({ ID: quote.ID });
}
