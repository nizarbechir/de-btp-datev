import cds from "@sap/cds";

import { isoDate } from "../core/dates";
import { createDefaultExpenseCategories } from "./onboarding";

/**
 * Turns a single-company installation into organization #1, without deleting or recreating records:
 * records without organization are assigned to it, number ranges get its prefix, and invoices
 * that were only flagged as paid get a payment record. Runs on every start and does nothing once done.
 */
const log = cds.log("migration");

export async function migrateToOrganizations(): Promise<void> {
	const organizationId = await defaultOrganization();
	if (!organizationId) {
		return;
	}
	for (const entity of ownedEntities()) {
		await UPDATE(entity).set({ organization_ID: organizationId }).where({ organization_ID: null });
	}
	await migrateNumberRanges(organizationId);
	await migrateOwner(organizationId);
	if (!(await SELECT.one.from("swiver.ExpenseCategories").columns("ID").where({ organization_ID: organizationId }))) {
		await createDefaultExpenseCategories(organizationId);
	}
	await migratePaidInvoices();
}

/**
 * The organization the existing data belongs to: the one of the first company settings record,
 * otherwise a new one named after the company, created only if there is data without organization.
 */
async function defaultOrganization(): Promise<string | undefined> {
	const settings = await SELECT.one
		.from("swiver.CompanySettings")
		.columns("ID", "companyName", "organization_ID")
		.orderBy("ID");
	if (settings?.organization_ID) {
		return settings.organization_ID as string;
	}
	const hasLegacyData =
		settings || (await SELECT.one.from("swiver.SalesInvoices").columns("ID").where({ organization_ID: null }));
	if (!hasLegacyData) {
		return undefined;
	}
	const existing = await SELECT.one.from("swiver.Organizations").columns("ID").orderBy("createdAt");
	const organizationId = (existing?.ID as string | undefined) ?? cds.utils.uuid();
	if (!existing) {
		await INSERT.into("swiver.Organizations").entries({
			ID: organizationId,
			name: settings?.companyName || "My Company",
		});
		log.info("Created the default organization for the existing data.");
	}
	return organizationId;
}

async function migrateNumberRanges(organizationId: string) {
	const ranges = (await SELECT.from("swiver.NumberRanges").where`range not like ${"%:%"}`) as {
		lastNumber: number;
		range: string;
	}[];
	for (const { lastNumber, range } of ranges) {
		await INSERT.into("swiver.NumberRanges").entries({ lastNumber, range: `${organizationId}:${range}` });
		await DELETE.from("swiver.NumberRanges").where({ range });
	}
}

/** SWIVER_DEFAULT_ORG_OWNER names the user (as known to the identity provider) who owns organization #1. */
async function migrateOwner(organizationId: string) {
	const owner = process.env.SWIVER_DEFAULT_ORG_OWNER;
	if (
		!owner ||
		(await SELECT.one.from("swiver.Memberships").columns("ID").where({ organization_ID: organizationId }))
	) {
		return;
	}
	await INSERT.into("swiver.Memberships").entries({ organization_ID: organizationId, role: "OWNER", userId: owner });
}

/** Before payments existed, a paid sales invoice had status PAID and a supplier invoice only a flag. */
async function migratePaidInvoices() {
	const sales = await SELECT.from("swiver.SalesInvoices")
		.columns("ID", "organization_ID", "grossAmount", "currency_code", "paymentDate", "invoiceDate", "invoiceNumber")
		.where({ status_code: "PAID" });
	for (const invoice of sales) {
		await INSERT.into("swiver.Payments").entries({
			amount: invoice.grossAmount,
			currency_code: invoice.currency_code,
			direction: "IN",
			organization_ID: invoice.organization_ID,
			paymentDate: invoice.paymentDate ?? invoice.invoiceDate ?? isoDate(new Date()),
			reference: invoice.invoiceNumber,
			salesInvoice_ID: invoice.ID,
			source: "MANUAL",
		});
		await UPDATE("swiver.SalesInvoices", invoice.ID).with({
			paidAmount: invoice.grossAmount,
			paymentStatus_code: "PAID",
			status_code: "SENT",
		});
	}
	const purchases = await SELECT.from("swiver.SupplierInvoices").columns(
		"ID",
		"organization_ID",
		"netAmount",
		"taxAmount",
		"currency_code",
		"paymentDate",
		"invoiceDate",
		"invoiceNumber",
	).where`paymentStatus_code = 'PAID' and (paidAmount is null or paidAmount = 0)`;
	for (const invoice of purchases) {
		const amount = (Number(invoice.netAmount) + Number(invoice.taxAmount)).toFixed(2);
		await INSERT.into("swiver.Payments").entries({
			amount,
			currency_code: invoice.currency_code,
			direction: "OUT",
			organization_ID: invoice.organization_ID,
			paymentDate: invoice.paymentDate ?? invoice.invoiceDate ?? isoDate(new Date()),
			reference: invoice.invoiceNumber,
			source: "MANUAL",
			supplierInvoice_ID: invoice.ID,
		});
		await UPDATE("swiver.SupplierInvoices", invoice.ID).with({ paidAmount: amount });
	}
	if (sales.length || purchases.length) {
		log.info(`Created payments for ${sales.length} sales and ${purchases.length} supplier invoices.`);
	}
}

/** Database entities with an organization, e.g. swiver.Customers (not the views). */
function ownedEntities(): string[] {
	return Object.values(cds.model?.definitions ?? {})
		.filter((definition) => definition.kind === "entity" && definition.name.startsWith("swiver."))
		.filter((definition) => {
			const entity = definition as cds.entity & { query?: unknown };
			return !entity.query && Boolean(entity.elements?.organization);
		})
		.map((definition) => definition.name);
}
