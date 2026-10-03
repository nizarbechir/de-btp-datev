import cds from "@sap/cds";

import { addDays, isoDate } from "./dates";

/** The day the demo invoices in test/data were written for. */
export const demoDataDate = "2026-10-03";

const dateFields = ["invoiceDate", "dueDate", "paymentDate"] as const;
const dayInMs = 24 * 60 * 60 * 1000;

export async function shiftDemoDates(today = new Date()): Promise<void> {
	const days = Math.round((Date.parse(isoDate(today)) - Date.parse(demoDataDate)) / dayInMs);
	if (days === 0) {
		return;
	}

	const invoices = await SELECT.from("swiver.SupplierInvoices").columns("ID", ...dateFields);
	for (const invoice of invoices) {
		const shifted: Record<string, string> = {};
		for (const field of dateFields) {
			if (invoice[field]) {
				shifted[field] = isoDate(addDays(new Date(invoice[field]), days));
			}
		}
		await UPDATE("swiver.SupplierInvoices", invoice.ID).with(shifted);
	}
	cds.log("demo-data").info(`Moved demo invoice dates by ${days} days.`);
}
