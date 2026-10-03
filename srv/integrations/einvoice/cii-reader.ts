import { XMLParser } from "fast-xml-parser";

import { ExtractedInvoice } from "./einvoice-types";

/**
 * Reads the header data of a Cross Industry Invoice (ZUGFeRD 2.x / Factur-X), any profile.
 * Purely structural: no guessing, values that are missing stay undefined.
 */
type Node = Record<string, unknown>;

const parser = new XMLParser({ ignoreAttributes: false, parseTagValue: false, removeNSPrefix: true });

export function readCii(xml: string): ExtractedInvoice {
	const root = (parser.parse(xml) as Node).CrossIndustryInvoice as Node | undefined;
	if (!root) {
		throw new Error("The XML is not a Cross Industry Invoice.");
	}
	const document = child(root, "ExchangedDocument");
	const transaction = child(root, "SupplyChainTradeTransaction");
	const seller = child(child(transaction, "ApplicableHeaderTradeAgreement"), "SellerTradeParty");
	const settlement = child(transaction, "ApplicableHeaderTradeSettlement");
	const totals = child(settlement, "SpecifiedTradeSettlementHeaderMonetarySummation");
	const registrations = list(seller?.SpecifiedTaxRegistration).map((entry) => child(entry, "ID"));
	const paymentMeans = list(settlement?.SpecifiedTradeSettlementPaymentMeans);
	const iban = paymentMeans
		.map((means) => text(child(means, "PayeePartyCreditorFinancialAccount")?.IBANID))
		.find(Boolean);
	const paymentTerms = list(settlement?.SpecifiedTradePaymentTerms);
	const taxTotal = list(totals?.TaxTotalAmount).map(text).find(Boolean);
	return clean({
		currency: text(settlement?.InvoiceCurrencyCode),
		dueDate: date(paymentTerms.map((terms) => child(terms, "DueDateDateTime")).find(Boolean)),
		grossAmount: amount(text(totals?.GrandTotalAmount)),
		iban: iban?.replace(/\s+/g, ""),
		invoiceDate: date(child(document, "IssueDateTime")),
		invoiceNumber: text(document?.ID),
		netAmount: amount(text(totals?.TaxBasisTotalAmount) ?? text(totals?.LineTotalAmount)),
		sellerName: text(seller?.Name),
		sellerTaxNumber: registrations.filter((id) => attribute(id, "schemeID") === "FC").map(text)[0],
		sellerVatId: registrations.filter((id) => attribute(id, "schemeID") === "VA").map(text)[0],
		taxAmount: amount(taxTotal),
	});
}

function amount(value?: string): string | undefined {
	return value === undefined || Number.isNaN(Number(value)) ? undefined : Number(value).toFixed(2);
}

function attribute(node: unknown, name: string): string | undefined {
	return node && typeof node === "object" ? ((node as Node)[`@_${name}`] as string | undefined) : undefined;
}

function child(node: unknown, name: string): Node | undefined {
	const value = node && typeof node === "object" ? (node as Node)[name] : undefined;
	return (Array.isArray(value) ? value[0] : value) as Node | undefined;
}

function clean(invoice: ExtractedInvoice): ExtractedInvoice {
	return Object.fromEntries(
		Object.entries(invoice).filter(([, value]) => value !== undefined && value !== ""),
	) as ExtractedInvoice;
}

/** Format 102 dates (YYYYMMDD) as ISO dates. */
function date(node: Node | undefined): string | undefined {
	const value = text(child(node, "DateTimeString"));
	const match = value?.match(/^(\d{4})(\d{2})(\d{2})/);
	return match ? `${match[1]}-${match[2]}-${match[3]}` : undefined;
}

function list(value: unknown): Node[] {
	if (value === undefined || value === null) {
		return [];
	}
	return (Array.isArray(value) ? value : [value]) as Node[];
}

function text(value: unknown): string | undefined {
	if (value === undefined || value === null) {
		return undefined;
	}
	if (typeof value === "object") {
		return text((value as Node)["#text"]);
	}
	return String(value).trim();
}
