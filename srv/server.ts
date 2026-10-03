import cds from "@sap/cds";

import { shiftDemoDates } from "./core/demo-data";
import { migrateToOrganizations } from "./organizations/migration";
import { organizationMiddleware } from "./organizations/organization-context";

// Resolves the signed-in user's organization for every request, right after authentication.
cds.middlewares.add(organizationMiddleware, { after: "auth" });

cds.on("served", async () => {
	// Existing single-company data becomes organization #1; does nothing once migrated.
	await migrateToOrganizations();
	// The demo invoices in test/data are dated around demoDataDate. In development, move them to today
	// so the dashboard always shows open, overdue and due-soon invoices.
	if (cds.env.profiles.includes("development")) {
		await shiftDemoDates();
	}
});

export default cds.server;
