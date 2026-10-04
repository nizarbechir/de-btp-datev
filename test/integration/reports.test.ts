import { beforeAll, describe, expect, it } from "@jest/globals";
import cds from "@sap/cds";

import { addDays, isoDate } from "../../srv/core/dates";

/**
 * Sales, purchase and open item reports. bob runs his own organization with a known set of invoices
 * (dated relative to today), so every total is exact; alice's organization (test data "Nordwind")
 * holds other invoices that must never show up in bob's reports, and the other way round.
 * carol is bob's tax advisor.
 */
const projectRootDir = __dirname + "../../..";
const { axios, GET, PATCH, POST } = cds.test("serve", "--project", projectRootDir);

axios.defaults.validateStatus = () => true;
const alice = { auth: { password: "alice", username: "alice" } };
const bob = { auth: { password: "bob", username: "bob" } };
const carol = { auth: { password: "carol", username: "carol" } };

const SALES = "/odata/v4/sales";
const PURCHASING = "/odata/v4/purchasing";
const ORGANIZATION = "/odata/v4/organization";
const REPORTING = "/odata/v4/reporting";
const organizationHeader = "x-organization-id";
const aliceOrganization = "77777777-0000-4000-8000-000000000001";

const today = new Date();
const day = (offset: number) => isoDate(addDays(today, offset));

type Action = [name: string, body: object];
type Row = Record<string, unknown>;

const ids: Record<string, string> = {};

/** Amounts per group as numbers, sorted by group, e.g. [["Alpha GmbH", 1250], ["Beta GmbH", 300]]. */
function byGroup(rows: Row[], group: string, measure: string): [string, number][] {
	return rows
		.map((row): [string, number] => [String(row[group]), Number(row[measure])])
		.sort(([first], [second]) => first.localeCompare(second));
}

/** Creates a draft, fills it and activates it, like the Fiori apps do. */
async function createActive(service: string, entitySet: string, data: object, children: Row[] = []) {
	const serviceName = service === SALES ? "SalesService" : "PurchasingService";
	const draft = await POST(`${service}/${entitySet}`, data, bob);
	expect(draft.status).toBe(201);
	const path = `${service}/${entitySet}(ID=${draft.data.ID},IsActiveEntity=false)`;
	for (const item of children) {
		const created = await POST(`${path}/items`, item, bob);
		expect(created.status).toBe(201);
		// Picking a product fills its default price; the price is then overwritten, as in the app.
		const line = `${SALES}/SalesInvoiceItems(ID=${created.data.ID},IsActiveEntity=false)`;
		expect((await PATCH(line, { unitPrice: item.unitPrice }, bob)).status).toBe(200);
	}
	const saved = await POST(`${path}/${serviceName}.draftActivate`, {}, bob);
	expect(saved.status).toBe(201);
	return saved.data.ID as string;
}

async function expectOk(request: Promise<{ data: unknown; status: number }>) {
	const { data, status } = await request;
	if (status !== 200) {
		throw new Error(`${status}: ${JSON.stringify(data)}`);
	}
}

/** Runs an OData $apply aggregation, as the analytical tables of the Reports app do. */
async function report(entitySet: string, apply: string, user = bob): Promise<Row[]> {
	const { data, status } = await GET(`${REPORTING}/${entitySet}?$apply=${encodeURI(apply)}`, user);
	expect(status).toBe(200);
	return data.value;
}

async function salesInvoice(
	customer: string,
	invoiceDate: string,
	dueDate: string,
	items: Row[],
	actions: Action[] = [],
) {
	const ID = await createActive(SALES, "SalesInvoices", { customer_ID: customer, dueDate, invoiceDate }, items);
	const active = `${SALES}/SalesInvoices(ID=${ID},IsActiveEntity=true)`;
	for (const [action, body] of actions) {
		await expectOk(POST(`${active}/SalesService.${action}`, body, bob));
	}
	return ID;
}

async function supplierInvoice(data: Row, actions: Action[] = []) {
	const ID = await createActive(PURCHASING, "SupplierInvoices", data);
	const active = `${PURCHASING}/SupplierInvoices(ID=${ID},IsActiveEntity=true)`;
	for (const [action, body] of actions) {
		await expectOk(POST(`${active}/PurchasingService.${action}`, body, bob));
	}
	return ID;
}

const period = `filter(invoiceDate ge ${day(-90)} and invoiceDate le ${day(0)})`;

beforeAll(async () => {
	const onboarding = await POST(`${ORGANIZATION}/createOrganization`, { companyName: "Report Test GmbH" }, bob);
	if (onboarding.status !== 200) {
		throw new Error(`Onboarding failed: ${onboarding.status}`);
	}
	const organization_ID = onboarding.data.organizationID;
	await INSERT.into("swiver.Memberships").entries({ organization_ID, role: "TAX_ADVISOR", userId: "carol" });
	// Invoices are only finalized with complete company details.
	await UPDATE("swiver.CompanySettings")
		.set({
			bankName: "Test Bank",
			bic: "TESTDEFFXXX",
			city: "Berlin",
			email: "office@example.com",
			iban: "DE89370400440532013000",
			postalCode: "10115",
			street: "Teststrasse 1",
			vatId: "DE123456789",
			website: "https://example.com",
		})
		.where({ organization_ID });

	const alpha = await createActive(SALES, "Customers", { companyName: "Alpha GmbH" });
	const beta = await createActive(SALES, "Customers", { companyName: "Beta GmbH" });
	const consulting = await createActive(SALES, "ProductServices", { name: "Consulting" });
	const hosting = await createActive(SALES, "ProductServices", { name: "Hosting" });
	const line = (product: null | string, description: string, quantity: number, unitPrice: number) => ({
		description,
		productService_ID: product,
		quantity,
		taxRate: 19,
		unitPrice,
	});

	// Sales: open and not due
	ids.openSale = await salesInvoice(
		alpha,
		day(-5),
		day(9),
		[line(consulting, "Consulting", 2, 100), line(hosting, "Hosting", 1, 50)],
		[["finalize", {}]],
	);
	// Partially paid (190 of 1190), 45 days overdue
	ids.partialSale = await salesInvoice(
		alpha,
		day(-60),
		day(-45),
		[line(consulting, "Consulting", 1, 1000)],
		[
			["finalize", {}],
			["recordPayment", { amount: 190 }],
		],
	);
	// Fully paid, a line without product
	ids.paidSale = await salesInvoice(
		beta,
		day(-20),
		day(-10),
		[line(null, "Workshop", 1, 300)],
		[
			["finalize", {}],
			["markAsPaid", {}],
		],
	);
	// Cancelled
	ids.cancelledSale = await salesInvoice(
		beta,
		day(-15),
		day(-1),
		[line(hosting, "Hosting", 1, 400)],
		[
			["finalize", {}],
			["cancelInvoice", {}],
		],
	);
	// Outside the period, more than 60 days overdue
	ids.oldSale = await salesInvoice(
		beta,
		day(-400),
		day(-390),
		[line(consulting, "Consulting", 1, 700)],
		[["finalize", {}]],
	);
	// Draft
	ids.draftSale = await salesInvoice(alpha, day(-3), day(11), [line(consulting, "Consulting", 1, 999)]);

	// Purchases
	const cloud = await createActive(PURCHASING, "Suppliers", { name: "Cloud Tools AG" });
	const office = await createActive(PURCHASING, "Suppliers", { name: "Office Space KG" });
	const software = await createActive(PURCHASING, "ExpenseCategories", { name: "Software" });
	const coworking = await createActive(PURCHASING, "ExpenseCategories", { name: "Coworking" });
	const purchase = (supplier: string, category: null | string, from: number, due: number, net: number) => ({
		dueDate: day(due),
		expenseCategory_ID: category,
		invoiceDate: day(from),
		invoiceNumber: `P${from}`,
		netAmount: net,
		supplier_ID: supplier,
		taxAmount: net * 0.19,
	});
	ids.openPurchase = await supplierInvoice(purchase(cloud, software, -10, 20, 100));
	// Partially paid (95 of 595), 25 days overdue
	ids.partialPurchase = await supplierInvoice(purchase(office, coworking, -40, -25, 500), [
		["recordPayment", { amount: 95 }],
	]);
	ids.paidPurchase = await supplierInvoice(purchase(cloud, software, -30, -20, 200), [["markInvoicePaid", {}]]);
	// Outside the period, uncategorized, 100 days overdue
	ids.oldPurchase = await supplierInvoice(purchase(office, null, -200, -100, 1000));
});

describe("Sales report", () => {
	it("totals the revenue of the period", async () => {
		const [total] = await report("SalesReport", `${period}/aggregate(netAmount,grossAmount,currency_code)`);

		expect(Number(total.netAmount)).toBe(1550);
		expect(Number(total.grossAmount)).toBe(1844.5);
		expect(total.currency_code).toBe("EUR");
	});

	it("filters by period", async () => {
		const [old] = await report(
			"SalesReport",
			`filter(invoiceDate ge ${day(-410)} and invoiceDate le ${day(-390)})/aggregate(netAmount)`,
		);
		const [all] = await report("SalesReport", "aggregate(netAmount)");

		expect(Number(old.netAmount)).toBe(700);
		expect(Number(all.netAmount)).toBe(2250);
	});

	it("leaves out cancelled invoices and drafts", async () => {
		const invoices = await report("SalesReport", "groupby((invoice_ID))");
		const reported = invoices.map((row) => row.invoice_ID);

		expect(reported).not.toContain(ids.cancelledSale);
		expect(reported).not.toContain(ids.draftSale);
		expect(reported).toEqual(expect.arrayContaining([ids.openSale, ids.partialSale, ids.paidSale, ids.oldSale]));
	});

	it("groups by customer", async () => {
		const rows = await report("SalesReport", `${period}/groupby((customer_ID,customerName),aggregate(netAmount))`);

		expect(byGroup(rows, "customerName", "netAmount")).toEqual([
			["Alpha GmbH", 1250],
			["Beta GmbH", 300],
		]);
	});

	it("groups by product or service, lines without one by their description", async () => {
		const rows = await report("SalesReport", `${period}/groupby((productServiceName),aggregate(netAmount))`);

		expect(byGroup(rows, "productServiceName", "netAmount")).toEqual([
			["Consulting", 1200],
			["Hosting", 50],
			["Workshop", 300],
		]);
	});

	it("groups by month", async () => {
		const rows = await report("SalesReport", `${period}/groupby((month),aggregate(netAmount))`);

		expect(rows.every((row) => /^\d{4}-\d{2}$/.test(String(row.month)))).toBe(true);
		expect(rows.reduce((sum, row) => sum + Number(row.netAmount), 0)).toBe(1550);
	});
});

describe("Purchase report", () => {
	it("totals the purchases of the period and filters by period", async () => {
		const [total] = await report("PurchaseReport", `${period}/aggregate(netAmount,grossAmount)`);
		const [all] = await report("PurchaseReport", "aggregate(netAmount)");

		expect(Number(total.netAmount)).toBe(800);
		expect(Number(total.grossAmount)).toBe(952);
		expect(Number(all.netAmount)).toBe(1800);
	});

	it("groups by supplier", async () => {
		const rows = await report("PurchaseReport", `${period}/groupby((supplier_ID,supplierName),aggregate(netAmount))`);

		expect(byGroup(rows, "supplierName", "netAmount")).toEqual([
			["Cloud Tools AG", 300],
			["Office Space KG", 500],
		]);
	});

	it("groups by expense category", async () => {
		const rows = await report("PurchaseReport", "groupby((expenseCategoryName),aggregate(netAmount))");

		expect(byGroup(rows, "expenseCategoryName", "netAmount")).toEqual([
			["Coworking", 500],
			["null", 1000],
			["Software", 300],
		]);
	});
});

describe("Open items report", () => {
	const receivables = "filter(kind eq 'RECEIVABLE')";
	const payables = "filter(kind eq 'PAYABLE')";

	it("totals the open and overdue receivables, separate from the payables", async () => {
		const [receivable] = await report("OpenItems", `${receivables}/aggregate(outstandingAmount,overdueAmount)`);
		const [payable] = await report("OpenItems", `${payables}/aggregate(outstandingAmount,overdueAmount)`);

		expect(Number(receivable.outstandingAmount)).toBe(2130.5);
		expect(Number(receivable.overdueAmount)).toBe(1833);
		expect(Number(payable.outstandingAmount)).toBe(1809);
		expect(Number(payable.overdueAmount)).toBe(1690);
	});

	it("lists only the sales invoices as receivables and only the supplier invoices as payables", async () => {
		const receivableIDs = (await report("OpenItems", `${receivables}/groupby((ID))`)).map((row) => row.ID);
		const payableIDs = (await report("OpenItems", `${payables}/groupby((ID))`)).map((row) => row.ID);

		expect(receivableIDs.sort()).toEqual([ids.openSale, ids.partialSale, ids.oldSale].sort());
		expect(payableIDs.sort()).toEqual([ids.openPurchase, ids.partialPurchase, ids.oldPurchase].sort());
	});

	it("shows the open amount of a partially paid invoice", async () => {
		const { data } = await GET(`${REPORTING}/OpenItems(${ids.partialSale})`, bob);

		expect(Number(data.grossAmount)).toBe(1190);
		expect(Number(data.paidAmount)).toBe(190);
		expect(Number(data.outstandingAmount)).toBe(1000);
	});

	it("leaves out fully paid and cancelled invoices", async () => {
		for (const id of [ids.paidSale, ids.cancelledSale, ids.draftSale, ids.paidPurchase]) {
			expect((await GET(`${REPORTING}/OpenItems(${id})`, bob)).status).toBe(404);
		}
	});

	it("calculates the overdue days and aging bucket", async () => {
		const items = await report("OpenItems", "groupby((ID,daysOverdue,agingBucket,agingBucketText,overdueAmount))");
		const item = (id: string) => items.find((row) => row.ID === id);

		expect(item(ids.openSale)).toMatchObject({ agingBucket: 0, agingBucketText: "Not due", daysOverdue: 0 });
		expect(Number(item(ids.openSale)?.overdueAmount)).toBe(0);
		expect(item(ids.partialPurchase)).toMatchObject({ agingBucket: 1, daysOverdue: 25 });
		expect(item(ids.partialSale)).toMatchObject({ agingBucket: 2, daysOverdue: 45 });
		expect(Number(item(ids.partialSale)?.overdueAmount)).toBe(1000);
		expect(item(ids.oldSale)).toMatchObject({ agingBucket: 3, agingBucketText: "More than 60 days overdue" });
	});

	it("totals the receivables per aging bucket", async () => {
		const rows = await report("OpenItems", `${receivables}/groupby((agingBucket),aggregate(outstandingAmount))`);

		expect(byGroup(rows, "agingBucket", "outstandingAmount")).toEqual([
			["0", 297.5],
			["2", 1000],
			["3", 833],
		]);
	});
});

describe("Organization isolation", () => {
	it.each([["SalesReport"], ["PurchaseReport"], ["OpenItems"]])(
		"shows bob none of alice's rows in %s",
		async (entitySet) => {
			const rows = await report(entitySet, "groupby((organization_ID))");

			expect(rows.map((row) => row.organization_ID)).not.toContain(aliceOrganization);
			expect(rows).toHaveLength(1);
		},
	);

	it("does not reveal alice's figures to bob through a filter on her organization", async () => {
		const rows = await report("SalesReport", `filter(organization_ID eq ${aliceOrganization})/aggregate(netAmount)`);

		expect(rows.every((row) => row.netAmount === null || Number(row.netAmount) === 0)).toBe(true);
	});

	it("shows alice none of bob's invoices", async () => {
		const items = (await report("OpenItems", "groupby((ID))", alice)).map((row) => row.ID);

		expect(items).not.toContain(ids.openSale);
		expect(items).not.toContain(ids.openPurchase);
		expect((await GET(`${REPORTING}/OpenItems(${ids.openSale})`, alice)).status).toBe(404);
	});

	it("ignores bob's request for alice's organization and stays in his own", async () => {
		const { data, status } = await GET(`${REPORTING}/OpenItems?$apply=groupby((organization_ID))`, {
			...bob,
			headers: { [organizationHeader]: aliceOrganization },
		});

		expect(status).toBe(200);
		expect(data.value.map((row: Row) => row.organization_ID)).not.toContain(aliceOrganization);
	});
});

describe("Tax advisor", () => {
	it("reads the reports of the organization they advise", async () => {
		const [sales] = await report("SalesReport", `${period}/aggregate(netAmount)`, carol);
		const [open] = await report("OpenItems", "filter(kind eq 'PAYABLE')/aggregate(outstandingAmount)", carol);

		expect(Number(sales.netAmount)).toBe(1550);
		expect(Number(open.outstandingAmount)).toBe(1809);
	});

	it("cannot change report data", async () => {
		expect([403, 405]).toContain((await POST(`${REPORTING}/SalesReport`, { netAmount: 1 }, carol)).status);
	});
});
