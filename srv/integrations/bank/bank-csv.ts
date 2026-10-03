/**
 * Bank statement CSV import, independent of the database: adapters turn a file into plain
 * transactions. New bank formats are added as further adapters.
 * TODO(feature): additional bank-specific CSV adapters
 * TODO(feature): CAMT.053 import
 */
import { genericCsvAdapter } from "./generic-csv-adapter";

export interface BankCsvAdapter {
	canParse(text: string): boolean;
	name: string;
	parse(text: string): ParsedTransaction[];
}

export interface ParsedTransaction {
	/** Signed: positive = money in, negative = money out. */
	amount: string;
	bookingDate: string;
	counterpartyIBAN?: string;
	counterpartyName?: string;
	currency?: string;
	externalReference?: string;
	reference?: string;
	valueDate?: string;
}

const adapters: BankCsvAdapter[] = [genericCsvAdapter];

export function parseBankCsv(text: string): { adapter: string; transactions: ParsedTransaction[] } {
	const content = text.replace(/^\ufeff/, "");
	const adapter = adapters.find((candidate) => candidate.canParse(content));
	if (!adapter) {
		throw new Error("BANK_CSV_FORMAT_UNKNOWN");
	}
	return { adapter: adapter.name, transactions: adapter.parse(content) };
}
