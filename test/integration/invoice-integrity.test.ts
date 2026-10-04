import { describe, expect, it } from "@jest/globals";
import cds from "@sap/cds";

/**
 * Financial integrity of sales invoices: unique numbers under concurrency, immutability of issued
 * invoices against direct OData requests, idempotent lifecycle actions, payments and bank matches,
 * and the cancellation/correction flow. Uses the test data of organization "Nordwind" (alice).
 */
const projectRootDir = __dirname + "../../..";
const { axios, DELETE, GET, PATCH, POST } = cds.test("serve", "--project", projectRootDir);

axios.defaults.auth = { password: "alice", username: "alice" };
axios.defaults.validateStatus = () => true;

const SALES = "/odata/v4/sales";
const FINANCE = "/odata/v4/finance";
const customerID = "33333333-0000-4000-8000-000000000001";
const finalizedUnpaid = "44444444-0000-4000-8000-000000000005";

type Invoice = Record<string, unknown> & { ID: string; invoiceNumber: string };

const active = (id: string) => `${SALES}/SalesInvoices(ID=${id},IsActiveEntity=true)`;
const action = (id: string, name: string) => `${active(id)}/SalesService.${name}`;

async function createFinalized(): Promise<Invoice> {
	const invoice = await createInvoice();
	expect((await POST(action(invoice.ID, "finalize"), {})).status).toBe(200);
	return invoice;
}

/** Creates and saves a draft invoice with one item, like the Fiori app does. */
async function createInvoice(invoiceDate?: string): Promise<Invoice> {
	const draft = await POST(`${SALES}/SalesInvoices`, { customer_ID: customerID, invoiceDate });
	expect(draft.status).toBe(201);
	const id = draft.data.ID;
	await POST(`${SALES}/SalesInvoices(ID=${id},IsActiveEntity=false)/items`, {
		description: "Consulting",
		quantity: 2,
		taxRate: 19,
		unitPrice: 100,
	});
	const saved = await POST(`${SALES}/SalesInvoices(ID=${id},IsActiveEntity=false)/SalesService.draftActivate`, {});
	expect(saved.status).toBe(201);
	return saved.data;
}

async function paymentCount(id: string): Promise<number> {
	const { data } = await GET(`${SALES}/Payments?$filter=salesInvoice_ID eq ${id}&$count=true&$top=0`);
	return data["@odata.count"];
}

async function read(id: string): Promise<Invoice> {
	return (await GET(`${active(id)}?$expand=items`)).data;
}

describe("Invoice numbering", () => {
	it("gives parallel saves different numbers", async () => {
		const invoices = await Promise.all(Array.from({ length: 8 }, () => createInvoice()));
		const numbers = invoices.map((invoice) => invoice.invoiceNumber);

		expect(new Set(numbers).size).toBe(numbers.length);
		expect(numbers.every((number) => /^INV-\d{4}-\d{4}$/.test(number))).toBe(true);
	});

	it("starts a new year's range safely when the first invoices of that year are saved in parallel", async () => {
		const invoices = await Promise.all(Array.from({ length: 4 }, () => createInvoice("2031-01-15")));
		const numbers = invoices.map((invoice) => invoice.invoiceNumber).sort();

		expect(numbers).toEqual(["INV-2031-0001", "INV-2031-0002", "INV-2031-0003", "INV-2031-0004"]);
	});

	it("does not let the client choose or change an invoice number", async () => {
		const draft = await POST(`${SALES}/SalesInvoices`, { customer_ID: customerID, invoiceNumber: "HACK-1" });
		expect(draft.data.invoiceNumber ?? null).toBeNull();
		const invoice = await createInvoice();
		await POST(`${active(invoice.ID)}/SalesService.draftEdit`, {});
		await PATCH(`${SALES}/SalesInvoices(ID=${invoice.ID},IsActiveEntity=false)`, { invoiceNumber: "INV-1999-0001" });
		await POST(`${SALES}/SalesInvoices(ID=${invoice.ID},IsActiveEntity=false)/SalesService.draftActivate`, {});

		expect((await read(invoice.ID)).invoiceNumber).toBe(invoice.invoiceNumber);
	});
});

describe("Issued invoices", () => {
	it("cannot be edited, deleted or changed through their items", async () => {
		const invoice = await createFinalized();
		const before = await read(invoice.ID);
		const itemID = (before.items as { ID: string }[])[0].ID;

		const attempts = await Promise.all([
			POST(`${active(invoice.ID)}/SalesService.draftEdit`, {}),
			PATCH(active(invoice.ID), { grossAmount: 1, notes: "changed" }),
			DELETE(active(invoice.ID)),
			PATCH(`${SALES}/SalesInvoiceItems(ID=${itemID},IsActiveEntity=true)`, { unitPrice: 1 }),
			DELETE(`${SALES}/SalesInvoiceItems(ID=${itemID},IsActiveEntity=true)`),
			POST(`${active(invoice.ID)}/items`, { description: "extra", quantity: 1, taxRate: 19, unitPrice: 1 }),
		]);

		for (const attempt of attempts) {
			expect(attempt.status).toBeGreaterThanOrEqual(400);
		}
		const after = await read(invoice.ID);
		expect(after).toMatchObject({
			grossAmount: before.grossAmount,
			invoiceNumber: before.invoiceNumber,
			status_code: "FINALIZED",
		});
		expect(after.items).toEqual(before.items);
	});

	it("rejects a second finalize and treats a repeated 'mark as sent' as no change", async () => {
		const invoice = await createFinalized();

		expect((await POST(action(invoice.ID, "finalize"), {})).status).toBe(409);
		expect((await POST(action(invoice.ID, "markAsSent"), {})).status).toBe(200);
		const sent = await read(invoice.ID);
		expect((await POST(action(invoice.ID, "markAsSent"), {})).status).toBe(200);
		expect(await read(invoice.ID)).toMatchObject({ ...sent, modifiedAt: expect.any(String) });
	});

	it("finalizes only once when finalize is requested in parallel", async () => {
		const invoice = await createInvoice();
		const results = await Promise.all([
			POST(action(invoice.ID, "finalize"), {}),
			POST(action(invoice.ID, "finalize"), {}),
		]);

		expect(results.map((result) => result.status).sort()).toEqual([200, 409]);
	});
});

describe("Payments", () => {
	it("records only one payment when 'mark as paid' is sent twice in parallel", async () => {
		const invoice = await createFinalized();
		const results = await Promise.all([
			POST(action(invoice.ID, "markAsPaid"), {}),
			POST(action(invoice.ID, "markAsPaid"), {}),
		]);

		expect(results.filter((result) => result.status === 200)).toHaveLength(1);
		expect(await paymentCount(invoice.ID)).toBe(1);
		expect((await read(invoice.ID)).paymentStatus_code).toBe("PAID");
	});

	it("never accepts more than the open amount", async () => {
		const invoice = await createFinalized();
		const results = await Promise.all([
			POST(action(invoice.ID, "recordPayment"), { amount: 200 }),
			POST(action(invoice.ID, "recordPayment"), { amount: 200 }),
		]);

		// 238.00 open: the first payment of 200.00 is accepted, the second would exceed the rest
		expect(results.map((result) => result.status).sort()).toEqual([200, 400]);
		const { paidAmount } = await read(invoice.ID);
		expect(Number(paidAmount)).toBe(200);
		expect(await paymentCount(invoice.ID)).toBe(1);
	});

	it("rejects payments for drafts", async () => {
		const invoice = await createInvoice();
		expect((await POST(action(invoice.ID, "markAsPaid"), {})).status).toBe(409);
	});

	it("records one payment when the same bank match is confirmed twice", async () => {
		const transaction = "88888888-0000-4000-8000-000000000002";
		const url = `${FINANCE}/BankTransactions(ID=${transaction})/FinanceService.confirmMatch`;
		const results = await Promise.all([POST(url, {}), POST(url, {})]);

		expect(results.filter((result) => result.status === 200)).toHaveLength(1);
		expect(await paymentCount("44444444-0000-4000-8000-000000000007")).toBe(1);
		expect((await POST(url, {})).status).toBe(409);
	});
});

describe("Cancellation and correction", () => {
	it("keeps the original issued invoice unchanged and links the correction to it", async () => {
		const before = await read(finalizedUnpaid);
		const correction = await POST(action(finalizedUnpaid, "correct"), {});
		expect(correction.status).toBe(200);

		const original = await read(finalizedUnpaid);
		expect(original).toMatchObject({
			grossAmount: before.grossAmount,
			invoiceNumber: before.invoiceNumber,
			status_code: "CANCELLED",
		});
		expect(original.items).toEqual(before.items);
		expect(correction.data).toMatchObject({ replacesInvoice_ID: finalizedUnpaid, status_code: "DRAFT" });
	});

	it("creates only one correction, even before the first correction is saved", async () => {
		expect((await POST(action(finalizedUnpaid, "correct"), {})).status).toBe(409);
	});

	it("cannot reopen a cancelled invoice by finalizing it", async () => {
		expect((await POST(action(finalizedUnpaid, "finalize"), {})).status).toBe(409);
		expect((await POST(action(finalizedUnpaid, "markAsPaid"), {})).status).toBe(409);
	});
});

describe("Invoice footer", () => {
	const ORGANIZATION = "/odata/v4/organization";
	const settings = (active: boolean) => `${ORGANIZATION}/CompanySettings(ID=1,IsActiveEntity=${active})`;

	async function changeSettings(data: object) {
		await POST(`${settings(true)}/OrganizationService.draftEdit`, {});
		await PATCH(settings(false), data);
		await POST(`${settings(false)}/OrganizationService.draftActivate`, {});
	}

	it("blocks finalizing until the company details printed in the footer are complete", async () => {
		const { data: current } = await GET(settings(true));
		const invoice = await createInvoice();
		await changeSettings({ bic: null, website: "" });

		const blocked = await POST(action(invoice.ID, "finalize"), {});
		expect(blocked.status).toBe(400);
		expect(blocked.data.error.message).toContain("BIC");
		expect(blocked.data.error.message).toContain("website");
		expect((await read(invoice.ID)).status_code).toBe("DRAFT");

		await changeSettings({ bic: current.bic, website: current.website });
		expect((await POST(action(invoice.ID, "finalize"), {})).status).toBe(200);
	});
});

describe("Invoice items", () => {
	const product = "99999999-0000-4000-8000-000000000001";

	it("take description, unit, price and VAT rate from the product, also when it comes with the new line", async () => {
		const draft = await POST(`${SALES}/SalesInvoices`, { customer_ID: customerID });
		const items = `${SALES}/SalesInvoices(ID=${draft.data.ID},IsActiveEntity=false)/items`;

		const created = await POST(items, { productService_ID: product });
		expect(created.data).toMatchObject({
			description: "SAP BTP Consulting",
			taxRate: "19",
			unit: "day",
			unitPrice: "1000.00",
		});

		const empty = await POST(items, {});
		const picked = await PATCH(`${SALES}/SalesInvoiceItems(ID=${empty.data.ID},IsActiveEntity=false)`, {
			productService_ID: product,
		});
		expect(picked.data).toMatchObject({ description: "SAP BTP Consulting", unitPrice: "1000.00" });
	});
});

describe("Links kept on saving", () => {
	it("keeps the correction link after the correction is saved, so the original is corrected only once", async () => {
		const original = await createFinalized();
		const correction = await POST(action(original.ID, "correct"), {});
		const draft = `${SALES}/SalesInvoices(ID=${correction.data.ID},IsActiveEntity=false)`;
		await PATCH(draft, { replacesInvoice_ID: null });
		const saved = await POST(`${draft}/SalesService.draftActivate`, {});

		expect(saved.data.replacesInvoice_ID).toBe(original.ID);
		expect((await POST(action(saved.data.ID, "finalize"), {})).status).toBe(200);
		expect((await POST(action(original.ID, "correct"), {})).status).toBe(409);

		const xml = await GET(`${active(saved.data.ID)}/SalesService.zugferd(download=true)`, {
			responseType: "arraybuffer",
		});
		expect(xml.status).toBe(200);
	});

	it("keeps the quote link on the saved invoice and frees the quote when the draft is discarded", async () => {
		const quote = await POST(`${SALES}/Quotes`, { customer_ID: customerID });
		const quoteDraft = `${SALES}/Quotes(ID=${quote.data.ID},IsActiveEntity=false)`;
		await POST(`${quoteDraft}/items`, { description: "Workshop", quantity: 1, taxRate: 19, unitPrice: 500 });
		await POST(`${quoteDraft}/SalesService.draftActivate`, {});
		const convert = `${SALES}/Quotes(ID=${quote.data.ID},IsActiveEntity=true)/SalesService.convertToInvoice`;

		const first = await POST(convert, {});
		expect(first.status).toBe(200);
		await DELETE(`${SALES}/SalesInvoices(ID=${first.data.ID},IsActiveEntity=false)`);

		const second = await POST(convert, {});
		expect(second.status).toBe(200);
		const saved = await POST(
			`${SALES}/SalesInvoices(ID=${second.data.ID},IsActiveEntity=false)/SalesService.draftActivate`,
			{},
		);
		expect(saved.data.quote_ID).toBe(quote.data.ID);

		expect((await POST(convert, {})).status).toBe(409);
	});
});
