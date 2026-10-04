import { DomainError } from "../core/requests";


/**
 * Document lifecycle of a sales invoice, separate from its payment status:
 * DRAFT (editable) → FINALIZED (issued, locked) → SENT; any of them → CANCELLED.
 * An issued invoice is never deleted or edited; it is cancelled and replaced by a correction.
 */
export type InvoiceStatus = "CANCELLED" | "DRAFT" | "FINALIZED" | "SENT";
export type LifecycleAction = "cancel" | "correct" | "finalize" | "send";

const allowedFrom: Record<LifecycleAction, InvoiceStatus[]> = {
	cancel: ["DRAFT", "FINALIZED", "SENT"],
	correct: ["FINALIZED", "SENT", "CANCELLED"],
	finalize: ["DRAFT"],
	send: ["DRAFT", "FINALIZED", "SENT"],
};

/** An invoice can only be issued with a customer and at least one item. */
export function assertIssuable(invoice: { customer_ID?: null | string }, itemCount: number) {
	if (!itemCount) {
		throw new DomainError("CANNOT_FINALIZE_WITHOUT_ITEMS", 400);
	}
	if (!invoice.customer_ID) {
		throw new DomainError("CANNOT_FINALIZE_WITHOUT_CUSTOMER", 400);
	}
}

export function assertTransition(action: LifecycleAction, status: string) {
	if (!allowedFrom[action].includes(status as InvoiceStatus)) {
		throw new DomainError("SALES_INVOICE_STATUS_CHANGE_NOT_ALLOWED");
	}
}

export function isIssued(status: string): boolean {
	return status === "FINALIZED" || status === "SENT";
}
