/**
 * Invoice calculations on decimal values. Amounts are calculated as integers in their smallest unit
 * (cents for amounts, thousandths for quantities, hundredths for tax rates), never as floating point.
 */

export interface InvoiceTotals extends ItemAmounts {
	taxes: TaxLine[];
}

export interface ItemAmounts {
	grossAmount: string;
	netAmount: string;
	taxAmount: string;
}

export interface ItemInput {
	quantity?: Decimal;
	taxRate?: Decimal;
	unitPrice?: Decimal;
}

export interface TaxLine {
	netAmount: string;
	taxAmount: string;
	taxRate: string;
}

type Decimal = null | number | string | undefined;

const decimalPattern = /^[+-]?\d*(?:\.\d*)?$/;

/** Invoice totals as the sum of the item amounts, plus net and tax per tax rate (highest rate first). */
export function calculateInvoice(items: ItemInput[]): InvoiceTotals {
	let net = 0n;
	let tax = 0n;
	const byRate = new Map<bigint, { net: bigint; tax: bigint }>();
	for (const item of items) {
		const amounts = itemCents(item);
		net += amounts.net;
		tax += amounts.tax;
		const rate = toUnits(item.taxRate, 2);
		const sum = byRate.get(rate) ?? { net: 0n, tax: 0n };
		byRate.set(rate, { net: sum.net + amounts.net, tax: sum.tax + amounts.tax });
	}
	const taxes = [...byRate.entries()]
		.sort(([first], [second]) => (first < second ? 1 : -1))
		.map(([rate, sum]) => ({
			netAmount: fromUnits(sum.net, 2),
			taxAmount: fromUnits(sum.tax, 2),
			taxRate: fromUnits(rate, 2),
		}));
	return { grossAmount: fromUnits(net + tax, 2), netAmount: fromUnits(net, 2), taxAmount: fromUnits(tax, 2), taxes };
}

/** Item amounts: net = quantity × unit price, tax = net × tax rate / 100, gross = net + tax, each rounded to cents. */
export function calculateItem(item: ItemInput): ItemAmounts {
	const { net, tax } = itemCents(item);
	return { grossAmount: fromUnits(net + tax, 2), netAmount: fromUnits(net, 2), taxAmount: fromUnits(tax, 2) };
}

/** Formats an integer with the given number of decimal places as a decimal string, e.g. 1234n, 2 → "12.34". */
export function fromUnits(units: bigint, scale: number): string {
	const negative = units < 0n;
	const digits = (negative ? -units : units).toString().padStart(scale + 1, "0");
	const text = `${digits.slice(0, -scale)}.${digits.slice(-scale)}`;
	return negative ? `-${text}` : text;
}

/** Converts a decimal to an integer with the given number of decimal places, rounding half away from zero. */
export function toUnits(value: Decimal, scale: number): bigint {
	let text = typeof value === "number" ? value.toFixed(scale + 1) : String(value ?? "").trim();
	if (!text || !decimalPattern.test(text)) {
		return 0n;
	}
	const negative = text.startsWith("-");
	text = text.replace(/^[+-]/, "");
	const [whole = "", fraction = ""] = text.split(".");
	const digits = BigInt((whole || "0") + fraction.padEnd(scale + 1, "0").slice(0, scale + 1));
	const rounded = (digits + 5n) / 10n;
	return negative ? -rounded : rounded;
}

/** Integer division rounding half away from zero. */
function divide(dividend: bigint, divisor: bigint): bigint {
	const negative = dividend < 0n;
	const absolute = negative ? -dividend : dividend;
	const result = (absolute + divisor / 2n) / divisor;
	return negative ? -result : result;
}

function itemCents(item: ItemInput) {
	// quantity (3 decimals) × unit price (2 decimals) has 5 decimals
	const net = divide(toUnits(item.quantity, 3) * toUnits(item.unitPrice, 2), 1000n);
	// net (2 decimals) × tax rate in percent (2 decimals) / 100 has 6 decimals
	const tax = divide(net * toUnits(item.taxRate, 2), 10000n);
	return { net, tax };
}
