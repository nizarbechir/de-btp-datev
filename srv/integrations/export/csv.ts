/**
 * CSV files for spreadsheets and tax advisers: semicolon-separated, UTF-8 with BOM so Excel
 * detects the encoding, values quoted when needed.
 */
export function toCsv<T extends Record<string, unknown>>(rows: T[], columns: (keyof T & string)[]): string {
	const lines = [columns.join(";"), ...rows.map((row) => columns.map((column) => cell(row[column])).join(";"))];
	return `\uFEFF${lines.join("\r\n")}\r\n`;
}

function cell(value: unknown): string {
	if (value === null || value === undefined) {
		return "";
	}
	const text = String(value);
	return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
