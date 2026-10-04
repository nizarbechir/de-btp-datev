import { DomainError } from "../payments/payments";
import { bookMovements, positiveQuantity, quantity, units } from "./stock";

/**
 * Stock changes without a business document: corrections and goods sent back to a supplier.
 * TODO(feature): supplier return document with reference to the supplier invoice and credit note
 */

/** Corrects the stock by the given (signed) quantity. The first booking of a product is its opening balance. */
export async function adjustStock(productID: string, change: unknown, reason: unknown) {
	const text = typeof reason === "string" ? reason.trim() : "";
	if (!text) {
		throw new DomainError("REASON_REQUIRED", 400);
	}
	const delta = units(change as string);
	if (delta === 0n) {
		throw new DomainError("QUANTITY_CHANGE_ZERO", 400);
	}
	const first = !(await SELECT.one.from("swiver.StockMovements").columns("ID").where({ product_ID: productID }));
	await bookMovements([
		{
			product_ID: productID,
			quantity: quantity(delta),
			reason: text,
			type: first && delta > 0n ? "OPENING_BALANCE" : "ADJUSTMENT",
		},
	]);
}

/** Books goods sent back to the supplier out of stock. */
export async function returnToSupplier(productID: string, returned: unknown, reason: unknown) {
	const amount = positiveQuantity(returned as string);
	await bookMovements([
		{
			product_ID: productID,
			quantity: quantity(-amount),
			reason: typeof reason === "string" ? reason.trim() || null : null,
			type: "SUPPLIER_RETURN",
		},
	]);
}
