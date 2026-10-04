import { beforeAll, describe, expect, it } from "@jest/globals";
import cds from "@sap/cds";

import { addDays, isoDate } from "../../srv/core/dates";

const projectRootDir = __dirname + "../../..";
const { axios, GET, PATCH, POST } = cds.test("serve", "--project", projectRootDir);

axios.defaults.auth = { password: "alice", username: "alice" };
axios.defaults.validateStatus = () => true;

const SERVICE = "/odata/v4/purchasing";
const FINANCE = "/odata/v4/finance";
const today = new Date();

type Invoice = Record<string, unknown> & { ID: string };

/** Creates a draft, fills it and activates it, like the Fiori app does. */
async function createActive(entitySet: string, data: object) {
	const draft = await POST(`${SERVICE}/${entitySet}`, data);
	if (draft.status !== 201) {
		return draft;
	}
	return POST(`${SERVICE}/${entitySet}(ID=${draft.data.ID},IsActiveEntity=false)/PurchasingService.draftActivate`, {});
}

async function readInvoice(id: string): Promise<Invoice> {
	const { data } = await GET(`${SERVICE}/SupplierInvoices(ID=${id},IsActiveEntity=true)`);
	return data;
}

describe("PurchasingService", () => {
	let supplierID: string;

	beforeAll(async () => {
		const { data } = await createActive("Suppliers", { name: "Test Supplier GmbH" });
		supplierID = data.ID;
	});

	it("creates a supplier", async () => {
		const { data, status } = await createActive("Suppliers", { city: "Hamburg", name: "Druckerei Weber KG" });

		expect(status).toBe(201);
		expect(data).toMatchObject({ active: true, city: "Hamburg", createdBy: "alice", name: "Druckerei Weber KG" });
	});

	it("creates an invoice with a calculated gross amount", async () => {
		const { data, status } = await createActive("SupplierInvoices", {
			dueDate: isoDate(addDays(today, 14)),
			invoiceDate: isoDate(today),
			invoiceNumber: "T-001",
			netAmount: 100,
			supplier_ID: supplierID,
			taxAmount: 19,
		});

		expect(status).toBe(201);
		const invoice = await readInvoice(data.ID);
		expect(invoice).toMatchObject({ currency_code: "EUR", paymentStatus_code: "OPEN", status: "Open" });
		expect(Number(invoice.grossAmount)).toBe(119);
	});

	it.each([
		{ change: { supplier_ID: undefined }, reason: "without supplier" },
		{ change: { invoiceNumber: undefined }, reason: "without invoice number" },
		{ change: { netAmount: -5 }, reason: "with a negative amount" },
		{ change: { dueDate: isoDate(addDays(today, -1)) }, reason: "with a due date before the invoice date" },
	])("rejects an invoice $reason", async ({ change }) => {
		const { status } = await createActive("SupplierInvoices", {
			dueDate: isoDate(addDays(today, 14)),
			invoiceDate: isoDate(today),
			invoiceNumber: "T-INVALID",
			netAmount: 100,
			supplier_ID: supplierID,
			taxAmount: 19,
			...change,
		});

		expect(status).toBe(400);
	});

	describe("payment", () => {
		let invoiceID: string;

		beforeAll(async () => {
			const { data } = await createActive("SupplierInvoices", {
				dueDate: isoDate(addDays(today, 7)),
				invoiceDate: isoDate(today),
				invoiceNumber: "T-PAY",
				netAmount: 50,
				supplier_ID: supplierID,
			});
			invoiceID = data.ID;
		});

		it("marks an invoice as paid today", async () => {
			const { status } = await POST(
				`${SERVICE}/SupplierInvoices(ID=${invoiceID},IsActiveEntity=true)/PurchasingService.markInvoicePaid`,
				{},
			);

			expect(status).toBe(200);
			expect(await readInvoice(invoiceID)).toMatchObject({
				paymentDate: isoDate(today),
				paymentStatus_code: "PAID",
				status: "Paid",
			});
		});

		it("removes the manual payment, so the invoice is open again", async () => {
			const { status } = await POST(
				`${SERVICE}/SupplierInvoices(ID=${invoiceID},IsActiveEntity=true)/PurchasingService.markInvoiceOpen`,
				{},
			);

			expect(status).toBe(200);
			expect(await readInvoice(invoiceID)).toMatchObject({
				paymentDate: null,
				paymentStatus_code: "OPEN",
				status: "Open",
			});
		});

		it("does not let users set the payment status directly", async () => {
			await POST(`${SERVICE}/SupplierInvoices(ID=${invoiceID},IsActiveEntity=true)/PurchasingService.draftEdit`, {});
			await PATCH(`${SERVICE}/SupplierInvoices(ID=${invoiceID},IsActiveEntity=false)`, { paymentStatus_code: "PAID" });
			await POST(
				`${SERVICE}/SupplierInvoices(ID=${invoiceID},IsActiveEntity=false)/PurchasingService.draftActivate`,
				{},
			);

			expect(await readInvoice(invoiceID)).toMatchObject({ paymentStatus_code: "OPEN" });
		});
	});

	it("lists unpaid invoices and matches the dashboard", async () => {
		const { data: open } = await GET(
			`${SERVICE}/SupplierInvoices?$filter=paymentStatus_code ne 'PAID' and IsActiveEntity eq true&$count=true&$top=0`,
		);
		const { data: dashboard } = await GET(`${FINANCE}/dashboard()`);

		expect(open["@odata.count"]).toBeGreaterThan(0);
		expect(dashboard.payables.open.count).toBe(open["@odata.count"]);
	});

	it("derives overdue from the due date and payment status", async () => {
		const { data: before } = await GET(`${FINANCE}/dashboard()`);
		const { data: overdue } = await createActive("SupplierInvoices", {
			dueDate: isoDate(addDays(today, -1)),
			invoiceDate: isoDate(addDays(today, -10)),
			invoiceNumber: "T-OVERDUE",
			netAmount: 10,
			supplier_ID: supplierID,
		});
		const { data: dueToday } = await createActive("SupplierInvoices", {
			dueDate: isoDate(today),
			invoiceDate: isoDate(addDays(today, -10)),
			invoiceNumber: "T-DUE-TODAY",
			netAmount: 10,
			supplier_ID: supplierID,
		});

		expect(await readInvoice(overdue.ID)).toMatchObject({ status: "Overdue", statusCriticality: 1 });
		expect(await readInvoice(dueToday.ID)).toMatchObject({ status: "Open" });

		const { data: after } = await GET(`${FINANCE}/dashboard()`);
		expect(after.payables.overdue.count).toBe(before.payables.overdue.count + 1);
		expect(after.payables.dueNext7Days.count).toBe(before.payables.dueNext7Days.count + 1);

		await POST(
			`${SERVICE}/SupplierInvoices(ID=${overdue.ID},IsActiveEntity=true)/PurchasingService.markInvoicePaid`,
			{},
		);
		expect(await readInvoice(overdue.ID)).toMatchObject({ status: "Paid", statusCriticality: 3 });
	});

	it("rejects documents that are not PDF, PNG or JPEG", async () => {
		const { data: invoices } = await GET(`${SERVICE}/SupplierInvoices?$filter=IsActiveEntity eq true&$top=1`);
		const url = `${SERVICE}/SupplierInvoices(ID=${invoices.value[0].ID},IsActiveEntity=true)/documentContent`;

		const rejected = await axios.put(url, "text", { headers: { "Content-Type": "text/plain" } });
		const accepted = await axios.put(url, "%PDF-1.4", { headers: { "Content-Type": "application/pdf" } });

		expect(rejected.status).toBe(415);
		expect(accepted.status).toBe(204);
	});

	// Full cross-organization coverage: tenant-isolation.test.ts
	it("refuses users without an organization", async () => {
		const asBob = { auth: { password: "bob", username: "bob" } };
		const { data: invoices } = await GET(`${SERVICE}/SupplierInvoices?$top=1`);
		const own = await GET(`${SERVICE}/SupplierInvoices?$count=true&$top=0`, asBob);
		const foreign = await GET(
			`${SERVICE}/SupplierInvoices(ID=${invoices.value[0].ID},IsActiveEntity=true)/documentContent`,
			asBob,
		);

		expect(own.status).toBe(403);
		expect([403, 404]).toContain(foreign.status);
	});

	it("updates the payment status when the amounts of a paid invoice are corrected", async () => {
		const { data } = await createActive("SupplierInvoices", {
			dueDate: isoDate(addDays(today, 14)),
			invoiceDate: isoDate(today),
			invoiceNumber: "T-CORRECTED",
			netAmount: 100,
			supplier_ID: supplierID,
			taxAmount: 19,
		});
		await POST(`${SERVICE}/SupplierInvoices(ID=${data.ID},IsActiveEntity=true)/PurchasingService.markInvoicePaid`, {});
		expect(await readInvoice(data.ID)).toMatchObject({ paymentStatus_code: "PAID" });

		await POST(`${SERVICE}/SupplierInvoices(ID=${data.ID},IsActiveEntity=true)/PurchasingService.draftEdit`, {});
		await PATCH(`${SERVICE}/SupplierInvoices(ID=${data.ID},IsActiveEntity=false)`, { netAmount: 200, taxAmount: 38 });
		await POST(`${SERVICE}/SupplierInvoices(ID=${data.ID},IsActiveEntity=false)/PurchasingService.draftActivate`, {});

		expect(await readInvoice(data.ID)).toMatchObject({ paymentStatus_code: "PARTIAL" });
	});
});
