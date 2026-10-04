import { requireOrganization } from "../organizations/organization-context";

const NumberRanges = "swiver.NumberRanges";

export async function nextCustomerNumber(): Promise<string> {
	return `CUS-${1000 + (await nextNumber("Customer"))}`;
}

/**
 * Returns the next number of a number range of the current organization, starting at 1.
 * Every organization has its own ranges, so two organizations can both have INV-2026-0001.
 * Must run inside the transaction that stores the numbered document: the update locks the range
 * until it commits, so parallel saves wait for each other, and a failed save gives the number back.
 */
export async function nextNumber(name: string): Promise<number> {
	return nextInRange(`${requireOrganization()}:${name}`);
}

/** Quote numbers restart every year, e.g. QUO-2026-0001. */
export async function nextQuoteNumber(prefix: string, quoteDate: string): Promise<string> {
	const year = quoteDate.slice(0, 4);
	const number = await nextNumber(`Quote-${year}`);
	return `${prefix}-${year}-${String(number).padStart(4, "0")}`;
}

/** Sales invoice numbers restart every year, e.g. INV-2026-0001. */
export async function nextSalesInvoiceNumber(prefix: string, invoiceDate: string): Promise<string> {
	const year = invoiceDate.slice(0, 4);
	const number = await nextNumber(`SalesInvoice-${year}`);
	return `${prefix}-${year}-${String(number).padStart(4, "0")}`;
}

/** Support ticket numbers are shared by all organizations: 1001, 1002, ... */
export async function nextSupportTicketNumber(): Promise<number> {
	return 1000 + (await nextInRange("SupportTicket"));
}

async function increment(range: string): Promise<number> {
	return UPDATE(NumberRanges).set`lastNumber = lastNumber + 1`.where({ range });
}

async function nextInRange(range: string): Promise<number> {
	if (!(await increment(range))) {
		try {
			await INSERT.into(NumberRanges).entries({ lastNumber: 1, range });
			return 1;
		} catch (error) {
			// A parallel save created the range first (unique key): continue with its next number.
			if (!(await increment(range))) {
				throw error;
			}
		}
	}
	const { lastNumber } = (await SELECT.one.from(NumberRanges).columns("lastNumber").where({ range })) as {
		lastNumber: number;
	};
	return lastNumber;
}
