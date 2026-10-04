import cds, { Request } from "@sap/cds";

import { calculateInvoice, calculateItem, ItemInput } from "../core/money";

/**
 * Item and total calculation shared by sales invoices and quotes, while editing (drafts) and when
 * saving. The rules themselves live in core/money; this module only applies them to the documents.
 */
export interface DocumentConfig {
	/** Draft entity of the document, e.g. SalesService.SalesInvoices.drafts */
	documentDrafts: string;
	itemDrafts: string;
	/** Foreign key of the items to the document, e.g. invoice_ID */
	itemKey: string;
	/** Tax lines per rate, only kept for sales invoices. */
	taxDrafts?: string;
}

export type Item = ItemInput & { ID?: string; position?: null | number };
type Data = Record<string, unknown>;

/** Sets item amounts, positions, totals (and tax lines) on the document being saved. False if it has no items. */
export function applyTotals(req: Request, withTaxes: boolean, emptyMessage: string): boolean {
	const items = (req.data.items ?? (req.event === "CREATE" ? [] : undefined)) as Item[] | undefined;
	if (items === undefined) {
		return true;
	}
	if (items.length === 0) {
		req.error(400, emptyMessage, "items");
		return false;
	}
	sortByPosition(items).forEach((item, index) => Object.assign(item, calculateItem(item), { position: index + 1 }));
	const { taxes, ...totals } = calculateInvoice(items);
	Object.assign(req.data, totals, withTaxes ? { taxes } : {});
	return true;
}

/** Recalculates the items, totals and tax lines of a document being edited. */
export async function recalculateDraft(config: DocumentConfig, documentID: string) {
	const document = await SELECT.one
		.from(config.documentDrafts)
		.columns("ID", "DraftAdministrativeData_DraftUUID")
		.where({ ID: documentID });
	if (!document) {
		return;
	}
	const items = sortByPosition(
		(await SELECT.from(config.itemDrafts)
			.columns("ID", "position", "quantity", "unitPrice", "taxRate")
			.where({ [config.itemKey]: documentID })) as Item[],
	);
	for (const [index, item] of items.entries()) {
		await UPDATE(config.itemDrafts)
			.set({ ...calculateItem(item), position: index + 1 })
			.where({ ID: item.ID });
	}
	const { taxes, ...totals } = calculateInvoice(items);
	await UPDATE(config.documentDrafts).set(totals).where({ ID: documentID });
	if (!config.taxDrafts) {
		return;
	}
	await DELETE.from(config.taxDrafts).where({ [config.itemKey]: documentID });
	if (taxes.length) {
		await INSERT.into(config.taxDrafts).entries(
			taxes.map((tax) => ({
				...tax,
				[config.itemKey]: documentID,
				DraftAdministrativeData_DraftUUID: document.DraftAdministrativeData_DraftUUID,
				HasActiveEntity: false,
				ID: cds.utils.uuid(),
			})),
		);
	}
}

/**
 * Recalculates the document while its items are edited, so the user sees the totals without saving.
 * Picking a product or service fills the item's description, unit, price and VAT rate.
 */
export function registerItemCalculation(srv: cds.ApplicationService, itemDrafts: string, config: DocumentConfig) {
	const itemDocument = new WeakMap<Request, string>();
	srv.before(["UPDATE", "DELETE"], itemDrafts, async (req) => {
		const item = await SELECT.one
			.from(config.itemDrafts)
			.columns(config.itemKey)
			.where({ ID: itemKey(req) });
		if (item?.[config.itemKey]) {
			itemDocument.set(req, item[config.itemKey] as string);
		}
		if (req.event === "UPDATE" && req.data.productService_ID) {
			await prefillFromProduct(req.data as Data);
		}
	});
	srv.after(["UPDATE", "DELETE"], itemDrafts, async (_results, req) => {
		const documentID = itemDocument.get(req);
		if (documentID) {
			await recalculateDraft(config, documentID);
		}
	});
	// Also when the product comes with the new line, e.g. from an inline creation row of the item table
	srv.before("NEW", itemDrafts, async (req) => {
		if (req.data.productService_ID) {
			await prefillFromProduct(req.data as Data);
		}
	});
	srv.after("NEW", itemDrafts, async (_results, req) => {
		const documentID = (req.data as Data)[config.itemKey] as string | undefined;
		if (documentID) {
			await recalculateDraft(config, documentID);
		}
	});
}

export function sortByPosition<T extends Item>(items: T[]): T[] {
	return items.sort(
		(first, second) => (first.position ?? Number.MAX_SAFE_INTEGER) - (second.position ?? Number.MAX_SAFE_INTEGER),
	);
}

function itemKey(req: Request): string {
	if (req.data?.ID) {
		return req.data.ID;
	}
	const key = req.params.at(-1);
	return (typeof key === "object" ? (key as { ID: string }).ID : key) as string;
}

/** The user can still override the values afterwards. The tenant guard has checked the product's organization. */
async function prefillFromProduct(data: Data) {
	const product = await SELECT.one
		.from("swiver.ProductServices")
		.columns("name", "description", "unit", "defaultPrice", "defaultTaxRate")
		.where({ ID: data.productService_ID });
	if (!product) {
		return;
	}
	data.description = product.description ? `${product.name}\n${product.description}` : product.name;
	data.unit = product.unit;
	data.unitPrice = product.defaultPrice;
	data.taxRate = product.defaultTaxRate;
}
