export function addDays(date: Date, days: number): Date {
	const result = new Date(date);
	result.setUTCDate(result.getUTCDate() + days);
	return result;
}

export function firstDayOfMonth(date: Date): Date {
	return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

/**
 * Date helpers working on ISO dates (YYYY-MM-DD) in UTC, matching the database's current_date.
 */
export function isoDate(date: Date): string {
	return date.toISOString().slice(0, 10);
}
