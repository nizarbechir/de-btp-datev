const NumberRanges = "swiver.NumberRanges";

export async function nextCustomerNumber(): Promise<string> {
	return `CUS-${1000 + (await nextNumber("Customer"))}`;
}

/**
 * Returns the next number of a number range, starting at 1.
 * Must run inside the transaction that stores the numbered document: the update locks the range
 * until it commits, so parallel saves wait for each other, and a failed save gives the number back.
 */
export async function nextNumber(range: string): Promise<number> {
	const updated = await UPDATE(NumberRanges).set`lastNumber = lastNumber + 1`.where({ range });
	if (!updated) {
		await INSERT.into(NumberRanges).entries({ lastNumber: 1, range });
		return 1;
	}
	const { lastNumber } = (await SELECT.one.from(NumberRanges).columns("lastNumber").where({ range })) as {
		lastNumber: number;
	};
	return lastNumber;
}

/** Sales invoice numbers restart every year, e.g. INV-2026-0001. */
export async function nextSalesInvoiceNumber(prefix: string, invoiceDate: string): Promise<string> {
	const year = invoiceDate.slice(0, 4);
	const number = await nextNumber(`SalesInvoice-${year}`);
	return `${prefix}-${year}-${String(number).padStart(4, "0")}`;
}
