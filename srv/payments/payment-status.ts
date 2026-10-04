import { fromUnits, toUnits } from "../core/money";

/**
 * Payment status of an invoice, calculated from its payments:
 * nothing paid → OPEN, partly paid → PARTIAL, fully paid → PAID.
 * Overdue is not a stored status: an invoice is overdue while it is not paid after its due date.
 */
export type PaymentStatus = "OPEN" | "PAID" | "PARTIAL";
type Decimal = null | number | string | undefined;

/** The amount still to be paid, never below zero. */
export function calculateOutstanding(grossAmount: Decimal, paidAmount: Decimal): string {
	const outstanding = toUnits(grossAmount, 2) - toUnits(paidAmount, 2);
	return fromUnits(outstanding > 0n ? outstanding : 0n, 2);
}

export function determinePaymentStatus(grossAmount: Decimal, paidAmount: Decimal): PaymentStatus {
	const paid = toUnits(paidAmount, 2);
	if (paid <= 0n) {
		return "OPEN";
	}
	return paid >= toUnits(grossAmount, 2) ? "PAID" : "PARTIAL";
}

/** Sum of decimal amounts, exact to the cent. */
export function sumAmounts(amounts: Decimal[]): string {
	return fromUnits(
		amounts.reduce<bigint>((sum, amount) => sum + toUnits(amount, 2), 0n),
		2,
	);
}
