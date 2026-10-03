/**
 * Texts and number/date formats of the invoice PDF. A document is printed in exactly one
 * language, chosen in the company settings (German by default).
 */
export type DocumentLanguage = "de" | "en";

export interface PdfLabels {
	amount: string;
	assignedWhenSaved: string;
	cancelled: string;
	customerNumber: string;
	customerVatId: string;
	description: string;
	documentDate: { invoice: string; quote: string };
	documentNumber: { invoice: string; quote: string };
	documentTitle: { invoice: string; quote: string };
	draft: string;
	dueDate: { invoice: string; quote: string };
	locale: string;
	managingDirectors: string;
	netAmount: string;
	page: (current: number, total: number) => string;
	paid: string;
	paidOn: (date: string) => string;
	payBy: (amount: string, date: string) => string;
	payment: string;
	paymentReference: (reference: string) => string;
	position: string;
	quantity: string;
	quoteValidUntil: (date: string) => string;
	serviceDate: string;
	servicePeriod: string;
	taxNumber: string;
	total: string;
	unit: string;
	unitPrice: string;
	units: Record<string, string>;
	vat: string;
	vatId: string;
	vatOn: (rate: string, base: string) => string;
}

const german: PdfLabels = {
	amount: "Betrag",
	assignedWhenSaved: "Wird beim Speichern vergeben",
	cancelled: "STORNIERT",
	customerNumber: "Kundennummer",
	customerVatId: "USt-IdNr. Kunde",
	description: "Beschreibung",
	documentDate: { invoice: "Rechnungsdatum", quote: "Angebotsdatum" },
	documentNumber: { invoice: "Rechnungsnummer", quote: "Angebotsnummer" },
	documentTitle: { invoice: "Rechnung", quote: "Angebot" },
	draft: "Entwurf",
	dueDate: { invoice: "Fällig am", quote: "Gültig bis" },
	locale: "de-DE",
	managingDirectors: "Geschäftsführer",
	netAmount: "Nettobetrag",
	page: (current, total) => `Seite ${current} von ${total}`,
	paid: "BEZAHLT",
	paidOn: (date) => `Bezahlt am ${date}. Vielen Dank!`,
	payBy: (amount, date) => `Bitte überweisen Sie ${amount} bis zum ${date}.`,
	payment: "Zahlung",
	paymentReference: (reference) => ` Bitte geben Sie ${reference} als Verwendungszweck an.`,
	position: "Pos.",
	quantity: "Menge",
	quoteValidUntil: (date) => `Dieses Angebot ist gültig bis ${date}.`,
	serviceDate: "Leistungsdatum",
	servicePeriod: "Leistungszeitraum",
	taxNumber: "Steuernummer",
	total: "Gesamtbetrag",
	unit: "Einheit",
	unitPrice: "Einzelpreis",
	units: {
		day: "Tag",
		// eslint-disable-next-line @typescript-eslint/naming-convention -- unit names as entered by users
		"flat rate": "pauschal",
		hour: "Std.",
		license: "Lizenz",
		month: "Monat",
		piece: "Stk.",
	},
	vat: "USt.",
	vatId: "USt-IdNr.",
	vatOn: (rate, base) => `USt. ${rate} % auf ${base}`,
};

const english: PdfLabels = {
	amount: "Amount",
	assignedWhenSaved: "Assigned when saved",
	cancelled: "CANCELLED",
	customerNumber: "Customer number",
	customerVatId: "Customer VAT ID",
	description: "Description",
	documentDate: { invoice: "Invoice date", quote: "Quote date" },
	documentNumber: { invoice: "Invoice number", quote: "Quote number" },
	documentTitle: { invoice: "Invoice", quote: "Quote" },
	draft: "draft",
	dueDate: { invoice: "Due date", quote: "Valid until" },
	locale: "en-GB",
	managingDirectors: "Managing directors",
	netAmount: "Net amount",
	page: (current, total) => `Page ${current} of ${total}`,
	paid: "PAID",
	paidOn: (date) => `Paid on ${date}. Thank you!`,
	payBy: (amount, date) => `Please transfer ${amount} by ${date}.`,
	payment: "Payment",
	paymentReference: (reference) => ` Please use ${reference} as the payment reference.`,
	position: "Pos.",
	quantity: "Qty",
	quoteValidUntil: (date) => `This quote is valid until ${date}.`,
	serviceDate: "Service date",
	servicePeriod: "Service period",
	taxNumber: "Tax number",
	total: "Total",
	unit: "Unit",
	unitPrice: "Price",
	units: {},
	vat: "VAT",
	vatId: "VAT ID",
	vatOn: (rate, base) => `VAT ${rate}% on ${base}`,
};

/** The labels for the language code of the company settings (DE or EN); German if unknown. */
export function labelsFor(languageCode?: null | string): PdfLabels {
	return languageCode?.toLowerCase() === "en" ? english : german;
}
