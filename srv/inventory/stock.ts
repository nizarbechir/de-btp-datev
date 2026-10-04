import cds from "@sap/cds";

import { isoDate } from "../core/dates";
import { fromUnits, toUnits } from "../core/money";
import { requireOrganization } from "../organizations/organization-context";
import { DomainError } from "../payments/payments";

export interface Movement {
	deliveryNote_ID?: string;
	deliveryNoteItem_ID?: string;
	movementDate?: null | string;
	product_ID: string;
	/** Positive into stock, negative out of stock. */
	quantity: Quantity;
	reason?: null | string;
	supplierInvoice_ID?: string;
	supplierInvoiceItem_ID?: string;
	type: MovementType;
}

/**
 * The stock ledger. Every stock change of every business event is booked here, as movements in the
 * transaction of the event, so a failed event books nothing. Stock on hand is the sum of the movements
 * (see StockLevels in db/inventory.cds); movements are never changed or deleted.
 */
export type MovementType =
	| "ADJUSTMENT"
	| "CUSTOMER_RETURN"
	| "DELIVERY"
	| "GOODS_RECEIPT"
	| "OPENING_BALANCE"
	| "SUPPLIER_RETURN";

export type Quantity = null | number | string | undefined;

const Products = "swiver.ProductServices";
const Movements = "swiver.StockMovements";
/** Quantities are calculated as integers in thousandths, like the invoice quantities in core/money. */
const scale = 3;

/** Rejects deleting a product that has stock movements. */
export async function assertNoStockMovements(req: cds.Request) {
	const value = req.params.at(-1);
	const ID = typeof value === "object" ? (value as { ID: string }).ID : value;
	if (await SELECT.one.from(Movements).columns("ID").where({ product_ID: ID })) {
		req.reject(409, "PRODUCT_HAS_STOCK_MOVEMENTS");
	}
}

/**
 * Books the movements in the current transaction. All products must belong to the current organization
 * and track their stock, and no product's stock may drop below zero.
 */
export async function bookMovements(movements: Movement[]) {
	if (!movements.length) {
		return;
	}
	const organizationId = requireOrganization();
	const productIDs = [...new Set(movements.map((movement) => movement.product_ID))];
	// Locks the products until the transaction ends, so parallel bookings of a product run one after the other.
	const products = (await SELECT.from(Products)
		.columns("ID", "name", "type_code", "trackStock")
		.where({ ID: { in: productIDs }, organization_ID: organizationId })
		.forUpdate()) as { ID: string; name: string; trackStock: boolean | null; type_code: null | string }[];
	if (products.length !== productIDs.length) {
		throw new DomainError("PRODUCT_NOT_FOUND", 404);
	}
	if (products.some((product) => !isStockTracked(product))) {
		throw new DomainError("PRODUCT_NOT_STOCK_TRACKED", 400);
	}
	for (const product of products) {
		const change = movements
			.filter((movement) => movement.product_ID === product.ID)
			.reduce((sum, movement) => sum + toUnits(movement.quantity, scale), 0n);
		const stock = await stockUnits(product.ID);
		if (change < 0n && stock + change < 0n) {
			throw new DomainError("INSUFFICIENT_STOCK", 409, [product.name, fromUnits(stock, scale)]);
		}
	}
	const today = isoDate(new Date());
	await INSERT.into(Movements).entries(
		movements.map(({ type, ...movement }) => ({
			...movement,
			ID: cds.utils.uuid(),
			movementDate: movement.movementDate ?? today,
			organization_ID: organizationId,
			quantity: fromUnits(toUnits(movement.quantity, scale), scale),
			type_code: type,
		})),
	);
}

/** Only goods with stock tracking have stock; services and untracked goods (e.g. drop shipping) never do. */
export function isStockTracked(product: { trackStock?: boolean | null; type_code?: null | string }): boolean {
	return product.type_code === "GOODS" && Boolean(product.trackStock);
}

/** Positive quantities only, with at most three decimals; fails with QUANTITY_NOT_POSITIVE otherwise. */
export function positiveQuantity(quantity: Quantity): bigint {
	const units = toUnits(quantity, scale);
	if (units <= 0n) {
		throw new DomainError("QUANTITY_NOT_POSITIVE", 400);
	}
	return units;
}

export function quantity(units: bigint): string {
	return fromUnits(units, scale);
}

/** The stock on hand of a product, in thousandths. */
export async function stockUnits(productID: string): Promise<bigint> {
	const result = (await SELECT.one.from(Movements).columns("sum(quantity) as quantity").where({
		product_ID: productID,
	})) as null | { quantity: Quantity };
	return toUnits(result?.quantity ?? 0, scale);
}

export function units(value: Quantity): bigint {
	return toUnits(value, scale);
}
