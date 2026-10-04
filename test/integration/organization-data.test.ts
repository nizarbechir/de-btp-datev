import { beforeAll, describe, expect, it } from "@jest/globals";
import cds from "@sap/cds";
import { unzipSync } from "fflate";

import { deleteOrganizationData } from "../../srv/organizations/organization-data";

/**
 * Customer data export, member deactivation and organization deletion at offboarding
 * (docs/data-retention-privacy.md).
 */
const projectRootDir = __dirname + "../../..";
const { axios, DELETE, GET, POST } = cds.test("serve", "--project", projectRootDir);

axios.defaults.validateStatus = () => true;
const alice = { auth: { password: "alice", username: "alice" } };
const bob = { auth: { password: "bob", username: "bob" } };
const carol = { auth: { password: "carol", username: "carol" } };
const advisor = { auth: { password: "steuerberater", username: "steuerberater@example.de" } };

const ORGANIZATION = "/odata/v4/organization";
const aliceOrganization = "77777777-0000-4000-8000-000000000001";
let bobOrganization: string;

async function exportFor(user: typeof alice) {
	return GET(`${ORGANIZATION}/exportOrganizationData()`, { ...user, responseType: "arraybuffer" });
}

beforeAll(async () => {
	await axios.put(
		"/odata/v4/purchasing/SupplierInvoices(ID=22222222-0000-4000-8000-000000000001,IsActiveEntity=true)/documentContent",
		"%PDF-1.4 supplier invoice",
		{ ...alice, headers: { "Content-Type": "application/pdf" } },
	);
	const onboarding = await POST(`${ORGANIZATION}/createOrganization`, { companyName: "Bob Handwerk GmbH" }, bob);
	bobOrganization = onboarding.data.organizationID;
	const customer = await POST("/odata/v4/sales/Customers", { name: "Bob's customer" }, bob);
	await POST(
		`/odata/v4/sales/Customers(ID=${customer.data.ID},IsActiveEntity=false)/SalesService.draftActivate`,
		{},
		bob,
	);
});

describe("Data export", () => {
	it("gives the owner every record and document of the own organization", async () => {
		const response = await exportFor(alice);
		expect(response.status).toBe(200);
		const files = unzipSync(new Uint8Array(response.data as ArrayBuffer));
		const read = (path: string) => JSON.parse(Buffer.from(files[path]).toString("utf8"));

		const manifest = read("manifest.json");
		expect(manifest.organization).toBe(aliceOrganization);
		expect(manifest.tables["swiver.SalesInvoices"]).toBeGreaterThan(0);
		expect(manifest.tables["swiver.SalesInvoiceItems"]).toBeGreaterThan(0);
		expect(manifest.tables["swiver.Payments"]).toBeGreaterThan(0);
		expect(read("data/swiver.Organizations.json")[0].ID).toBe(aliceOrganization);

		const invoices = read("data/swiver.SupplierInvoices.json") as { documentContent: null | string; ID: string }[];
		const withDocument = invoices.find((invoice) => invoice.ID === "22222222-0000-4000-8000-000000000001");
		expect(withDocument?.documentContent).toMatch(/^documents\/swiver\.SupplierInvoices\/.+\.pdf$/);
		expect(Buffer.from(files[withDocument?.documentContent as string]).toString()).toBe("%PDF-1.4 supplier invoice");
	});

	it("contains nothing of other organizations", async () => {
		const files = unzipSync(new Uint8Array((await exportFor(alice)).data as ArrayBuffer));
		const all = Object.values(files)
			.map((content) => Buffer.from(content).toString("utf8"))
			.join("\n");
		expect(all).not.toContain(bobOrganization);
		expect(all).not.toContain("Bob's customer");
	});

	it("is only available to owners and admins", async () => {
		await INSERT.into("swiver.Memberships").entries({
			organization_ID: aliceOrganization,
			role: "MEMBER",
			userId: "carol",
		});
		expect((await exportFor(carol)).status).toBe(403);
		expect((await exportFor(advisor)).status).toBe(403);
	});
});

describe("Member deactivation", () => {
	it("removes access with the next request when an admin removes the membership", async () => {
		expect((await GET("/odata/v4/sales/SalesInvoices?$top=1", carol)).status).toBe(200);
		const membership = (await GET(`${ORGANIZATION}/Memberships?$filter=userId eq 'carol'`, alice)).data.value[0];
		const removed = await DELETE(`${ORGANIZATION}/Memberships(${membership.ID})`, alice);
		expect(removed.status).toBe(204);

		expect((await GET("/odata/v4/sales/SalesInvoices?$top=1", carol)).status).toBe(403);
		// Records keep their author for the audit trail
		const invoices = (await GET("/odata/v4/sales/SalesInvoices?$top=1", alice)).data.value;
		expect(invoices[0].createdBy).toBeDefined();
	});
});

describe("Organization deletion", () => {
	it("deletes all data of one organization and nothing of the others", async () => {
		const before = await SELECT.one`count(*) as n`
			.from("swiver.SalesInvoices")
			.where({ organization_ID: aliceOrganization });

		const deleted = await cds.tx(() => deleteOrganizationData(bobOrganization));

		expect(deleted["swiver.Customers"]).toBe(1);
		expect(deleted["swiver.Organizations"]).toBe(1);
		for (const table of [
			"swiver.Customers",
			"swiver.Memberships",
			"swiver.CompanySettings",
			"swiver.ExpenseCategories",
		]) {
			const rest = await SELECT.one`count(*) as n`.from(table).where({ organization_ID: bobOrganization });
			expect(Number(rest.n)).toBe(0);
		}
		const after = await SELECT.one`count(*) as n`
			.from("swiver.SalesInvoices")
			.where({ organization_ID: aliceOrganization });
		expect(after.n).toBe(before.n);
		expect((await GET("/odata/v4/sales/Customers", bob)).status).toBe(403);
	});
});
