import { beforeAll, describe, expect, it } from "@jest/globals";
import cds from "@sap/cds";

/**
 * Goods and stock: the purchase, sale and return of a stock-tracked product through the business
 * actions, without double bookings, and services that never touch stock. Bob (his own organization)
 * and the tax advisor try to read or book alice's stock.
 */
const projectRootDir = __dirname + "../../..";
const { axios, DELETE, GET, PATCH, POST } = cds.test("serve", "--project", projectRootDir);

axios.defaults.validateStatus = () => true;
const alice = { auth: { password: "alice", username: "alice" } };
const bob = { auth: { password: "bob", username: "bob" } };
const advisor = { auth: { password: "steuerberater", username: "steuerberater@example.de" } };

const SALES = "/odata/v4/sales";
const PURCHASING = "/odata/v4/purchasing";
const INVENTORY = "/odata/v4/inventory";
const ORGANIZATION = "/odata/v4/organization";

const customer = "33333333-0000-4000-8000-000000000001";
const supplier = "11111111-0000-4000-8000-000000000001";
const consulting = "99999999-0000-4000-8000-000000000001";

const ids = { deliveryNote: "", dock: "", dropship: "", invoice: "", macbook: "", macbookReceipt: "", quote: "" };

const active = (entitySet: string, id: string) => `${entitySet}(ID=${id},IsActiveEntity=true)`;

async function activate(service: string, name: string, entitySet: string, id: string, user = alice) {
	const saved = await POST(`${service}/${entitySet}(ID=${id},IsActiveEntity=false)/${name}.draftActivate`, {}, user);
	return saved;
}

async function createActive(service: string, entitySet: string, data: object, user = alice) {
	const name = service === SALES ? "SalesService" : "PurchasingService";
	const draft = await POST(`${service}/${entitySet}`, data, user);
	expect(draft.status).toBe(201);
	return activate(service, name, entitySet, draft.data.ID, user);
}

async function stock(product: string, user = alice): Promise<number> {
	const { data } = await GET(`${INVENTORY}/Products(${product})?$select=stockOnHand`, user);
	return Number(data.stockOnHand);
}

async function supplierInvoice(invoiceNumber: string, items: object[]) {
	const saved = await createActive(PURCHASING, "SupplierInvoices", {
		invoiceDate: "2026-10-01",
		invoiceNumber,
		items,
		netAmount: 0,
		supplier_ID: supplier,
	});
	expect(saved.status).toBe(201);
	return saved.data;
}

beforeAll(async () => {
	const product = async (data: object) =>
		(await createActive(SALES, "ProductServices", { type_code: "GOODS", unit: "piece", ...data })).data.ID;
	ids.macbook = await product({ defaultPrice: 1800, name: "MacBook Pro", purchasePrice: 1350, reorderLevel: 5, trackStock: true });
	ids.dock = await product({ defaultPrice: 120, name: "USB-C Dock", purchasePrice: 80, reorderLevel: 10, trackStock: true });
	ids.dropship = await product({ defaultPrice: 50, name: "Drop-shipped cable", trackStock: false });
});

describe("Products", () => {
	it("keeps existing products as services without stock", async () => {
		const { data } = await GET(`${SALES}/${active("ProductServices", consulting)}`, alice);
		expect(data).toMatchObject({ isStockTracked: false, trackStock: false, type_code: "SERVICE" });
		expect((await GET(`${INVENTORY}/Products(${consulting})`, alice)).status).toBe(404);
		expect((await POST(`${INVENTORY}/Products(${consulting})/InventoryService.adjustStock`, { quantity: 5, reason: "Count" }, alice)).status).toBe(404);
	});

	it("only lets goods track stock", async () => {
		const draft = await POST(`${SALES}/ProductServices`, { name: "Training", trackStock: true, type_code: "SERVICE" }, alice);
		const saved = await activate(SALES, "SalesService", "ProductServices", draft.data.ID);
		expect(saved.status).toBe(400);
		expect(JSON.stringify(saved.data)).toContain("STOCK_TRACKING_ONLY_FOR_GOODS");
	});

	it("keeps goods without stock tracking out of the inventory", async () => {
		expect((await GET(`${INVENTORY}/Products(${ids.dropship})`, alice)).status).toBe(404);
		const items = [{ description: "Cable", productService_ID: ids.dropship, quantity: 3, unitPrice: 10 }];
		const invoice = await supplierInvoice("DS-1", items);
		const receipt = await POST(`${PURCHASING}/${active("SupplierInvoices", invoice.ID)}/PurchasingService.bookGoodsReceipt`, {}, alice);
		expect(receipt.status).toBe(200);
		expect((await GET(`${INVENTORY}/StockMovements?$filter=product_ID eq ${ids.dropship}`, alice)).data.value).toHaveLength(0);
	});
});

describe("Supplier invoices and goods receipt", () => {
	it("still saves expenses without items, with the amounts entered by hand", async () => {
		const saved = await createActive(PURCHASING, "SupplierInvoices", {
			invoiceDate: "2026-10-01",
			invoiceNumber: "TAX-2026-10",
			netAmount: 400,
			supplier_ID: supplier,
			taxAmount: 76,
		});
		expect(saved.status).toBe(201);
		expect(saved.data).toMatchObject({ grossAmount: "476.00", netAmount: "400.00", taxAmount: "76.00" });
	});

	it("calculates an invoice with product items from the items", async () => {
		const invoice = await supplierInvoice("LAP-1", [
			{ description: "MacBook Pro", productService_ID: ids.macbook, quantity: 10, taxRate: 19, unitPrice: 1350 },
		]);
		ids.macbookReceipt = invoice.ID;
		expect(invoice).toMatchObject({ grossAmount: "16065.00", netAmount: "13500.00", taxAmount: "2565.00" });
		expect(await stock(ids.macbook)).toBe(0);
	});

	it("books the received quantity into stock exactly once", async () => {
		const url = `${PURCHASING}/${active("SupplierInvoices", ids.macbookReceipt)}/PurchasingService.bookGoodsReceipt`;
		expect((await POST(url, {}, alice)).status).toBe(200);
		expect(await stock(ids.macbook)).toBe(10);
		expect((await POST(url, {}, alice)).status).toBe(200);
		expect(await stock(ids.macbook)).toBe(10);
		const { data } = await GET(`${INVENTORY}/StockMovements?$filter=product_ID eq ${ids.macbook}`, alice);
		expect(data.value).toMatchObject([{ quantity: "10", supplierInvoice_ID: ids.macbookReceipt, type_code: "GOODS_RECEIPT" }]);
	});

	it("receives part of an item and never more than invoiced", async () => {
		const invoice = await supplierInvoice("DOCK-1", [
			{ description: "USB-C Dock", productService_ID: ids.dock, quantity: 10, unitPrice: 80 },
		]);
		const item = (await GET(`${PURCHASING}/${active("SupplierInvoices", invoice.ID)}/items`, alice)).data.value[0];
		const receive = `${PURCHASING}/${active("SupplierInvoiceItems", item.ID)}/PurchasingService.receiveGoods`;
		expect((await POST(receive, { quantity: 6 }, alice)).status).toBe(200);
		expect((await POST(receive, { quantity: 5 }, alice)).status).toBe(409);
		expect((await POST(receive, { quantity: 0 }, alice)).status).toBe(400);
		const rest = await POST(`${PURCHASING}/${active("SupplierInvoices", invoice.ID)}/PurchasingService.bookGoodsReceipt`, {}, alice);
		expect(rest.status).toBe(200);
		expect(await stock(ids.dock)).toBe(10);
	});

	it("keeps received quantities when the invoice is edited, and protects received items", async () => {
		const invoice = `${PURCHASING}/${active("SupplierInvoices", ids.macbookReceipt)}`;
		expect((await POST(`${invoice}/PurchasingService.draftEdit`, {}, alice)).status).toBe(201);
		const draft = `${PURCHASING}/SupplierInvoices(ID=${ids.macbookReceipt},IsActiveEntity=false)`;
		const item = (await GET(`${draft}/items`, alice)).data.value[0];
		await PATCH(`${PURCHASING}/SupplierInvoiceItems(ID=${item.ID},IsActiveEntity=false)`, { quantity: 4, receivedQuantity: 0 }, alice);
		expect((await POST(`${draft}/PurchasingService.draftActivate`, {}, alice)).status).toBe(409);
		await PATCH(`${PURCHASING}/SupplierInvoiceItems(ID=${item.ID},IsActiveEntity=false)`, { quantity: 10 }, alice);
		expect((await POST(`${draft}/PurchasingService.draftActivate`, {}, alice)).status).toBe(200);
		const saved = (await GET(`${invoice}/items`, alice)).data.value[0];
		expect(Number(saved.receivedQuantity)).toBe(10);
		await POST(`${invoice}/PurchasingService.bookGoodsReceipt`, {}, alice);
		expect(await stock(ids.macbook)).toBe(10);
	});
});

describe("Sale: quote, delivery note, invoice, payment", () => {
	it("creates a delivery note with the goods of a quote and the customer's address", async () => {
		const quote = await createActive(SALES, "Quotes", {
			customer_ID: customer,
			items: [
				{ description: "MacBook Pro", productService_ID: ids.macbook, quantity: 2, unitPrice: 1800 },
				{ description: "Setup", productService_ID: consulting, quantity: 1, unitPrice: 1000 },
			],
			quoteDate: "2026-10-02",
		});
		expect(quote.status).toBe(201);
		ids.quote = quote.data.ID;
		const created = await POST(`${SALES}/${active("Quotes", ids.quote)}/SalesService.createDeliveryNote`, {}, alice);
		expect(created.status).toBe(200);
		const draft = `${SALES}/DeliveryNotes(ID=${created.data.ID},IsActiveEntity=false)`;
		const items = (await GET(`${draft}/items`, alice)).data.value;
		expect(items).toMatchObject([{ productService_ID: ids.macbook, quantity: "2" }]);
		expect(created.data).toMatchObject({ deliveryCity: "München", quote_ID: ids.quote, status_code: "DRAFT" });
		const saved = await activate(SALES, "SalesService", "DeliveryNotes", created.data.ID);
		expect(saved.status).toBe(201);
		expect(saved.data.deliveryNoteNumber).toMatch(/^DN-\d{4}-\d{4}$/);
		expect(saved.data.quote_ID).toBe(ids.quote);
		ids.deliveryNote = saved.data.ID;
		expect(await stock(ids.macbook)).toBe(10);
	});

	it("books the stock out only when the delivery note is confirmed, and only once", async () => {
		const note = `${SALES}/${active("DeliveryNotes", ids.deliveryNote)}`;
		expect((await POST(`${note}/SalesService.confirm`, {}, alice)).status).toBe(200);
		expect(await stock(ids.macbook)).toBe(8);
		const again = await POST(`${note}/SalesService.confirm`, {}, alice);
		expect(again.status).toBe(200);
		expect(again.data.status_code).toBe("CONFIRMED");
		expect(await stock(ids.macbook)).toBe(8);
	});

	it("locks a confirmed delivery note", async () => {
		const note = `${SALES}/${active("DeliveryNotes", ids.deliveryNote)}`;
		expect((await POST(`${note}/SalesService.draftEdit`, {}, alice)).status).toBe(409);
		expect((await PATCH(note, { notes: "changed" }, alice)).status).toBe(409);
		expect((await DELETE(note, alice)).status).toBe(409);
	});

	it("does not deliver more than is in stock", async () => {
		const draft = await POST(
			`${SALES}/DeliveryNotes`,
			{ customer_ID: customer, items: [{ description: "Dock", productService_ID: ids.dock, quantity: 11 }] },
			alice,
		);
		const saved = await activate(SALES, "SalesService", "DeliveryNotes", draft.data.ID);
		const confirm = await POST(`${SALES}/${active("DeliveryNotes", saved.data.ID)}/SalesService.confirm`, {}, alice);
		expect(confirm.status).toBe(409);
		expect(confirm.data.error.message).toContain("Not enough stock of USB-C Dock");
		expect((await GET(`${SALES}/${active("DeliveryNotes", saved.data.ID)}`, alice)).data.status_code).toBe("DRAFT");
		expect(await stock(ids.dock)).toBe(10);
	});

	it("invoices the delivery from its quote with the delivery date, without touching stock", async () => {
		const note = `${SALES}/${active("DeliveryNotes", ids.deliveryNote)}`;
		const created = await POST(`${note}/SalesService.createInvoice`, {}, alice);
		expect(created.status).toBe(200);
		ids.invoice = created.data.ID;
		const delivery = (await GET(note, alice)).data;
		expect(created.data).toMatchObject({ grossAmount: "5474.00", servicePeriodStart: delivery.deliveryDate });
		expect((await POST(`${note}/SalesService.createInvoice`, {}, alice)).status).toBe(409);
		const saved = await activate(SALES, "SalesService", "SalesInvoices", ids.invoice);
		expect(saved.status).toBe(201);
		const invoice = `${SALES}/${active("SalesInvoices", ids.invoice)}`;
		expect((await POST(`${invoice}/SalesService.finalize`, {}, alice)).status).toBe(200);
		expect((await POST(`${invoice}/SalesService.markAsPaid`, {}, alice)).data.paymentStatus_code).toBe("PAID");
		expect((await GET(`${invoice}/SalesService.pdf(download=false)`, alice)).status).toBe(200);
		expect((await GET(`${SALES}/${active("Quotes", ids.quote)}`, alice)).data.convertedInvoice_ID).toBe(ids.invoice);
		expect(await stock(ids.macbook)).toBe(8);
	});
});

describe("Returns and adjustments", () => {
	it("books a customer return back into stock, at most what was delivered", async () => {
		const items = (await GET(`${SALES}/${active("DeliveryNotes", ids.deliveryNote)}/items`, alice)).data.value;
		const url = `${SALES}/${active("DeliveryNoteItems", items[0].ID)}/SalesService.returnGoods`;
		const returned = await POST(url, { quantity: 1, reason: "Wrong colour" }, alice);
		expect(returned.status).toBe(200);
		expect(Number(returned.data.returnedQuantity)).toBe(1);
		expect(await stock(ids.macbook)).toBe(9);
		expect((await POST(url, { quantity: 2 }, alice)).status).toBe(409);
		expect(await stock(ids.macbook)).toBe(9);
	});

	it("leaves the refund to the existing invoice correction", async () => {
		const invoice = `${SALES}/${active("SalesInvoices", ids.invoice)}`;
		expect((await POST(`${invoice}/SalesService.reopen`, {}, alice)).status).toBe(200);
		const corrected = await POST(`${invoice}/SalesService.correct`, {}, alice);
		expect(corrected.status).toBe(200);
		expect(corrected.data.replacesInvoice_ID).toBe(ids.invoice);
		expect(await stock(ids.macbook)).toBe(9);
	});

	it("books a supplier return out of stock", async () => {
		const url = `${INVENTORY}/Products(${ids.macbook})/InventoryService.returnToSupplier`;
		expect((await POST(url, { quantity: 1, reason: "Defective" }, alice)).status).toBe(200);
		expect(await stock(ids.macbook)).toBe(8);
		expect((await POST(url, { quantity: 100 }, alice)).status).toBe(409);
	});

	it("adjusts stock up and down with a reason", async () => {
		const url = `${INVENTORY}/Products(${ids.macbook})/InventoryService.adjustStock`;
		expect((await POST(url, { quantity: -1 }, alice)).status).toBe(400);
		expect((await POST(url, { quantity: -1, reason: " " }, alice)).status).toBe(400);
		expect((await POST(url, { quantity: -1, reason: "Damaged item" }, alice)).status).toBe(200);
		expect(await stock(ids.macbook)).toBe(7);
		expect((await POST(url, { quantity: 2, reason: "Found in storage" }, alice)).status).toBe(200);
		expect(await stock(ids.macbook)).toBe(9);
		const { data } = await GET(`${INVENTORY}/StockMovements?$filter=product_ID eq ${ids.macbook}&$orderby=createdAt`, alice);
		expect(data.value.map((movement: { type_code: string }) => movement.type_code)).toEqual([
			"GOODS_RECEIPT",
			"DELIVERY",
			"CUSTOMER_RETURN",
			"SUPPLIER_RETURN",
			"ADJUSTMENT",
			"ADJUSTMENT",
		]);
	});

	it("books the first stock of a product as its opening balance", async () => {
		const product = await createActive(SALES, "ProductServices", { name: "Mouse", reorderLevel: 10, trackStock: true, type_code: "GOODS" });
		const url = `${INVENTORY}/Products(${product.data.ID})/InventoryService.adjustStock`;
		expect((await POST(url, { quantity: 24, reason: "Stock count" }, alice)).status).toBe(200);
		const { data } = await GET(`${INVENTORY}/Products(${product.data.ID})?$expand=stockMovements`, alice);
		expect(data).toMatchObject({ stockOnHand: "24", stockStatus: "OK" });
		expect(data.stockMovements).toMatchObject([{ quantity: "24", type_code: "OPENING_BALANCE" }]);
	});

	it("shows low stock at or below the reorder level", async () => {
		const { data } = await GET(`${INVENTORY}/Products?$filter=ID eq ${ids.dock}`, alice);
		expect(data.value[0]).toMatchObject({ reorderLevel: "10", stockOnHand: "10", stockStatus: "Low" });
	});

	it("never lets movements be written or deleted directly", async () => {
		expect((await POST(`${INVENTORY}/StockMovements`, { product_ID: ids.macbook, quantity: 100, type_code: "ADJUSTMENT" }, alice)).status).toBe(405);
		const { data } = await GET(`${INVENTORY}/StockMovements?$top=1`, alice);
		expect((await DELETE(`${INVENTORY}/StockMovements(${data.value[0].ID})`, alice)).status).toBe(405);
		expect((await DELETE(`${SALES}/${active("ProductServices", ids.macbook)}`, alice)).status).toBe(409);
	});
});

describe("Organizations and roles", () => {
	let bobNote: string;

	beforeAll(async () => {
		await POST(`${ORGANIZATION}/createOrganization`, { companyName: "Bob Handel GmbH" }, bob);
		const bobCustomer = await createActive(SALES, "Customers", { name: "Bob's customer" }, bob);
		const draft = await POST(
			`${SALES}/DeliveryNotes`,
			{ customer_ID: bobCustomer.data.ID, items: [{ description: "Thing", quantity: 1 }] },
			bob,
		);
		bobNote = draft.data.ID;
	});

	it("does not show alice's stock to bob", async () => {
		expect((await GET(`${INVENTORY}/Products(${ids.macbook})`, bob)).status).toBe(404);
		expect((await GET(`${INVENTORY}/Products`, bob)).data.value).toHaveLength(0);
		expect((await GET(`${INVENTORY}/StockMovements`, bob)).data.value).toHaveLength(0);
	});

	it("does not let bob book stock of alice's products", async () => {
		const adjust = await POST(`${INVENTORY}/Products(${ids.macbook})/InventoryService.adjustStock`, { quantity: 5, reason: "x" }, bob);
		expect([403, 404]).toContain(adjust.status);
		const reference = await PATCH(
			`${SALES}/DeliveryNoteItems(ID=${(await GET(`${SALES}/DeliveryNotes(ID=${bobNote},IsActiveEntity=false)/items`, bob)).data.value[0].ID},IsActiveEntity=false)`,
			{ productService_ID: ids.macbook },
			bob,
		);
		expect(reference.status).toBe(404);
		expect(reference.data.error.message).toContain("another organization");
		expect(await stock(ids.macbook)).toBe(9);
	});

	it("does not let bob open or confirm alice's delivery notes", async () => {
		const note = `${SALES}/${active("DeliveryNotes", ids.deliveryNote)}`;
		expect((await GET(note, bob)).status).toBe(404);
		expect([403, 404]).toContain((await POST(`${note}/SalesService.confirm`, {}, bob)).status);
		const items = (await GET(`${note}/items`, alice)).data.value;
		const returned = await POST(`${SALES}/${active("DeliveryNoteItems", items[0].ID)}/SalesService.returnGoods`, { quantity: 1 }, bob);
		expect([403, 404]).toContain(returned.status);
	});

	it("does not let bob receive alice's supplier goods", async () => {
		const invoice = `${PURCHASING}/${active("SupplierInvoices", ids.macbookReceipt)}`;
		expect([403, 404]).toContain((await POST(`${invoice}/PurchasingService.bookGoodsReceipt`, {}, bob)).status);
		const item = (await GET(`${invoice}/items`, alice)).data.value[0];
		const receive = await POST(`${PURCHASING}/${active("SupplierInvoiceItems", item.ID)}/PurchasingService.receiveGoods`, { quantity: 1 }, bob);
		expect([403, 404]).toContain(receive.status);
		expect(await stock(ids.macbook)).toBe(9);
	});

	it("lets the tax advisor read stock and deliveries but book nothing", async () => {
		expect(await stock(ids.macbook, advisor)).toBe(9);
		expect((await GET(`${SALES}/${active("DeliveryNotes", ids.deliveryNote)}`, advisor)).status).toBe(200);
		expect((await POST(`${INVENTORY}/Products(${ids.macbook})/InventoryService.adjustStock`, { quantity: 1, reason: "x" }, advisor)).status).toBe(403);
		expect((await POST(`${SALES}/${active("DeliveryNotes", ids.deliveryNote)}/SalesService.confirm`, {}, advisor)).status).toBe(403);
		expect((await POST(`${PURCHASING}/${active("SupplierInvoices", ids.macbookReceipt)}/PurchasingService.bookGoodsReceipt`, {}, advisor)).status).toBe(403);
	});
});
