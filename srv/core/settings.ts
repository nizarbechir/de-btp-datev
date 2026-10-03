const CompanySettings = "swiver.CompanySettings";

export interface InvoiceDefaults {
	defaultCurrency_code: string;
	defaultPaymentTermDays: number;
	defaultTaxRate: number;
	invoicePrefix: string;
}

const fallback: InvoiceDefaults = {
	defaultCurrency_code: "EUR",
	defaultPaymentTermDays: 14,
	defaultTaxRate: 19,
	invoicePrefix: "INV",
};

/** Creates the single company settings record if it does not exist yet. */
export async function ensureCompanySettings(): Promise<void> {
	if (!(await SELECT.one.from(CompanySettings).columns("ID").where({ ID: 1 }))) {
		await INSERT.into(CompanySettings).entries({ ID: 1 });
	}
}

/** The defaults for new sales invoices. Later, customer-specific payment terms can override them. */
export async function getCompanySettings(): Promise<InvoiceDefaults> {
	const settings = (await SELECT.one
		.from(CompanySettings)
		.columns("defaultCurrency_code", "defaultPaymentTermDays", "defaultTaxRate", "invoicePrefix")
		.where({ ID: 1 })) as Partial<InvoiceDefaults> | undefined;
	return {
		defaultCurrency_code: settings?.defaultCurrency_code || fallback.defaultCurrency_code,
		defaultPaymentTermDays: Number(settings?.defaultPaymentTermDays ?? fallback.defaultPaymentTermDays),
		defaultTaxRate: Number(settings?.defaultTaxRate ?? fallback.defaultTaxRate),
		invoicePrefix: settings?.invoicePrefix || fallback.invoicePrefix,
	};
}
