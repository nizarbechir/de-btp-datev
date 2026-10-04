import { ExtractedInvoice } from "../../integrations/einvoice/einvoice-types";

/**
 * Finds invoice fields in the plain text of a German or English invoice, by their usual labels.
 * Every value is a proposal: anything unclear is left empty rather than guessed.
 */
export interface OwnCompany {
	iban?: null | string;
	name?: null | string;
	vatId?: null | string;
}

const number = String.raw`[-–]?\d{1,3}(?:[.,']\d{3})*(?:[.,]\d{1,2})?|[-–]?\d+(?:[.,]\d{1,2})?`;
const numericDate = String.raw`\d{1,2}[./-]\d{1,2}[./-](?:\d{4}|\d{2})|\d{4}-\d{2}-\d{2}`;
const monthNames: Record<string, number> = {
	apr: 4,
	april: 4,
	aug: 8,
	august: 8,
	dec: 12,
	december: 12,
	dez: 12,
	dezember: 12,
	feb: 2,
	februar: 2,
	february: 2,
	jan: 1,
	januar: 1,
	january: 1,
	jul: 7,
	juli: 7,
	july: 7,
	jun: 6,
	june: 6,
	juni: 6,
	mai: 5,
	mar: 3,
	march: 3,
	märz: 3,
	may: 5,
	mrz: 3,
	nov: 11,
	november: 11,
	oct: 10,
	october: 10,
	okt: 10,
	oktober: 10,
	sep: 9,
	sept: 9,
	september: 9,
};
const textDate = String.raw`\d{1,2}\.?\s+[a-zäA-Z]{3,9}\.?\s+\d{4}`;
const anyDate = `(${numericDate}|${textDate})`;

const labels = {
	dueDate: String.raw`fällig(?:keit(?:sdatum)?)?(?:\s+(?:am|bis|zum))?|zahlbar\s+bis(?:\s+zum)?|zahlungsziel|due\s+date|payment\s+due|due`,
	grossAmount: String.raw`gesamtbetrag|rechnungsbetrag|bruttobetrag|endbetrag|gesamtsumme|zahlbetrag|zu\s+zahlen(?:der\s+betrag)?|summe\s+brutto|brutto|amount\s+due|total\s+due|grand\s+total|total\s+amount|total(?:\s+\(?(?:gross|incl\.?[^\d]*)\)?)?|gesamt`,
	invoiceDate: String.raw`rechnungsdatum|re\.?-?datum|belegdatum|invoice\s+date|date\s+of\s+issue|datum|date`,
	invoiceNumber: String.raw`rechnungs?-?\s?(?:nummer|nr\.?)|re\.?-?\s?nr\.?|beleg-?\s?(?:nummer|nr\.?)|invoice\s(?:number|no\.?|#)|invoice#|inv\.?\s?no\.?`,
	netAmount: String.raw`nettobetrag|summe\s+netto|gesamt\s+netto|netto(?:summe)?|zwischensumme|net\s+amount|total\s+net|net\s+total|subtotal|net`,
	taxAmount: String.raw`(?:zzgl\.?\s+|incl\.?\s+|inkl\.?\s+|enthaltene\s+)?(?:mwst\.?|ust\.?|umsatzsteuer|mehrwertsteuer|vat|tax)`,
};

export function parseInvoiceText(lines: string[], ownCompany: OwnCompany = {}): ExtractedInvoice {
	const text = lines.join("\n");
	const result: ExtractedInvoice = {};
	result.invoiceNumber = findInvoiceNumber(lines);
	result.invoiceDate = findLabeledDate(lines, labels.invoiceDate, labels.dueDate);
	result.dueDate = findLabeledDate(lines, labels.dueDate);
	result.currency = findCurrency(text);
	result.netAmount = findLabeledAmount(lines, labels.netAmount);
	result.taxAmount = findLabeledAmount(
		lines,
		labels.taxAmount,
		String.raw`steuernummer|ust-?id|vat\s*(?:id|reg)|tax\s*(?:id|number)`,
	);
	result.grossAmount = findLabeledAmount(lines, labels.grossAmount, labels.netAmount);
	completeAmounts(result);
	if (!result.dueDate && result.invoiceDate) {
		result.dueDate = dueFromPaymentTerm(text, result.invoiceDate);
	}
	result.iban = findIban(text, ownCompany.iban);
	result.sellerVatId = findVatId(text, ownCompany.vatId);
	result.sellerTaxNumber = text.match(
		/(?:steuer-?\s*nr\.?|steuernummer|st\.-?\s*nr\.?)[:\s]*(\d{2,3}\/\d{3,4}\/\d{4,5})/i,
	)?.[1];
	result.sellerName = findSellerName(lines, ownCompany.name);
	return Object.fromEntries(Object.entries(result).filter(([, value]) => value !== undefined)) as ExtractedInvoice;
}

/** Fills in the missing one of net, tax and gross; drops values that do not add up. */
function completeAmounts(result: ExtractedInvoice) {
	const net = result.netAmount === undefined ? undefined : Number(result.netAmount);
	const tax = result.taxAmount === undefined ? undefined : Number(result.taxAmount);
	const gross = result.grossAmount === undefined ? undefined : Number(result.grossAmount);
	if (net !== undefined && tax !== undefined && gross === undefined) {
		result.grossAmount = (net + tax).toFixed(2);
	} else if (net !== undefined && tax === undefined && gross !== undefined && gross >= net) {
		result.taxAmount = (gross - net).toFixed(2);
	} else if (net === undefined && tax !== undefined && gross !== undefined && gross >= tax) {
		result.netAmount = (gross - tax).toFixed(2);
	} else if (net !== undefined && tax !== undefined && gross !== undefined && Math.abs(net + tax - gross) > 0.02) {
		// Inconsistent: keep the gross amount only, the user enters net and tax
		result.netAmount = undefined;
		result.taxAmount = undefined;
	}
}

function dueFromPaymentTerm(text: string, invoiceDate: string): string | undefined {
	const days = text.match(/(?:innerhalb\s+(?:von\s+)?|within\s+|net\s+)(\d{1,3})\s*(?:tagen|tage|days)/i)?.[1];
	if (!days) {
		return undefined;
	}
	const date = new Date(`${invoiceDate}T00:00:00Z`);
	date.setUTCDate(date.getUTCDate() + Number(days));
	return date.toISOString().slice(0, 10);
}

function findCurrency(text: string): string | undefined {
	if (/€|\bEUR\b/.test(text)) {
		return "EUR";
	}
	const code = text.match(/\b(CHF|GBP|USD)\b/)?.[1];
	return code ?? (/£/.test(text) ? "GBP" : /\$/.test(text) ? "USD" : undefined);
}

function findIban(text: string, ownIban?: null | string): string | undefined {
	const own = normalize(ownIban);
	for (const match of text.matchAll(/\b([A-Z]{2}\d{2}(?: ?[A-Z0-9]{4}){2,7}(?: ?[A-Z0-9]{1,4})?)\b/g)) {
		const iban = normalize(match[1]);
		if (iban && iban !== own && isValidIban(iban)) {
			return iban;
		}
	}
	return undefined;
}

function findInvoiceNumber(lines: string[]): string | undefined {
	const pattern = new RegExp(
		String.raw`(?:^|[^a-zäöü])(?:${labels.invoiceNumber})[\s:#]{0,4}([A-Z0-9][\w\-/.]{0,48})`,
		"i",
	);
	for (const line of lines) {
		const value = line.match(pattern)?.[1];
		if (value && /\d/.test(value)) {
			return value.replace(/[.\-/]+$/, "");
		}
	}
	return undefined;
}

/** The amount on the line of the label: the last amount, which is the total column. */
function findLabeledAmount(lines: string[], label: string, exclude?: string): string | undefined {
	const pattern = new RegExp(String.raw`(?:^|[^a-zäöü])(?:${label})\b`, "i");
	const excluded = exclude ? new RegExp(String.raw`(?:^|[^a-zäöü])(?:${exclude})\b`, "i") : undefined;
	const amount = new RegExp(String.raw`(?:^|[\s€$£:(])(${number})(?=\s?(?:[$£€]|EUR|USD|CHF|GBP)?\s?\)?$|\s)`, "gi");
	// Totals are at the end of the invoice; the last labeled line wins over item lines
	for (const line of [...lines].reverse()) {
		const labelMatch = line.match(pattern);
		if (!labelMatch || (excluded && excluded.test(line))) {
			continue;
		}
		const afterLabel = `${line.slice((labelMatch.index ?? 0) + labelMatch[0].length)} `;
		const amounts = [...afterLabel.matchAll(amount)]
			.map((match) => match[1])
			.filter(
				(value) =>
					!/^\d{1,2}$/.test(value) &&
					!/%/.test(afterLabel.slice(afterLabel.indexOf(value) + value.length).trimStart()[0] ?? ""),
			);
		const last = amounts.at(-1);
		const value = last === undefined ? undefined : toAmount(last);
		if (value !== undefined) {
			return value;
		}
	}
	return undefined;
}

function findLabeledDate(lines: string[], label: string, exclude?: string): string | undefined {
	const pattern = new RegExp(String.raw`(?:^|[^a-zäöü])(?:${label})\b[^\d\n]{0,20}?${anyDate}`, "i");
	const excluded = exclude ? new RegExp(String.raw`(?:^|[^a-zäöü])(?:${exclude})\b`, "i") : undefined;
	for (const line of lines) {
		const match = line.match(pattern);
		const labelText = match ? line.slice(0, (match.index ?? 0) + match[0].length - match[1].length) : "";
		if (match && !excluded?.test(labelText)) {
			const date = toIsoDate(match[1]);
			if (date) {
				return date;
			}
		}
	}
	return undefined;
}

/** The first line with a company legal form that is not the own company, e.g. the letterhead. */
function findSellerName(lines: string[], ownName?: null | string): string | undefined {
	const own = ownName?.trim().toLowerCase();
	const legalForm =
		/\b(GmbH(?: & Co\.? KG)?|AG|UG(?: \(haftungsbeschränkt\))?|KG|OHG|e\.\s?K\.|GbR|Ltd\.?|Limited|Inc\.?|LLC|SE|S\.?A\.?R\.?L\.?|B\.V\.)(?=$|[\s,·|])/;
	for (const line of lines.slice(0, 40)) {
		const match = line.match(legalForm);
		if (!match) {
			continue;
		}
		// The company name ends with the legal form; address parts after a separator are dropped
		const name = (
			line
				.slice(0, (match.index ?? 0) + match[0].length)
				.split(/\s[·|•,–-]\s|,\s/)
				.at(-1) ?? ""
		).trim();
		if (name.length >= 3 && name.length <= 120 && name.toLowerCase() !== own && !own?.includes(name.toLowerCase())) {
			return name;
		}
	}
	return undefined;
}

function findVatId(text: string, ownVatId?: null | string): string | undefined {
	const own = normalize(ownVatId);
	for (const match of text.matchAll(
		/\b(DE ?\d{9}|AT ?U\d{8}|(?:BE|NL|FR|IT|ES|LU|DK|PL|CZ|SE|FI|IE|PT) ?[0-9A-Z]{8,12})\b/g,
	)) {
		const vatId = normalize(match[1]);
		if (vatId && vatId !== own) {
			return vatId;
		}
	}
	return undefined;
}

function isValidIban(iban: string): boolean {
	if (iban.length < 15 || iban.length > 34) {
		return false;
	}
	const digits = `${iban.slice(4)}${iban.slice(0, 4)}`.replace(/[A-Z]/g, (letter) => String(letter.charCodeAt(0) - 55));
	let remainder = 0;
	for (const digit of digits) {
		remainder = (remainder * 10 + Number(digit)) % 97;
	}
	return remainder === 1;
}

function normalize(value?: null | string): string | undefined {
	return value?.replace(/\s+/g, "").toUpperCase() || undefined;
}

/** Converts 1.234,56 or 1,234.56 or 1234,5 to 1234.56. */
function toAmount(value: string): string | undefined {
	const negative = /^[-–]/.test(value);
	const digits = value.replace(/^[-–]/, "").replace(/[' ]/g, "");
	const decimal = digits.match(/[.,](\d{1,2})$/);
	const integer = (decimal ? digits.slice(0, -decimal[0].length) : digits).replace(/[.,]/g, "");
	const amount = Number(`${integer}.${decimal?.[1] ?? "0"}`);
	if (!Number.isFinite(amount)) {
		return undefined;
	}
	return (negative ? -amount : amount).toFixed(2);
}

function toIsoDate(value: string): string | undefined {
	let day: number, month: number, year: number;
	const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
	const numeric = value.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
	const named = value.match(/^(\d{1,2})\.?\s+([a-zäA-Z]{3,9})\.?\s+(\d{4})$/);
	if (iso) {
		[year, month, day] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
	} else if (numeric) {
		[day, month, year] = [Number(numeric[1]), Number(numeric[2]), Number(numeric[3])];
		year += year < 100 ? 2000 : 0;
	} else if (named && monthNames[named[2].toLowerCase()]) {
		[day, month, year] = [Number(named[1]), monthNames[named[2].toLowerCase()], Number(named[3])];
	} else {
		return undefined;
	}
	const date = new Date(Date.UTC(year, month - 1, day));
	if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day || year < 2000 || year > 2100) {
		return undefined;
	}
	return date.toISOString().slice(0, 10);
}
