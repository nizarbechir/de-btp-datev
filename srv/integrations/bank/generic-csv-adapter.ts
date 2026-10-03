import type { BankCsvAdapter, ParsedTransaction } from "./bank-csv";

/**
 * Reads the usual bank CSV exports by their column names (German and English), e.g.
 * Buchungstag;Valuta;Name Zahlungsbeteiligter;IBAN Zahlungsbeteiligter;Verwendungszweck;Betrag;Waehrung.
 * Lines above the header (account information) are skipped. Amounts may use German or English
 * number format, or separate debit and credit columns.
 */
const columns: Record<"credit" | "debit" | keyof ParsedTransaction, string[]> = {
	amount: ["betrag", "amount", "umsatz", "betrag (eur)", "betrag in eur"],
	bookingDate: ["buchungstag", "buchungsdatum", "booking date", "date", "datum"],
	counterpartyIBAN: ["iban zahlungsbeteiligter", "kontonummer/iban", "iban", "counterparty iban", "gegenkonto"],
	counterpartyName: [
		"name zahlungsbeteiligter",
		"beguenstigter/zahlungspflichtiger",
		"begünstigter/zahlungspflichtiger",
		"auftraggeber/empfänger",
		"empfänger",
		"counterparty",
		"payee",
		"name",
	],
	credit: ["haben", "credit", "gutschrift"],
	currency: ["waehrung", "währung", "currency"],
	debit: ["soll", "debit", "lastschrift"],
	externalReference: ["end-to-end-referenz", "kundenreferenz", "transaction id", "referenz", "reference id"],
	reference: ["verwendungszweck", "purpose", "reference", "description", "beschreibung"],
	valueDate: ["valuta", "valutadatum", "wertstellung", "value date"],
};

type Column = keyof typeof columns;

export const genericCsvAdapter: BankCsvAdapter = {
	canParse: (text) => findHeader(splitLines(text)) !== undefined,
	name: "generic-csv",
	parse(text) {
		const lines = splitLines(text);
		const header = findHeader(lines);
		if (!header) {
			return [];
		}
		const { delimiter, index, positions } = header;
		const result: ParsedTransaction[] = [];
		for (const line of lines.slice(index + 1)) {
			const cells = splitCsvLine(line, delimiter);
			const value = (column: Column) => {
				const position = positions[column];
				return position === undefined ? undefined : cells[position]?.trim() || undefined;
			};
			const bookingDate = parseDate(value("bookingDate"));
			const amount =
				value("amount") !== undefined
					? parseAmount(value("amount"))
					: creditMinusDebit(value("credit"), value("debit"));
			if (!bookingDate || amount === undefined) {
				continue;
			}
			result.push({
				amount,
				bookingDate,
				counterpartyIBAN: value("counterpartyIBAN")?.replace(/\s+/g, ""),
				counterpartyName: value("counterpartyName"),
				currency: value("currency")?.toUpperCase(),
				externalReference: value("externalReference"),
				reference: value("reference"),
				valueDate: parseDate(value("valueDate")),
			});
		}
		return result;
	},
};

function creditMinusDebit(credit?: string, debit?: string): string | undefined {
	const income = parseAmount(credit);
	const expense = parseAmount(debit);
	if (income === undefined && expense === undefined) {
		return undefined;
	}
	return (Math.abs(Number(income ?? 0)) - Math.abs(Number(expense ?? 0))).toFixed(2);
}

/** The first line naming at least a date and an amount column, with the column positions. */
function findHeader(lines: string[]) {
	for (const [index, line] of lines.slice(0, 30).entries()) {
		const delimiter = [";", "\t", ","].find((candidate) => line.includes(candidate));
		if (!delimiter) {
			continue;
		}
		const names = splitCsvLine(line, delimiter).map((cell) => cell.trim().toLowerCase());
		const positions: Partial<Record<Column, number>> = {};
		for (const [column, aliases] of Object.entries(columns) as [Column, string[]][]) {
			const position = aliases.map((alias) => names.indexOf(alias)).find((found) => found >= 0);
			if (position !== undefined) {
				positions[column] = position;
			}
		}
		const hasAmount = positions.amount !== undefined || positions.credit !== undefined || positions.debit !== undefined;
		if (positions.bookingDate !== undefined && hasAmount) {
			return { delimiter, index, positions };
		}
	}
	return undefined;
}

/** Parses German and English amounts, e.g. "1.234,56", "-1,234.56" or "1234.56 EUR" → "1234.56". */
function parseAmount(text?: string): string | undefined {
	if (!text) {
		return undefined;
	}
	let value = text.replace(/[^\d,.+-]/g, "");
	const lastComma = value.lastIndexOf(",");
	const lastDot = value.lastIndexOf(".");
	value = lastComma > lastDot ? value.replace(/\./g, "").replace(",", ".") : value.replace(/,/g, "");
	const number = Number(value);
	return value && !Number.isNaN(number) ? number.toFixed(2) : undefined;
}

/** Parses dd.mm.yyyy, dd.mm.yy, dd/mm/yyyy or yyyy-mm-dd into yyyy-mm-dd. */
function parseDate(text?: string): string | undefined {
	if (!text) {
		return undefined;
	}
	const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
	if (iso) {
		return `${iso[1]}-${iso[2]}-${iso[3]}`;
	}
	const european = text.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2,4})$/);
	if (!european) {
		return undefined;
	}
	const year = european[3].length === 2 ? `20${european[3]}` : european[3];
	return `${year}-${european[2].padStart(2, "0")}-${european[1].padStart(2, "0")}`;
}

function splitCsvLine(line: string, delimiter: string): string[] {
	const cells: string[] = [];
	let cell = "";
	let quoted = false;
	for (let index = 0; index < line.length; index++) {
		const char = line[index];
		if (char === '"') {
			if (quoted && line[index + 1] === '"') {
				cell += '"';
				index++;
			} else {
				quoted = !quoted;
			}
		} else if (char === delimiter && !quoted) {
			cells.push(cell);
			cell = "";
		} else {
			cell += char;
		}
	}
	cells.push(cell);
	return cells;
}

function splitLines(text: string): string[] {
	return text.split(/\r?\n/).filter((line) => line.trim() !== "");
}
