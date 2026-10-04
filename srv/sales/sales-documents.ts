import { Readable } from "node:stream";

import { renderSalesInvoicePdf, SalesInvoicePdfData } from "../core/invoice-pdf";
import { supplyKind } from "../core/invoice-pdf-labels";
import { calculateInvoice } from "../core/money";
import { getCompany, getCompanyLogo } from "../core/settings";
import { requireOrganization } from "../organizations/organization-context";

/**
 * Loads sales invoices and quotes with everything printed on them (items, taxes, customer,
 * seller, logo), always within the current organization, and renders them as PDF.
 */
export type DocumentData = SalesInvoicePdfData;

const service = "SalesService";

export async function loadInvoiceDocument(id: string, active = true): Promise<DocumentData | undefined> {
	const suffix = active ? "" : ".drafts";
	const invoice = (await SELECT.one
		.from(`${service}.SalesInvoices${suffix}`)
		.where({ ID: id, organization_ID: requireOrganization() })) as DocumentData["invoice"] | undefined;
	if (!invoice) {
		return undefined;
	}
	const byInvoice = { invoice_ID: id };
	invoice.items = await SELECT.from(`${service}.SalesInvoiceItems${suffix}`).where(byInvoice).orderBy("position");
	invoice.taxes = await SELECT.from(`${service}.SalesInvoiceTaxes${suffix}`).where(byInvoice);
	invoice.customer = await loadCustomer(invoice.customer_ID);
	invoice.supplyKind = await supplyKindOf(invoice.items as { productService_ID?: null | string }[]);
	return {
		company: (await getCompany()) as DocumentData["company"],
		invoice,
		logo: await toBuffer(await getCompanyLogo()),
	};
}

/** A quote is printed with the same layout; its tax lines are calculated from the items. */
export async function loadQuoteDocument(id: string, active = true): Promise<DocumentData | undefined> {
	const suffix = active ? "" : ".drafts";
	const quote = await SELECT.one
		.from(`${service}.Quotes${suffix}`)
		.where({ ID: id, organization_ID: requireOrganization() });
	if (!quote) {
		return undefined;
	}
	const items = await SELECT.from(`${service}.QuoteItems${suffix}`).where({ quote_ID: id }).orderBy("position");
	const invoice: DocumentData["invoice"] = {
		...quote,
		dueDate: quote.validUntil,
		invoiceDate: quote.quoteDate,
		invoiceNumber: quote.quoteNumber,
		items,
		status_code: undefined,
		taxes: calculateInvoice(items).taxes,
	};
	invoice.customer = await loadCustomer(quote.customer_ID);
	return {
		company: (await getCompany()) as DocumentData["company"],
		invoice,
		kind: "quote",
		logo: await toBuffer(await getCompanyLogo()),
	};
}

export function pdfResponse(content: Buffer, filename: string, download: boolean) {
	return {
		$mediaContentDispositionType: download ? "attachment" : "inline",
		filename,
		mimetype: "application/pdf",
		value: Readable.from(content),
	};
}

export async function renderDocument(document: DocumentData): Promise<Buffer> {
	return renderSalesInvoicePdf(document);
}

export async function toBuffer(stream: unknown): Promise<Buffer | undefined> {
	if (!stream) {
		return undefined;
	}
	if (Buffer.isBuffer(stream)) {
		return stream;
	}
	const chunks: Buffer[] = [];
	for await (const chunk of stream as Readable) {
		chunks.push(Buffer.from(chunk));
	}
	return chunks.length ? Buffer.concat(chunks) : undefined;
}

async function loadCustomer(customerID: null | string | undefined) {
	const customer = await SELECT.one
		.from("swiver.Customers")
		.where({ ID: customerID ?? null, organization_ID: requireOrganization() });
	if (customer?.country_code) {
		customer.country = await SELECT.one
			.from("sap.common.Countries")
			.columns("name")
			.where({ code: customer.country_code });
	}
	return customer;
}

/** Goods, services or both, from the product types of the lines. */
async function supplyKindOf(items: { productService_ID?: null | string }[]) {
	const IDs = items.map((item) => item.productService_ID).filter(Boolean);
	const types = IDs.length
		? ((await SELECT.from("swiver.ProductServices")
				.columns("ID", "type_code")
				.where({ ID: { in: IDs }, organization_ID: requireOrganization() })) as { ID: string; type_code: string }[])
		: [];
	return supplyKind(items.map((item) => types.find((type) => type.ID === item.productService_ID)?.type_code));
}
