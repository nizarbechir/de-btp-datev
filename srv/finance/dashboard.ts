import { addDays, firstDayOfMonth, isoDate } from "../core/dates";
import { getCompanySettings } from "../core/settings";
import { requireOrganization } from "../organizations/organization-context";
import { vatOverview } from "./vat-overview";

/**
 * The dashboard answers: who owes me money, what do I owe, what is overdue or due soon, what did I
 * earn and spend this month, the estimated VAT, and what needs my attention. Organization-scoped.
 */
interface Kpi {
	amount: number;
	count: number;
}

const issued = ["FINALIZED", "SENT"];

export async function dashboard() {
	const organization_ID = requireOrganization();
	const now = new Date();
	const today = isoDate(now);
	const monthStart = isoDate(firstDayOfMonth(now));
	const in7Days = isoDate(addDays(now, 7));
	const sales = (where: object, amount = "grossAmount - coalesce(paidAmount, 0)") =>
		kpi("swiver.SalesInvoices", amount, { organization_ID, status_code: { in: issued }, ...where });
	const purchases = (where: object, amount = "netAmount + taxAmount - coalesce(paidAmount, 0)", dueUntil?: string) =>
		kpi("swiver.SupplierInvoices", amount, { organization_ID, ...where }, dueUntil);
	const payments = (direction: string) =>
		kpi("swiver.Payments", "amount", { direction, organization_ID, paymentDate: { ">=": monthStart } });
	const unpaid = { paymentStatus_code: { "!=": "PAID" } };

	const receivables = {
		outstanding: await sales(unpaid),
		overdue: await sales({ ...unpaid, dueDate: { "<": today } }),
		paidThisMonth: await payments("IN"),
		revenueThisMonth: await sales({ invoiceDate: { ">=": monthStart } }, "netAmount"),
	};
	const payables = {
		dueNext7Days: await purchases({ ...unpaid, dueDate: { ">=": today } }, undefined, in7Days),
		expensesThisMonth: await purchases({ invoiceDate: { ">=": monthStart } }, "netAmount"),
		open: await purchases(unpaid),
		overdue: await purchases({ ...unpaid, dueDate: { "<": today } }),
		paidThisMonth: await payments("OUT"),
	};
	const inbox = await kpi("swiver.IncomingDocuments", "0", {
		organization_ID,
		processingStatus_code: { in: ["NEW", "ERROR"] },
	});
	const unmatched = await kpi("swiver.BankTransactions", "amount", { matchStatus_code: "UNMATCHED", organization_ID });
	const suggested = await kpi("swiver.BankTransactions", "amount", { matchStatus_code: "SUGGESTED", organization_ID });
	const vat = await vatOverview(monthStart, today);
	const organization = await SELECT.one.from("swiver.Organizations").columns("name").where({ ID: organization_ID });

	const attention = [
		{
			count: receivables.overdue.count,
			id: "overdueReceivables",
			target: "SalesInvoice",
			text: "overdue customer invoices",
		},
		{
			count: payables.overdue.count,
			id: "overduePayables",
			target: "SupplierInvoice",
			text: "overdue supplier invoices",
		},
		{
			count: payables.dueNext7Days.count,
			id: "dueSoon",
			target: "SupplierInvoice",
			text: "supplier invoices due this week",
		},
		{ count: inbox.count, id: "inbox", target: "IncomingDocument", text: "documents waiting in the inbox" },
		{ count: suggested.count, id: "suggested", target: "BankTransaction", text: "bank matches to confirm" },
		{ count: unmatched.count, id: "unmatched", target: "BankTransaction", text: "unmatched bank transactions" },
	].filter((item) => item.count > 0);

	return {
		currency: (await getCompanySettings()).defaultCurrency_code,
		estimatedVat: Number(vat.estimatedVat),
		inboxCount: inbox.count,
		needsAttention: attention.map((item) => ({ ...item, text: `${item.count} ${item.text}` })),
		organizationName: organization?.name ?? "",
		payables,
		receivables,
		unmatchedCount: unmatched.count + suggested.count,
	};
}

/** Number and total of the records matching the condition. */
async function kpi(entity: string, amount: string, where: object, dueUntil?: string): Promise<Kpi> {
	const query = SELECT.one.from(entity).columns("count(1) as count", `sum(${amount}) as amount`).where(where);
	if (dueUntil) {
		query.and("dueDate <=", dueUntil);
	}
	const result = (await query) as null | { amount: null | number | string; count: number };
	return { amount: Math.round(Number(result?.amount ?? 0) * 100) / 100, count: Number(result?.count ?? 0) };
}
