import { EInvoiceContext, EInvoiceParty } from "./einvoice-types";

/**
 * Writes an EN 16931 invoice in the UN/CEFACT Cross Industry Invoice syntax, as embedded in
 * ZUGFeRD 2.x / Factur-X PDFs (profile EN 16931). The element order follows the CII schema.
 */
export const en16931Guideline = "urn:cen.eu:en16931:2017";

export function writeCii(invoice: EInvoiceContext): string {
	const lines = invoice.lines.map((line, index) =>
		el(
			"ram:IncludedSupplyChainTradeLineItem",
			el("ram:AssociatedDocumentLineDocument", el("ram:LineID", String(index + 1))),
			el("ram:SpecifiedTradeProduct", el("ram:Name", line.description)),
			el(
				"ram:SpecifiedLineTradeAgreement",
				el("ram:NetPriceProductTradePrice", el("ram:ChargeAmount", line.unitPrice)),
			),
			el("ram:SpecifiedLineTradeDelivery", el(`ram:BilledQuantity unitCode="${line.unitCode}"`, line.quantity)),
			el(
				"ram:SpecifiedLineTradeSettlement",
				el(
					"ram:ApplicableTradeTax",
					el("ram:TypeCode", "VAT"),
					el("ram:CategoryCode", vatCategory(line.vatRate)),
					el("ram:RateApplicablePercent", line.vatRate),
				),
				el("ram:SpecifiedTradeSettlementLineMonetarySummation", el("ram:LineTotalAmount", line.netAmount)),
			),
		),
	);
	const taxes = invoice.taxes.map((tax) =>
		el(
			"ram:ApplicableTradeTax",
			el("ram:CalculatedAmount", tax.taxAmount),
			el("ram:TypeCode", "VAT"),
			// TODO(feature): reverse charge, intra-community and exempt VAT categories with exemption reasons
			el("ram:BasisAmount", tax.netAmount),
			el("ram:CategoryCode", vatCategory(tax.vatRate)),
			el("ram:RateApplicablePercent", tax.vatRate),
		),
	);
	const paymentMeans = invoice.payment.iban
		? el(
				"ram:SpecifiedTradeSettlementPaymentMeans",
				el("ram:TypeCode", "58"),
				el("ram:PayeePartyCreditorFinancialAccount", el("ram:IBANID", compact(invoice.payment.iban))),
				invoice.payment.bic
					? el("ram:PayeeSpecifiedCreditorFinancialInstitution", el("ram:BICID", invoice.payment.bic))
					: "",
			)
		: el("ram:SpecifiedTradeSettlementPaymentMeans", el("ram:TypeCode", "1"));
	const period = invoice.servicePeriod ?? {};
	const document = el(
		'rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100" xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100" xmlns:qdt="urn:un:unece:uncefact:data:standard:QualifiedDataType:100" xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100"',
		el(
			"rsm:ExchangedDocumentContext",
			el("ram:GuidelineSpecifiedDocumentContextParameter", el("ram:ID", en16931Guideline)),
		),
		el(
			"rsm:ExchangedDocument",
			el("ram:ID", invoice.invoiceNumber),
			el("ram:TypeCode", invoice.precedingInvoiceNumber ? "384" : "380"),
			el("ram:IssueDateTime", date(invoice.invoiceDate)),
			invoice.note ? el("ram:IncludedNote", el("ram:Content", invoice.note)) : "",
		),
		el(
			"rsm:SupplyChainTradeTransaction",
			...lines,
			el(
				"ram:ApplicableHeaderTradeAgreement",
				party("ram:SellerTradeParty", invoice.seller),
				party("ram:BuyerTradeParty", invoice.buyer),
			),
			el(
				"ram:ApplicableHeaderTradeDelivery",
				el("ram:ActualDeliverySupplyChainEvent", el("ram:OccurrenceDateTime", date(invoice.invoiceDate))),
			),
			el(
				"ram:ApplicableHeaderTradeSettlement",
				invoice.payment.reference ? el("ram:PaymentReference", invoice.payment.reference) : "",
				el("ram:InvoiceCurrencyCode", invoice.currency),
				paymentMeans,
				...taxes,
				period.start || period.end
					? el(
							"ram:BillingSpecifiedPeriod",
							period.start ? el("ram:StartDateTime", date(period.start)) : "",
							period.end ? el("ram:EndDateTime", date(period.end)) : "",
						)
					: "",
				invoice.dueDate || invoice.payment.terms
					? el(
							"ram:SpecifiedTradePaymentTerms",
							invoice.payment.terms ? el("ram:Description", invoice.payment.terms) : "",
							invoice.dueDate ? el("ram:DueDateDateTime", date(invoice.dueDate)) : "",
						)
					: "",
				el(
					"ram:SpecifiedTradeSettlementHeaderMonetarySummation",
					el("ram:LineTotalAmount", invoice.netAmount),
					el("ram:TaxBasisTotalAmount", invoice.netAmount),
					el(`ram:TaxTotalAmount currencyID="${invoice.currency}"`, invoice.taxAmount),
					el("ram:GrandTotalAmount", invoice.grossAmount),
					el("ram:DuePayableAmount", invoice.grossAmount),
				),
				invoice.precedingInvoiceNumber
					? el("ram:InvoiceReferencedDocument", el("ram:IssuerAssignedID", invoice.precedingInvoiceNumber))
					: "",
			),
		),
	);
	return `<?xml version="1.0" encoding="UTF-8"?>\n${document}\n`;
}

function compact(value: string): string {
	return value.replace(/\s+/g, "");
}

function date(value: string): string {
	return el('udt:DateTimeString format="102"', value.slice(0, 10).replaceAll("-", ""));
}

/** An element with text content or child elements; empty children are left out. */
function el(tag: string, ...content: string[]): string {
	const name = tag.split(" ")[0];
	const children = content.filter((child) => child !== "");
	const isText = children.length === 1 && !children[0].startsWith("<");
	const body = isText ? escape(children[0]) : children.join("");
	return `<${tag}>${body}</${name}>`;
}

function escape(text: string): string {
	return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function party(tag: string, value: EInvoiceParty): string {
	return el(
		tag,
		el("ram:Name", value.name),
		el(
			"ram:PostalTradeAddress",
			value.postalCode ? el("ram:PostcodeCode", value.postalCode) : "",
			value.street ? el("ram:LineOne", value.street) : "",
			value.city ? el("ram:CityName", value.city) : "",
			el("ram:CountryID", value.countryCode),
		),
		value.email ? el("ram:URIUniversalCommunication", el('ram:URIID schemeID="EM"', value.email)) : "",
		value.vatId ? el("ram:SpecifiedTaxRegistration", el('ram:ID schemeID="VA"', compact(value.vatId))) : "",
		value.taxNumber ? el("ram:SpecifiedTaxRegistration", el('ram:ID schemeID="FC"', value.taxNumber)) : "",
	);
}

/** S = standard rate, Z = zero rated. */
function vatCategory(rate: string): string {
	return Number(rate) > 0 ? "S" : "Z";
}
