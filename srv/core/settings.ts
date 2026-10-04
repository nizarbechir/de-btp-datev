import { requireOrganization } from "../organizations/organization-context";

const CompanySettings = "swiver.CompanySettings";

export interface InvoiceDefaults {
	defaultCurrency_code: string;
	defaultPaymentTermDays: number;
	defaultTaxRate: number;
	invoicePrefix: string;
	quotePrefix: string;
}

const fallback: InvoiceDefaults = {
	defaultCurrency_code: "EUR",
	defaultPaymentTermDays: 14,
	defaultTaxRate: 19,
	invoicePrefix: "INV",
	quotePrefix: "QUO",
};

/** The full company settings of the current organization (seller details on documents). */
export async function getCompany(): Promise<Record<string, unknown> | undefined> {
	return SELECT.one.from(CompanySettings).where({ organization_ID: requireOrganization() });
}

/** The company logo of the current organization, if one is uploaded. */
export async function getCompanyLogo(): Promise<unknown> {
	const row = await SELECT.one.from(CompanySettings).columns("logo").where({ organization_ID: requireOrganization() });
	return row?.logo;
}

/** The defaults for new sales invoices and quotes of the current organization. */
export async function getCompanySettings(): Promise<InvoiceDefaults> {
	const settings = (await SELECT.one
		.from(CompanySettings)
		.columns("defaultCurrency_code", "defaultPaymentTermDays", "defaultTaxRate", "invoicePrefix", "quotePrefix")
		.where({ organization_ID: requireOrganization() })) as Partial<InvoiceDefaults> | undefined;
	return {
		defaultCurrency_code: settings?.defaultCurrency_code || fallback.defaultCurrency_code,
		defaultPaymentTermDays: Number(settings?.defaultPaymentTermDays ?? fallback.defaultPaymentTermDays),
		defaultTaxRate: Number(settings?.defaultTaxRate ?? fallback.defaultTaxRate),
		invoicePrefix: settings?.invoicePrefix || fallback.invoicePrefix,
		quotePrefix: settings?.quotePrefix || fallback.quotePrefix,
	};
}

/** Company details printed in the invoice footer; an invoice can only be issued when all are filled. */
const requiredFooterFields: Record<string, string> = {
	bankName: "bank name",
	bic: "BIC",
	city: "city",
	companyName: "company name",
	email: "e-mail",
	iban: "IBAN",
	postalCode: "postal code",
	street: "street",
	vatId: "VAT ID",
	website: "website",
};

/** The labels of the required footer fields that are still empty in Settings. */
export async function missingFooterFields(): Promise<string[]> {
	const settings = (await SELECT.one
		.from(CompanySettings)
		.columns(Object.keys(requiredFooterFields))
		.where({ organization_ID: requireOrganization() })) as Record<string, null | string> | undefined;
	return Object.entries(requiredFooterFields)
		.filter(([field]) => !settings?.[field]?.trim())
		.map(([, label]) => label);
}
