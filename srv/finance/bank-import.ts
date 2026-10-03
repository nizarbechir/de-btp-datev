import cds from "@sap/cds";
import { createHash } from "node:crypto";

import { parseBankCsv, ParsedTransaction } from "../integrations/bank/bank-csv";
import { requireOrganization } from "../organizations/organization-context";
import { DomainError } from "../payments/payments";
import { suggestMatches } from "./matching";

/**
 * Stores the transactions of an uploaded bank statement. Every booking gets a fingerprint, so
 * importing the same (or an overlapping) statement again does not create duplicates.
 */
const Transactions = "swiver.BankTransactions";

export async function importBankStatement(fileName: string, content: string) {
	const organization_ID = requireOrganization();
	let parsed: ReturnType<typeof parseBankCsv>;
	try {
		parsed = parseBankCsv(content);
	} catch {
		throw new DomainError("BANK_CSV_FORMAT_UNKNOWN", 400);
	}
	if (!parsed.transactions.length) {
		throw new DomainError("BANK_CSV_EMPTY", 400);
	}
	const fingerprints = withFingerprints(parsed.transactions);
	const existing = new Set(
		(
			(await SELECT.from(Transactions)
				.columns("fingerprint")
				.where({ fingerprint: { in: fingerprints.map((entry) => entry.fingerprint) }, organization_ID })) as {
				fingerprint: string;
			}[]
		).map((row) => row.fingerprint),
	);
	const batchID = cds.utils.uuid();
	const fresh = fingerprints.filter((entry) => !existing.has(entry.fingerprint));
	await INSERT.into("swiver.BankImportBatches").entries({
		adapter: parsed.adapter,
		duplicateCount: fingerprints.length - fresh.length,
		fileName,
		ID: batchID,
		importedCount: fresh.length,
		organization_ID,
	});
	if (fresh.length) {
		await INSERT.into(Transactions).entries(
			fresh.map(({ fingerprint, transaction: { currency, ...fields } }) => ({
				...fields,
				currency_code: currency || "EUR",
				fingerprint,
				ID: cds.utils.uuid(),
				importBatch_ID: batchID,
				matchStatus_code: "UNMATCHED",
				organization_ID,
			})),
		);
	}
	const suggested = await suggestMatches();
	return { duplicates: fingerprints.length - fresh.length, imported: fresh.length, suggested };
}

/** Same booking → same fingerprint; identical bookings within one file are told apart by their order. */
function withFingerprints(transactions: ParsedTransaction[]) {
	const seen = new Map<string, number>();
	return transactions.map((transaction) => {
		const base = [
			transaction.bookingDate,
			transaction.amount,
			transaction.counterpartyIBAN ?? "",
			transaction.reference ?? "",
			transaction.externalReference ?? "",
		].join("|");
		const occurrence = (seen.get(base) ?? 0) + 1;
		seen.set(base, occurrence);
		const fingerprint = createHash("sha256").update(`${base}|${occurrence}`).digest("hex");
		return { fingerprint, transaction };
	});
}
