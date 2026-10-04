import { beforeAll, describe, expect, it } from "@jest/globals";
import cds from "@sap/cds";

/**
 * Membership roles inside one organization (test data "Nordwind"): alice is OWNER, bob is added as
 * MEMBER, steuerberater@example.de is TAX_ADVISOR. carol has no organization and no Swiver role.
 * The backend is the final authority for every operation.
 */
const projectRootDir = __dirname + "../../..";
const { axios, GET, PATCH, POST } = cds.test("serve", "--project", projectRootDir);

axios.defaults.validateStatus = () => true;
const owner = { auth: { password: "alice", username: "alice" } };
const member = { auth: { password: "bob", username: "bob" } };
const advisor = { auth: { password: "steuerberater", username: "steuerberater@example.de" } };
const outsider = { auth: { password: "carol", username: "carol" } };

const SALES = "/odata/v4/sales";
const PURCHASING = "/odata/v4/purchasing";
const FINANCE = "/odata/v4/finance";
const ORGANIZATION = "/odata/v4/organization";
const ADVISOR = "/odata/v4/tax-advisor";
const organization = "77777777-0000-4000-8000-000000000001";
const draftInvoice = "44444444-0000-4000-8000-000000000010";
const sentInvoice = "44444444-0000-4000-8000-000000000005";
const supplierInvoice = "22222222-0000-4000-8000-000000000001";
const settings = `${ORGANIZATION}/CompanySettings(ID=1,IsActiveEntity=true)`;
const invoice = (id: string) => `${SALES}/SalesInvoices(ID=${id},IsActiveEntity=true)`;

beforeAll(async () => {
	await INSERT.into("swiver.Memberships").entries({ organization_ID: organization, role: "MEMBER", userId: "bob" });
});

describe("Tax advisor", () => {
	it("reads financial data, downloads documents, exports and comments", async () => {
		expect((await GET(`${SALES}/SalesInvoices`, advisor)).status).toBe(200);
		expect((await GET(`${PURCHASING}/SupplierInvoices`, advisor)).status).toBe(200);
		expect((await GET(`${invoice(sentInvoice)}/SalesService.pdf(download=true)`, advisor)).status).toBe(200);
		expect((await GET(`${ADVISOR}/SalesInvoices`, advisor)).status).toBe(200);
		expect((await GET(`${FINANCE}/vatOverview(fromDate=2026-01-01,toDate=2026-12-31)`, advisor)).status).toBe(200);
		expect((await GET(`${FINANCE}/accountantExport(fromDate=2026-01-01,toDate=2026-12-31)`, advisor)).status).toBe(200);
		expect((await POST(`${invoice(sentInvoice)}/SalesService.addComment`, { text: "Question" }, advisor)).status).toBe(
			200,
		);
	});

	it.each([
		["create a customer", () => POST(`${SALES}/Customers`, { name: "x" }, advisor)],
		["edit a draft invoice", () => POST(`${invoice(draftInvoice)}/SalesService.draftEdit`, {}, advisor)],
		["finalize", () => POST(`${invoice(draftInvoice)}/SalesService.finalize`, {}, advisor)],
		["record a payment", () => POST(`${invoice(sentInvoice)}/SalesService.recordPayment`, { amount: 1 }, advisor)],
		["cancel", () => POST(`${invoice(sentInvoice)}/SalesService.cancelInvoice`, {}, advisor)],
		["create a supplier invoice", () => POST(`${PURCHASING}/SupplierInvoices`, {}, advisor)],
		[
			"mark a supplier invoice paid",
			() =>
				POST(
					`${PURCHASING}/SupplierInvoices(ID=${supplierInvoice},IsActiveEntity=true)/PurchasingService.markInvoicePaid`,
					{},
					advisor,
				),
		],
		[
			"upload a document",
			() =>
				axios.put(
					`${PURCHASING}/SupplierInvoices(ID=${supplierInvoice},IsActiveEntity=true)/documentContent`,
					"%PDF-1.4",
					{ ...advisor, headers: { "Content-Type": "application/pdf" } },
				),
		],
		[
			"import a bank statement",
			() => POST(`${FINANCE}/importBankStatement`, { content: "x", fileName: "x.csv" }, advisor),
		],
		[
			"confirm a bank match",
			() =>
				POST(
					`${FINANCE}/BankTransactions(88888888-0000-4000-8000-000000000001)/FinanceService.confirmMatch`,
					{},
					advisor,
				),
		],
		["edit company settings", () => POST(`${settings}/OrganizationService.draftEdit`, {}, advisor)],
		["change settings directly", () => PATCH(settings, { iban: "DE00" }, advisor)],
		[
			"invite a member",
			() =>
				POST(
					`${ORGANIZATION}/Organizations(${organization})/OrganizationService.inviteMember`,
					{ email: "x@example.com", role: "ADMIN" },
					advisor,
				),
		],
	])("cannot %s", async (_name, request) => {
		expect([403, 405]).toContain((await request()).status);
	});
});

describe("Member", () => {
	it("works with business records", async () => {
		const draft = await POST(`${SALES}/Customers`, { name: "Member's customer" }, member);
		expect(draft.status).toBe(201);
		expect((await GET(`${PURCHASING}/SupplierInvoices`, member)).status).toBe(200);
	});

	it.each([
		["edit company settings", () => POST(`${settings}/OrganizationService.draftEdit`, {}, member)],
		[
			"invite a member",
			() =>
				POST(
					`${ORGANIZATION}/Organizations(${organization})/OrganizationService.inviteMember`,
					{ email: "x@example.com", role: "ADMIN" },
					member,
				),
		],
		["open the tax advisor workspace", () => GET(`${ADVISOR}/SalesInvoices`, member)],
	])("cannot %s", async (_name, request) => {
		expect([403, 405]).toContain((await request()).status);
	});
});

describe("Owner", () => {
	it("manages settings and opens the tax advisor workspace", async () => {
		expect((await POST(`${settings}/OrganizationService.draftEdit`, {}, owner)).status).toBe(201);
		expect(
			(
				await POST(
					`${ORGANIZATION}/CompanySettings(ID=1,IsActiveEntity=false)/OrganizationService.draftActivate`,
					{},
					owner,
				)
			).status,
		).toBe(200);
		expect((await GET(`${ADVISOR}/SalesInvoices`, owner)).status).toBe(200);
	});
});

describe("Users without organization", () => {
	it("see no data", async () => {
		expect((await GET(`${SALES}/SalesInvoices`, outsider)).status).toBe(403);
		const { data } = await GET(`${ORGANIZATION}/myOrganization()`, outsider);
		expect(data.organizationID ?? null).toBeNull();
	});

	it("cannot create an organization without the Swiver role collection", async () => {
		const response = await POST(`${ORGANIZATION}/createOrganization`, { companyName: "Carol Ltd" }, outsider);
		expect(response.status).toBe(403);
	});
});
