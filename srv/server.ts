import cds from "@sap/cds";

import { shiftDemoDates } from "./core/demo-data";
import { migrateToOrganizations } from "./organizations/migration";
import { organizationMiddleware } from "./organizations/organization-context";

// Readiness for monitoring (no authentication, no data): the process is up and the database answers.
// Liveness is CAP's built-in /health.
cds.on("bootstrap", (app) => {
	app.get("/health/ready", async (_req, res) => {
		try {
			await SELECT.one.from("sap.common.Currencies").columns("code");
			res.json({ database: "UP", status: "UP" });
		} catch (error) {
			cds.log("health").error("Database readiness check failed", error instanceof Error ? error.message : error);
			res.status(503).json({ database: "DOWN", status: "DOWN" });
		}
	});
});

// Resolves the signed-in user's organization for every request, right after authentication.
cds.middlewares.add(organizationMiddleware, { after: "auth" });

cds.on("served", async () => {
	// Existing single-company data becomes organization #1; does nothing once migrated.
	await migrateToOrganizations();
	// The demo invoices in test/data are dated around demoDataDate. In development, move them to today
	// so the dashboard always shows open, overdue and due-soon invoices.
	// Only for the in-memory development database: a persistent database (e.g. HANA in hybrid mode) would be
	// shifted again on every start, including real data.
	const db = cds.env.requires.db as { credentials?: { url?: string }; kind?: string };
	if (cds.env.profiles.includes("development") && db.kind === "sqlite" && db.credentials?.url === ":memory:") {
		await shiftDemoDates();
	}
});

export default cds.server;
