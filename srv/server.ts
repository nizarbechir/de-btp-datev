import cds from "@sap/cds";

import { shiftDemoDates } from "./core/demo-data";

// The demo invoices in test/data are dated around demoDataDate. In development, move them to today
// so the dashboard always shows open, overdue and due-soon invoices.
if (cds.env.profiles.includes("development")) {
	cds.on("served", () => shiftDemoDates());
}

export default cds.server;
