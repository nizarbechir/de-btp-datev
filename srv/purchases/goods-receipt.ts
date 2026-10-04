import cds, { Request } from "@sap/cds";

import { calculateInvoice, calculateItem } from "../core/money";
import { boundID, DomainError } from "../core/requests";
import { getCompanySettings } from "../core/settings";
import { bookMovements, isStockTracked, positiveQuantity, quantity, units } from "../inventory/stock";
import { requireOrganization } from "../organizations/organization-context";
import { DocumentConfig, Item, registerItemCalculation, sortByPosition } from "../sales/document-items";

/**
 * Supplier invoice items and the goods receipt. Items are optional: an expense such as the tax
 * advisor's invoice has none. With items, the invoice amounts follow from them. Receiving the goods
 * is a separate step, because an invoice does not mean the goods arrived; each item remembers its
 * received quantity, so a quantity is never booked twice and partial deliveries are possible.
 * TODO(feature): read the line items of incoming e-invoices in the inbox
 */
const Invoices = "PurchasingService.SupplierInvoices";
const Items = "PurchasingService.SupplierInvoiceItems";

const supplierInvoiceDocument: DocumentConfig = {
	documentDrafts: "PurchasingService.SupplierInvoices.drafts",
	itemDrafts: "PurchasingService.SupplierInvoiceItems.drafts",
	itemKey: "supplierInvoice_ID",
	optionalItems: true,
};

type Data = Record<string, unknown>;

/**
 * Books the open quantity of the stock-tracked items into stock: of one item (optionally only part of
 * it), or of all items. Returns the number of booked items.
 */
export async function bookGoodsReceipt(invoiceID: string, itemID?: string, received?: unknown): Promise<number> {
	// Locks the invoice, so parallel receipts of the same invoice run one after the other.
	await SELECT.one.from("swiver.SupplierInvoices").columns("ID").where({ ID: invoiceID }).forUpdate();
	const invoice = (await SELECT.one
		.from(Invoices)
		.columns("ID", "HasDraftEntity")
		.where({ ID: invoiceID, organization_ID: requireOrganization() })) as null | {
		HasDraftEntity: boolean;
		ID: string;
	};
	if (!invoice) {
		throw new DomainError("INVOICE_NOT_FOUND", 404);
	}
	if (invoice.HasDraftEntity) {
		throw new DomainError("SUPPLIER_INVOICE_BEING_EDITED");
	}
	const items = (await SELECT.from("swiver.SupplierInvoiceItems")
		.columns(
			"ID",
			"quantity",
			"receivedQuantity",
			"productService_ID",
			"productService.type_code as type_code",
			"productService.trackStock as trackStock",
		)
		.where({ supplierInvoice_ID: invoiceID, ...(itemID ? { ID: itemID } : {}) })) as {
		ID: string;
		productService_ID: string;
		quantity: string;
		receivedQuantity: null | string;
		trackStock: boolean | null;
		type_code: null | string;
	}[];
	if (itemID && !items.some(isStockTracked)) {
		throw new DomainError("PRODUCT_NOT_STOCK_TRACKED", 400);
	}
	const bookings = [];
	for (const item of items.filter(isStockTracked)) {
		const open = units(item.quantity) - units(item.receivedQuantity);
		const amount = itemID && received !== undefined && received !== null ? positiveQuantity(received as string) : open;
		if (amount > open) {
			throw new DomainError("RECEIPT_EXCEEDS_INVOICE_QUANTITY", 409, [quantity(open)]);
		}
		if (amount <= 0n) {
			continue;
		}
		await UPDATE("swiver.SupplierInvoiceItems")
			.set({ receivedQuantity: quantity(units(item.receivedQuantity) + amount) })
			.where({ ID: item.ID });
		bookings.push({
			product_ID: item.productService_ID,
			quantity: quantity(amount),
			supplierInvoice_ID: invoiceID,
			supplierInvoiceItem_ID: item.ID,
			type: "GOODS_RECEIPT" as const,
		});
	}
	await bookMovements(bookings);
	return bookings.length;
}

export function registerSupplierInvoiceItems(srv: cds.ApplicationService) {
	srv.before("NEW", supplierInvoiceDocument.itemDrafts, async (req) => {
		req.data.taxRate ??= (await getCompanySettings()).defaultTaxRate;
	});
	registerItemCalculation(srv, supplierInvoiceDocument.itemDrafts, supplierInvoiceDocument);

	// Saving: amounts from the items (if any); received quantities only change through the goods receipt.
	srv.before(["CREATE", "UPDATE"], Invoices, async (req) => {
		const items = req.data.items as (Data & Item)[] | undefined;
		if (!items) {
			return;
		}
		const received = await receivedQuantities(req);
		for (const [ID, receivedQuantity] of received) {
			const item = items.find((entry) => entry.ID === ID);
			if (!item) {
				return req.reject(409, "RECEIVED_ITEM_CANNOT_BE_REMOVED");
			}
			if (units(item.quantity as string) < units(receivedQuantity)) {
				return req.reject(409, "QUANTITY_BELOW_RECEIVED", undefined, [receivedQuantity]);
			}
		}
		sortByPosition(items).forEach((item, index) => {
			Object.assign(item, calculateItem(item), { position: index + 1 });
			item.receivedQuantity = received.get(item.ID as string) ?? 0;
		});
		if (items.length) {
			const { netAmount, taxAmount } = calculateInvoice(items);
			Object.assign(req.data, { netAmount, taxAmount });
		}
	});
	srv.before("DELETE", Invoices, async (req) => {
		if ((await receivedQuantities(req)).size) {
			return req.reject(409, "SUPPLIER_INVOICE_HAS_GOODS_RECEIPT");
		}
	});
	srv.before(["CREATE", "UPDATE", "DELETE"], Items, (req) =>
		req.reject(405, "SUPPLIER_INVOICE_ITEMS_ONLY_IN_DRAFT"),
	);
}

/** The items of the saved invoice that already have received quantities, by item ID. */
async function receivedQuantities(req: Request): Promise<Map<string, string>> {
	const ID = (req.data as Data)?.ID ?? boundID(req);
	if (req.event === "CREATE" || !ID) {
		return new Map();
	}
	const items = (await SELECT.from("swiver.SupplierInvoiceItems")
		.columns("ID", "receivedQuantity")
		.where({ receivedQuantity: { ">": 0 }, supplierInvoice_ID: ID })) as { ID: string; receivedQuantity: string }[];
	return new Map(items.map((item) => [item.ID, String(item.receivedQuantity)]));
}
