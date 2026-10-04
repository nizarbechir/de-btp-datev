import cds from "@sap/cds";

import { isoDate } from "../core/dates";
import { toUnits } from "../core/money";
import { requireOrganization } from "../organizations/organization-context";
import { calculateOutstanding, determinePaymentStatus, sumAmounts } from "./payment-status";

/**
 * Payments of sales invoices (money in) and supplier invoices (money out). The paid amount,
 * payment status and last payment date of an invoice are always recalculated from its payments,
 * never set independently.
 */
export type InvoiceKind = "sales" | "supplier";

export interface PaymentInput {
	amount?: null | number | string;
	bankTransactionID?: string;
	invoiceID: string;
	kind: InvoiceKind;
	paymentDate?: null | string;
	reference?: null | string;
	source?: "BANK" | "MANUAL";
}

const config = {
	sales: { direction: "IN", entity: "swiver.SalesInvoices", key: "salesInvoice_ID", numberField: "invoiceNumber" },
	supplier: {
		direction: "OUT",
		entity: "swiver.SupplierInvoices",
		key: "supplierInvoice_ID",
		numberField: "invoiceNumber",
	},
} as const;

/** Thrown for business rule violations; handlers turn it into a 4xx response with the message. */
export class DomainError extends Error {
	constructor(
		public code: string,
		public status = 409,
		public args: unknown[] = [],
	) {
		super(code);
	}
}

/** The invoice in the current organization with its gross and open amount. */
export async function loadInvoice(kind: InvoiceKind, invoiceID: string) {
	const { entity } = config[kind];
	const columns = ["ID", "invoiceNumber", "currency_code", "dueDate", "paidAmount"];
	columns.push(...(kind === "sales" ? ["grossAmount", "status_code"] : ["netAmount + taxAmount as grossAmount"]));
	const invoice = (await SELECT.one
		.from(entity)
		.columns(...columns)
		.where({ ID: invoiceID, organization_ID: requireOrganization() })) as null | {
		currency_code: string;
		dueDate: string;
		grossAmount: string;
		ID: string;
		invoiceNumber: string;
		paidAmount: null | string;
		status_code?: string;
	};
	if (!invoice) {
		throw new DomainError("INVOICE_NOT_FOUND", 404);
	}
	return { ...invoice, outstanding: calculateOutstanding(invoice.grossAmount, invoice.paidAmount) };
}

/** Records a payment and updates the invoice. Defaults: the full open amount, dated today. */
export async function recordPayment(input: PaymentInput): Promise<string> {
	// Lock the invoice until the transaction ends: parallel payments wait and then see the new open amount.
	await SELECT.one.from(config[input.kind].entity).columns("ID").where({ ID: input.invoiceID }).forUpdate();
	const invoice = await loadInvoice(input.kind, input.invoiceID);
	if (input.kind === "sales" && !["FINALIZED", "SENT"].includes(invoice.status_code ?? "")) {
		throw new DomainError("PAYMENT_INVOICE_NOT_ISSUED");
	}
	const amount = input.amount ?? invoice.outstanding;
	if (toUnits(amount, 2) <= 0n) {
		throw new DomainError(
			toUnits(invoice.outstanding, 2) <= 0n ? "INVOICE_ALREADY_PAID" : "PAYMENT_AMOUNT_NOT_POSITIVE",
			400,
		);
	}
	if (toUnits(amount, 2) > toUnits(invoice.outstanding, 2)) {
		throw new DomainError("PAYMENT_EXCEEDS_OUTSTANDING", 400, [invoice.outstanding]);
	}
	const { direction, key } = config[input.kind];
	const ID = cds.utils.uuid();
	await INSERT.into("swiver.Payments").entries({
		amount: String(amount),
		bankTransaction_ID: input.bankTransactionID ?? null,
		currency_code: invoice.currency_code,
		direction,
		ID,
		[key]: input.invoiceID,
		organization_ID: requireOrganization(),
		paymentDate: input.paymentDate || isoDate(new Date()),
		reference: input.reference ?? invoice.invoiceNumber,
		source: input.source ?? "MANUAL",
	});
	await refreshInvoicePayments(input.kind, input.invoiceID);
	return ID;
}

/** Recalculates paid amount, payment status and last payment date of an invoice from its payments. */
export async function refreshInvoicePayments(kind: InvoiceKind, invoiceID: string) {
	const { entity, key } = config[kind];
	const invoice = await loadInvoice(kind, invoiceID);
	const payments = (await SELECT.from("swiver.Payments")
		.columns("amount", "paymentDate")
		.where({ [key]: invoiceID })) as {
		amount: string;
		paymentDate: string;
	}[];
	const paidAmount = sumAmounts(payments.map((payment) => payment.amount));
	const lastPayment =
		payments
			.map((payment) => payment.paymentDate)
			.sort()
			.at(-1) ?? null;
	await UPDATE(entity, invoiceID).with({
		paidAmount,
		paymentDate: lastPayment,
		paymentStatus_code: determinePaymentStatus(invoice.grossAmount, paidAmount),
	});
}

/** Rejects the request with the domain error's message, or rethrows anything else. */
export function rejectDomainError(req: cds.Request, error: unknown): never {
	if (error instanceof DomainError) {
		return req.reject(error.status, error.code, undefined, error.args) as never;
	}
	throw error;
}

/** Removes the manually recorded payments (bank matches stay) and updates the invoice. */
export async function removeManualPayments(kind: InvoiceKind, invoiceID: string) {
	await loadInvoice(kind, invoiceID);
	await DELETE.from("swiver.Payments").where({ [config[kind].key]: invoiceID, source: "MANUAL" });
	await refreshInvoicePayments(kind, invoiceID);
}
