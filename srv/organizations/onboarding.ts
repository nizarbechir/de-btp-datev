import cds from "@sap/cds";

import { currentOrganization, OrganizationContext, resolveOrganization } from "./organization-context";

/**
 * Creating a new organization: the organization, the signed-in user as owner, its company settings
 * and a default list of expense categories. TODO(feature): subscription/billing system
 */
export interface OnboardingInput {
	companyName?: null | string;
	country?: null | string;
	currency?: null | string;
	defaultPaymentTermDays?: null | number;
	defaultTaxRate?: null | number | string;
	invoicePrefix?: null | string;
	vatId?: null | string;
}

export const defaultExpenseCategories = [
	"Software",
	"Office",
	"Tax Advisor",
	"Insurance",
	"Travel",
	"Vehicle",
	"Marketing",
	"Telecommunication",
	"Rent",
	"Professional Services",
	"Other",
];

export async function createDefaultExpenseCategories(organizationId: string) {
	await INSERT.into("swiver.ExpenseCategories").entries(
		defaultExpenseCategories.map((name) => ({ ID: cds.utils.uuid(), name, organization_ID: organizationId })),
	);
}

export async function createOrganization(req: cds.Request, input: OnboardingInput): Promise<OrganizationContext> {
	const companyName = input.companyName?.trim();
	if (!companyName) {
		return req.reject(400, "COMPANY_NAME_MISSING") as never;
	}
	// TODO(feature): multi-workspace switcher (then a user may create further organizations)
	if (currentOrganization()) {
		return req.reject(409, "ORGANIZATION_EXISTS") as never;
	}
	const organizationId = cds.utils.uuid();
	await INSERT.into("swiver.Organizations").entries({
		ID: organizationId,
		name: companyName,
		slug: slugify(companyName),
	});
	await INSERT.into("swiver.Memberships").entries({
		organization_ID: organizationId,
		role: "OWNER",
		userId: req.user.id,
	});
	await INSERT.into("swiver.CompanySettings").entries({
		companyName,
		country_code: input.country || "DE",
		defaultCurrency_code: input.currency || "EUR",
		defaultPaymentTermDays: input.defaultPaymentTermDays ?? 14,
		defaultTaxRate: input.defaultTaxRate ?? 19,
		ID: await nextSettingsId(),
		invoicePrefix: input.invoicePrefix || "INV",
		organization_ID: organizationId,
		vatId: input.vatId || null,
	});
	await createDefaultExpenseCategories(organizationId);
	return (await resolveOrganization(req.user, organizationId)) as OrganizationContext;
}

/** Company settings keep their integer key; every organization gets the next free one. */
export async function nextSettingsId(): Promise<number> {
	const result = (await SELECT.one.from("swiver.CompanySettings").columns("max(ID) as maxID")) as null | {
		maxID: null | number;
	};
	return Number(result?.maxID ?? 0) + 1;
}

function slugify(name: string): string {
	return name
		.toLowerCase()
		.normalize("NFKD")
		.replace(/[^\w\s-]/g, "")
		.trim()
		.replace(/[\s_]+/g, "-")
		.slice(0, 60);
}
