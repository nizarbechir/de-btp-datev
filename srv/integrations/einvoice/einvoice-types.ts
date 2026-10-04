export interface EInvoiceContext {
	buyer: EInvoiceParty;
	currency: string;
	dueDate?: null | string;
	grossAmount: string;
	invoiceDate: string;
	invoiceNumber: string;
	lines: EInvoiceLine[];
	netAmount: string;
	note?: null | string;
	payment: { bic?: null | string; iban?: null | string; reference?: null | string; terms?: null | string };
	/** Number of the invoice this one corrects (type code 384). */
	precedingInvoiceNumber?: null | string;
	seller: EInvoiceParty;
	/** Service period (BT-73/BT-74). */
	servicePeriod?: { end?: null | string; start?: null | string };
	taxAmount: string;
	taxes: EInvoiceTax[];
}

export interface EInvoiceLine {
	description: string;
	netAmount: string;
	quantity: string;
	/** UN/ECE recommendation 20 code, e.g. DAY, HUR, C62. */
	unitCode: string;
	unitPrice: string;
	vatRate: string;
}

/**
 * The data of an electronic invoice (EN 16931), independent of where it comes from.
 * Amounts are decimal strings with two decimals, dates ISO strings (YYYY-MM-DD).
 */
export interface EInvoiceParty {
	city?: null | string;
	countryCode: string;
	email?: null | string;
	name: string;
	postalCode?: null | string;
	street?: null | string;
	taxNumber?: null | string;
	vatId?: null | string;
}

export interface EInvoiceTax {
	netAmount: string;
	taxAmount: string;
	vatRate: string;
}

/** Header data read from a received e-invoice. */
export interface ExtractedInvoice {
	currency?: string;
	dueDate?: string;
	grossAmount?: string;
	iban?: string;
	invoiceDate?: string;
	invoiceNumber?: string;
	netAmount?: string;
	sellerName?: string;
	sellerTaxNumber?: string;
	sellerVatId?: string;
	taxAmount?: string;
}
