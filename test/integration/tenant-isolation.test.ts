import { beforeAll, describe, expect, it } from "@jest/globals";
import cds from "@sap/cds";

/**
 * Organization isolation against crafted requests: bob runs his own organization and knows the UUIDs
 * of alice's organization (test data "Nordwind"). He must not read, change, download, match, export or
 * reference any of it, through CRUD, navigation, $expand/$filter, custom actions or functions.
 */
const projectRootDir = __dirname + "../../..";
const { axios, DELETE, GET, PATCH, POST } = cds.test("serve", "--project", projectRootDir);

axios.defaults.validateStatus = () => true;
const alice = { auth: { password: "alice", username: "alice" } };
const bob = { auth: { password: "bob", username: "bob" } };

const SALES = "/odata/v4/sales";
const PURCHASING = "/odata/v4/purchasing";
const FINANCE = "/odata/v4/finance";
const ORGANIZATION = "/odata/v4/organization";
const ADVISOR = "/odata/v4/tax-advisor";

const organizationHeader = "x-organization-id";
const aliceOrganization = "77777777-0000-4000-8000-000000000001";
const ids = {
	bankTransaction: "88888888-0000-4000-8000-000000000001",
	customer: "33333333-0000-4000-8000-000000000001",
	product: "99999999-0000-4000-8000-000000000001",
	salesInvoice: "44444444-0000-4000-8000-000000000005",
	supplier: "11111111-0000-4000-8000-000000000001",
	supplierInvoice: "22222222-0000-4000-8000-000000000001",
};
const salesInvoice = `${SALES}/SalesInvoices(ID=${ids.salesInvoice},IsActiveEntity=true)`;
const supplierInvoice = `${PURCHASING}/SupplierInvoices(ID=${ids.supplierInvoice},IsActiveEntity=true)`;

let aliceComment: string;
let aliceItem: string;
let alicePayment: string;
let bobTransaction: string;

async function createActive(service: string, entitySet: string, data: object, user = bob) {
	const draft = await POST(`${service}/${entitySet}`, data, user);
	expect(draft.status).toBe(201);
	const saved = await POST(
		`${service}/${entitySet}(ID=${draft.data.ID},IsActiveEntity=false)/${service === SALES ? "SalesService" : "PurchasingService"}.draftActivate`,
		{},
		user,
	);
	expect(saved.status).toBe(201);
	return saved.data;
}

/** Status of a request that must not reveal or touch alice's data. */
function expectDenied(status: number) {
	expect([400, 403, 404, 405]).toContain(status);
}

beforeAll(async () => {
	// Alice's data that bob will go after: a comment, a document, a payment
	await POST(`${salesInvoice}/SalesService.addComment`, { text: "Internal note" }, alice);
	const comments = await GET(`${SALES}/FinancialComments?$filter=salesInvoice_ID eq ${ids.salesInvoice}`, alice);
	aliceComment = comments.data.value[0].ID;
	await axios.put(`${supplierInvoice}/documentContent`, "%PDF-1.4 alice", {
		...alice,
		headers: { "Content-Type": "application/pdf" },
	});
	await POST(`${salesInvoice}/SalesService.recordPayment`, { amount: 10 }, alice);
	alicePayment = (await GET(`${SALES}/Payments?$filter=salesInvoice_ID eq ${ids.salesInvoice}`, alice)).data.value[0]
		.ID;
	aliceItem = (await GET(`${salesInvoice}/items`, alice)).data.value[0].ID;

	// Bob's own organization with one customer and one incoming bank transaction
	const onboarding = await POST(`${ORGANIZATION}/createOrganization`, { companyName: "Bob Handwerk GmbH" }, bob);
	if (onboarding.status !== 200) {
		throw new Error(`Onboarding failed: ${onboarding.status}`);
	}
	await createActive(SALES, "Customers", { name: "Bob's customer" });
	const csv =
		"Buchungstag;Name Zahlungsbeteiligter;Verwendungszweck;Betrag;Waehrung\n01.10.2026;Somebody;Payment;100,00;EUR";
	const imported = await POST(`${FINANCE}/importBankStatement`, { content: csv, fileName: "bob.csv" }, bob);
	if (imported.status !== 200) {
		throw new Error(`Bank import failed: ${imported.status}`);
	}
	bobTransaction = (await GET(`${FINANCE}/BankTransactions`, bob)).data.value[0].ID;
});

describe("Reading", () => {
	it.each([
		[`${SALES}/SalesInvoices`],
		[`${SALES}/SalesInvoiceItems`],
		[`${SALES}/ProductServices`],
		[`${SALES}/Payments`],
		[`${SALES}/Quotes`],
		[`${SALES}/FinancialComments`],
		[`${PURCHASING}/SupplierInvoices`],
		[`${PURCHASING}/Suppliers`],
		[`${PURCHASING}/IncomingDocuments`],
		[`${PURCHASING}/Payments`],
		[`${FINANCE}/Payments`],
		[`${FINANCE}/CashFlow`],
		[`${FINANCE}/SalesInvoices`],
		[`${FINANCE}/SupplierInvoices`],
		[`${ORGANIZATION}/AuditLogEntries`],
		[`${ORGANIZATION}/Invitations`],
	])("lists none of alice's records in %s", async (url) => {
		const { data, status } = await GET(`${url}?$count=true`, bob);

		expect(status).toBe(200);
		expect(data["@odata.count"]).toBe(0);
	});

	it("shows only bob's own customers, bank transactions, memberships, organization and settings", async () => {
		const customers = (await GET(`${SALES}/Customers`, bob)).data.value;
		const transactions = (await GET(`${FINANCE}/BankTransactions`, bob)).data.value;
		const memberships = (await GET(`${ORGANIZATION}/Memberships`, bob)).data.value;
		const organizations = (await GET(`${ORGANIZATION}/Organizations`, bob)).data.value;
		const settings = (await GET(`${ORGANIZATION}/CompanySettings`, bob)).data.value;

		expect(customers.map((customer: { name: string }) => customer.name)).toEqual(["Bob's customer"]);
		expect(transactions.map((transaction: { ID: string }) => transaction.ID)).toEqual([bobTransaction]);
		expect(memberships.map((membership: { userId: string }) => membership.userId)).toEqual(["bob"]);
		expect(organizations.map((organization: { name: string }) => organization.name)).toEqual(["Bob Handwerk GmbH"]);
		expect(settings).toHaveLength(1);
		expect(settings[0].organization_ID).not.toBe(aliceOrganization);
	});

	it.each([
		[salesInvoice],
		[`${SALES}/SalesInvoiceItems(ID=${aliceItem},IsActiveEntity=true)`],
		[`${SALES}/Customers(ID=${ids.customer},IsActiveEntity=true)`],
		[`${SALES}/ProductServices(ID=${ids.product},IsActiveEntity=true)`],
		[`${SALES}/Payments(${alicePayment})`],
		[`${SALES}/FinancialComments(${aliceComment})`],
		[supplierInvoice],
		[`${PURCHASING}/Suppliers(ID=${ids.supplier},IsActiveEntity=true)`],
		[`${FINANCE}/BankTransactions(${ids.bankTransaction})`],
		[`${ORGANIZATION}/Organizations(${aliceOrganization})`],
		[`${ORGANIZATION}/CompanySettings(ID=1,IsActiveEntity=true)`],
	])("cannot read %s by its key", async (url) => {
		expectDenied((await GET(url, bob)).status);
	});

	it("cannot download alice's documents or invoice PDFs", async () => {
		const requests = [
			`${supplierInvoice}/documentContent`,
			`${FINANCE}/BankTransactions(${ids.bankTransaction})/suggestedDocument`,
			`${salesInvoice}/SalesService.pdf(download=true)`,
			`${salesInvoice}/SalesService.zugferd(download=true)`,
			`${ORGANIZATION}/CompanySettings(ID=1,IsActiveEntity=true)/logo`,
		];
		for (const url of requests) {
			const response = await GET(url, { ...bob, responseType: "arraybuffer" });
			expectDenied(response.status);
			expect(Buffer.from(response.data as ArrayBuffer).toString("latin1")).not.toContain("%PDF");
		}
	});

	it("cannot reach alice's data through $expand or $filter on own records", async () => {
		const expanded = await GET(`${SALES}/Customers?$expand=balance`, bob);
		expect(expanded.status).toBe(200);
		const filtered = await GET(`${SALES}/SalesInvoices?$filter=customer_ID eq ${ids.customer}&$count=true`, bob);
		expect(filtered.data["@odata.count"]).toBe(0);
		const byNavigation = await GET(`${SALES}/Customers(ID=${ids.customer},IsActiveEntity=true)/balance`, bob);
		expect([204, 404]).toContain(byNavigation.status);
		expect(byNavigation.data?.outstanding).toBeUndefined();
	});

	it("does not include alice's figures in bob's dashboard, VAT overview or accountant export", async () => {
		const dashboard = await GET(`${FINANCE}/dashboard()`, bob);
		expect(dashboard.status).toBe(200);
		expect(JSON.stringify(dashboard.data)).not.toMatch(/INV-2026|Nordwind|Müller/);

		const vat = await GET(`${FINANCE}/vatOverview(fromDate=2026-01-01,toDate=2026-12-31)`, bob);
		expect(vat.status).toBe(200);
		expect(Number(vat.data.outputTax ?? 0)).toBe(0);
		expect(Number(vat.data.inputTax ?? 0)).toBe(0);

		const exported = await GET(`${FINANCE}/accountantExport(fromDate=2026-01-01,toDate=2026-12-31)`, {
			...bob,
			responseType: "arraybuffer",
		});
		expect(exported.status).toBe(200);
		expect(Buffer.from(exported.data as ArrayBuffer).toString("latin1")).not.toMatch(/INV-2026|TK-2026/);
	});

	it("cannot open the tax advisor workspace of alice's organization", async () => {
		const { data, status } = await GET(`${ADVISOR}/SalesInvoices?$count=true`, bob);
		expect([200, 403, 404]).toContain(status);
		expect(status === 200 ? data["@odata.count"] : 0).toBe(0);
	});

	it("cannot switch into alice's organization with the organization header", async () => {
		const asAlicesOrganization = { ...bob, headers: { [organizationHeader]: aliceOrganization } };
		const { data } = await GET(`${SALES}/SalesInvoices?$count=true`, asAlicesOrganization);
		expect(data["@odata.count"]).toBe(0);
		const switched = await POST(
			`${ORGANIZATION}/Organizations(${aliceOrganization})/OrganizationService.switchTo`,
			{},
			bob,
		);
		expectDenied(switched.status);
	});
});

describe("Changing", () => {
	it("cannot update or delete alice's records directly", async () => {
		const attempts = [
			PATCH(salesInvoice, { notes: "bob" }, bob),
			PATCH(`${SALES}/Customers(ID=${ids.customer},IsActiveEntity=true)`, { name: "bob" }, bob),
			DELETE(`${SALES}/Customers(ID=${ids.customer},IsActiveEntity=true)`, bob),
			PATCH(supplierInvoice, { notes: "bob" }, bob),
			axios.put(`${supplierInvoice}/documentContent`, "%PDF-1.4 bob", {
				...bob,
				headers: { "Content-Type": "application/pdf" },
			}),
			DELETE(`${PURCHASING}/Suppliers(ID=${ids.supplier},IsActiveEntity=true)`, bob),
			PATCH(`${FINANCE}/BankTransactions(${ids.bankTransaction})`, { reference: "bob" }, bob),
			PATCH(`${ORGANIZATION}/CompanySettings(ID=1,IsActiveEntity=true)`, { iban: "DE00BOB" }, bob),
			POST(`${ORGANIZATION}/CompanySettings(ID=1,IsActiveEntity=true)/OrganizationService.draftEdit`, {}, bob),
		];
		for (const attempt of await Promise.all(attempts)) {
			expectDenied(attempt.status);
		}
		const invoice = (await GET(salesInvoice, alice)).data;
		expect(invoice.notes).not.toBe("bob");
		const settings = (await GET(`${ORGANIZATION}/CompanySettings(ID=1,IsActiveEntity=true)`, alice)).data;
		expect(settings.iban).not.toBe("DE00BOB");
		const document = await GET(`${supplierInvoice}/documentContent`, { ...alice, responseType: "arraybuffer" });
		expect(Buffer.from(document.data as ArrayBuffer).toString()).toBe("%PDF-1.4 alice");
	});

	it.each([
		["finalize", `${salesInvoice}/SalesService.finalize`, {}],
		["markAsPaid", `${salesInvoice}/SalesService.markAsPaid`, {}],
		["recordPayment", `${salesInvoice}/SalesService.recordPayment`, { amount: 1 }],
		["reopen", `${salesInvoice}/SalesService.reopen`, {}],
		["cancelInvoice", `${salesInvoice}/SalesService.cancelInvoice`, {}],
		["correct", `${salesInvoice}/SalesService.correct`, {}],
		["duplicate", `${salesInvoice}/SalesService.duplicate`, {}],
		["addComment", `${salesInvoice}/SalesService.addComment`, { text: "bob" }],
		["sendReminder", `${salesInvoice}/SalesService.sendReminder`, { recipient: "bob@example.com" }],
		["markInvoicePaid", `${supplierInvoice}/PurchasingService.markInvoicePaid`, {}],
		["resolve comment", `${SALES}/FinancialComments(${aliceComment})/SalesService.resolve`, {}],
		["confirmMatch", `${FINANCE}/BankTransactions(${ids.bankTransaction})/FinanceService.confirmMatch`, {}],
		["unmatch", `${FINANCE}/BankTransactions(${ids.bankTransaction})/FinanceService.unmatch`, {}],
		["ignore", `${FINANCE}/BankTransactions(${ids.bankTransaction})/FinanceService.ignore`, {}],
		[
			"inviteMember",
			`${ORGANIZATION}/Organizations(${aliceOrganization})/OrganizationService.inviteMember`,
			{ email: "bob@example.com", role: "ADMIN" },
		],
	])("cannot run %s on alice's record", async (_name, url, body) => {
		expectDenied((await POST(url, body, bob)).status);
	});

	it("leaves alice's data unchanged after all attacks", async () => {
		const invoice = (await GET(salesInvoice, alice)).data;
		expect(invoice).toMatchObject({ paidAmount: "10.00", status_code: "SENT" });
		const comments = (await GET(`${SALES}/FinancialComments?$filter=salesInvoice_ID eq ${ids.salesInvoice}`, alice))
			.data;
		expect(comments.value).toHaveLength(1);
		const transaction = (await GET(`${FINANCE}/BankTransactions(${ids.bankTransaction})`, alice)).data;
		expect(transaction.matchStatus_code).toBe("SUGGESTED");
		const memberships = (await GET(`${ORGANIZATION}/Memberships`, alice)).data.value;
		expect(memberships.map((membership: { userId: string }) => membership.userId)).not.toContain("bob");
	});
});

describe("Referencing", () => {
	it("cannot match his own bank transaction to alice's invoice", async () => {
		const response = await POST(
			`${FINANCE}/BankTransactions(${bobTransaction})/FinanceService.matchManually`,
			{ salesInvoice: ids.salesInvoice },
			bob,
		);
		expectDenied(response.status);
	});

	it("cannot use alice's customer, product or supplier in his own records", async () => {
		const invoice = await POST(`${SALES}/SalesInvoices`, { customer_ID: ids.customer }, bob);
		expectDenied(invoice.status);

		const draft = await POST(`${SALES}/SalesInvoices`, {}, bob);
		const item = await POST(
			`${SALES}/SalesInvoices(ID=${draft.data.ID},IsActiveEntity=false)/items`,
			{ description: "x", productService_ID: ids.product, quantity: 1, taxRate: 19, unitPrice: 1 },
			bob,
		);
		expectDenied(item.status);

		const purchase = await POST(`${PURCHASING}/SupplierInvoices`, { supplier_ID: ids.supplier }, bob);
		expectDenied(purchase.status);
	});

	it("cannot assign records to alice's organization", async () => {
		const customer = await createActive(SALES, "Customers", { name: "Planted", organization_ID: aliceOrganization });
		expect(customer.organization_ID).not.toBe(aliceOrganization);
		const aliceCustomers = (await GET(`${SALES}/Customers?$filter=name eq 'Planted'&$count=true`, alice)).data;
		expect(aliceCustomers["@odata.count"]).toBe(0);
	});
});
