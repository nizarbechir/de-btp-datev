import cds from "@sap/cds";

import { shiftDemoDates } from "./core/demo-data";
import { ensureCompanySettings } from "./core/settings";

cds.on("served", async () => {
	// Sales invoices need the seller's details; there is always exactly one settings record.
	await ensureCompanySettings();
	// The demo invoices in test/data are dated around demoDataDate. In development, move them to today
	// so the dashboard always shows open, overdue and due-soon invoices.
	if (cds.env.profiles.includes("development")) {
		await shiftDemoDates();
	}
});

export default cds.server;
