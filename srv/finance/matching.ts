import { toUnits } from "../core/money";
import { DomainError } from "../core/requests";
import { requireOrganization } from "../organizations/organization-context";
import { InvoiceKind, loadInvoice, recordPayment, refreshInvoicePayments } from "../payments/payments";

/**
 * Deterministic matching of bank transactions to open invoices of the same organization.
 * Signals, strongest first: invoice number in the reference, exact open amount, direction
 * (money in → sales invoice, money out → supplier invoice), IBAN, name. No guessing beyond that:
 * a suggestion is only made when exactly one invoice fits, and it waits for the user's confirmation.
 */
const Transactions = "swiver.BankTransactions";

interface Candidate {
	counterpartyIBAN?: null | string;
	counterpartyName?: null | string;
	ID: string;
	invoiceNumber: string;
	outstanding: bigint;
}

interface Transaction {
	amount: string;
	bookingDate: string;
	counterpartyIBAN?: null | string;
	counterpartyName?: null | string;
	ID: string;
	matchStatus_code: string;
	reference?: null | string;
}

/** Records the payment for the suggested invoice and marks the transaction as matched. */
export async function confirmMatch(transactionID: string) {
	const transaction = await loadTransaction(transactionID);
	const salesInvoice = transaction.suggestedSalesInvoice_ID as null | string;
	const supplierInvoice = transaction.suggestedSupplierInvoice_ID as null | string;
	if (!salesInvoice && !supplierInvoice) {
		throw new DomainError("BANK_TRANSACTION_NO_SUGGESTION", 400);
	}
	await match(transaction, salesInvoice ? "sales" : "supplier", (salesInvoice ?? supplierInvoice) as string);
}

export async function ignoreTransaction(transactionID: string) {
	const transaction = await loadTransaction(transactionID);
	if (transaction.matchStatus_code === "MATCHED") {
		throw new DomainError("BANK_TRANSACTION_ALREADY_MATCHED");
	}
	await UPDATE(Transactions, transactionID).with({ matchStatus_code: "IGNORED" });
}

export async function matchManually(
	transactionID: string,
	salesInvoice?: null | string,
	supplierInvoice?: null | string,
) {
	if (Boolean(salesInvoice) === Boolean(supplierInvoice)) {
		throw new DomainError("BANK_MATCH_ONE_INVOICE", 400);
	}
	const transaction = await loadTransaction(transactionID);
	await match(transaction, salesInvoice ? "sales" : "supplier", (salesInvoice ?? supplierInvoice) as string);
}

/** Suggests invoices for all unmatched transactions of the organization; returns the number of suggestions. */
export async function suggestMatches(): Promise<number> {
	const organization_ID = requireOrganization();
	const transactions = (await SELECT.from(Transactions).where({
		matchStatus_code: "UNMATCHED",
		organization_ID,
	})) as Transaction[];
	if (!transactions.length) {
		return 0;
	}
	const sales = await openInvoices("sales");
	const purchases = await openInvoices("supplier");
	let count = 0;
	for (const transaction of transactions) {
		const incoming = toUnits(transaction.amount, 2) > 0n;
		const suggestion = suggest(transaction, incoming ? sales : purchases);
		if (!suggestion) {
			continue;
		}
		await UPDATE(Transactions, transaction.ID).with({
			matchStatus_code: "SUGGESTED",
			suggestedSalesInvoice_ID: incoming ? suggestion.invoice.ID : null,
			suggestedSupplierInvoice_ID: incoming ? null : suggestion.invoice.ID,
			suggestionReason: suggestion.reason,
		});
		count++;
	}
	return count;
}

/** Removes the payment of a matched transaction and opens the transaction again. */
export async function unmatch(transactionID: string) {
	const transaction = await loadTransaction(transactionID);
	if (transaction.matchStatus_code !== "MATCHED" || !transaction.payment_ID) {
		await UPDATE(Transactions, transactionID).with({ matchStatus_code: "UNMATCHED" });
		return;
	}
	const payment = await SELECT.one.from("swiver.Payments").where({ ID: transaction.payment_ID });
	await UPDATE(Transactions, transactionID).with({ matchStatus_code: "UNMATCHED", payment_ID: null });
	await DELETE.from("swiver.Payments").where({ ID: transaction.payment_ID });
	if (payment?.salesInvoice_ID) {
		await refreshInvoicePayments("sales", payment.salesInvoice_ID);
	} else if (payment?.supplierInvoice_ID) {
		await refreshInvoicePayments("supplier", payment.supplierInvoice_ID);
	}
}

async function loadTransaction(transactionID: string) {
	const transaction = await SELECT.one
		.from(Transactions)
		.where({ ID: transactionID, organization_ID: requireOrganization() });
	if (!transaction) {
		throw new DomainError("BANK_TRANSACTION_NOT_FOUND", 404);
	}
	return transaction as Record<string, unknown> & Transaction;
}

async function match(transaction: Transaction, kind: InvoiceKind, invoiceID: string) {
	const incoming = toUnits(transaction.amount, 2) > 0n;
	if (incoming !== (kind === "sales")) {
		throw new DomainError("BANK_DIRECTION_MISMATCH", 400);
	}
	await loadInvoice(kind, invoiceID);
	// Claim the transaction first: a second confirmation finds it already matched.
	const claimed = await UPDATE(Transactions)
		.set({ matchStatus_code: "MATCHED" })
		.where({ ID: transaction.ID, matchStatus_code: { "!=": "MATCHED" } });
	if (!claimed) {
		throw new DomainError("BANK_TRANSACTION_ALREADY_MATCHED");
	}
	const amount = transaction.amount.replace("-", "");
	const paymentID = await recordPayment({
		amount,
		bankTransactionID: transaction.ID,
		invoiceID,
		kind,
		paymentDate: transaction.bookingDate,
		reference: transaction.reference?.slice(0, 255),
		source: "BANK",
	});
	await UPDATE(Transactions, transaction.ID).with({
		payment_ID: paymentID,
		suggestedSalesInvoice_ID: kind === "sales" ? invoiceID : null,
		suggestedSupplierInvoice_ID: kind === "supplier" ? invoiceID : null,
	});
}

function normalize(value?: null | string): string {
	return (value ?? "").replace(/\s+/g, "").toUpperCase();
}

/** Issued, not fully paid invoices with the counterparty's IBAN and name. */
async function openInvoices(kind: InvoiceKind): Promise<Candidate[]> {
	const organization_ID = requireOrganization();
	const rows =
		kind === "sales"
			? await SELECT.from("swiver.SalesInvoices")
					.columns(
						"ID",
						"invoiceNumber",
						"grossAmount",
						"paidAmount",
						"customer.iban as iban",
						"customer.companyName as name",
						"customer.name as contact",
					)
					.where({ organization_ID, paymentStatus_code: { "!=": "PAID" }, status_code: { in: ["FINALIZED", "SENT"] } })
			: await SELECT.from("swiver.SupplierInvoices")
					.columns(
						"ID",
						"invoiceNumber",
						"netAmount + taxAmount as grossAmount",
						"paidAmount",
						"supplier.iban as iban",
						"supplier.name as name",
					)
					.where({ organization_ID, paymentStatus_code: { "!=": "PAID" } });
	return (rows as Record<string, null | string>[]).map((row) => ({
		counterpartyIBAN: row.iban,
		counterpartyName: row.name ?? row.contact,
		ID: row.ID as string,
		invoiceNumber: row.invoiceNumber ?? "",
		outstanding: toUnits(row.grossAmount, 2) - toUnits(row.paidAmount, 2),
	}));
}

function suggest(
	transaction: Transaction,
	candidates: Candidate[],
): undefined | { invoice: Candidate; reason: string } {
	const amount = toUnits(transaction.amount.replace("-", ""), 2);
	const reference = normalize(transaction.reference);
	const iban = normalize(transaction.counterpartyIBAN);
	const name = (transaction.counterpartyName ?? "").toLowerCase();
	const sameAmount = (invoice: Candidate) => invoice.outstanding === amount;
	const sameIban = (invoice: Candidate) => Boolean(iban) && normalize(invoice.counterpartyIBAN) === iban;
	const sameName = (invoice: Candidate) => {
		const invoiceName = (invoice.counterpartyName ?? "").toLowerCase();
		return Boolean(invoiceName) && Boolean(name) && (name.includes(invoiceName) || invoiceName.includes(name));
	};
	const byNumber = candidates.filter(
		(invoice) => invoice.invoiceNumber && reference.includes(normalize(invoice.invoiceNumber)),
	);
	const unique = (list: Candidate[]) => (list.length === 1 ? list[0] : undefined);
	const numbered = unique(byNumber) ?? unique(byNumber.filter(sameAmount));
	if (numbered) {
		return {
			invoice: numbered,
			reason: sameAmount(numbered) ? "Invoice number and amount" : "Invoice number in reference",
		};
	}
	const exact = candidates.filter(sameAmount);
	const byParty = unique(exact.filter(sameIban)) ?? unique(exact.filter(sameName));
	if (byParty) {
		return { invoice: byParty, reason: sameIban(byParty) ? "Amount and IBAN" : "Amount and name" };
	}
	const onlyAmount = unique(exact);
	return onlyAmount ? { invoice: onlyAmount, reason: "Exact open amount" } : undefined;
}
