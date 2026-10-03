import { getCompany } from "../../core/settings";
import { readPdfText } from "../../integrations/pdf/pdf-text";
import { InvoiceDocument, InvoiceExtraction, InvoiceExtractor } from "./invoice-extractor";
import { parseInvoiceText } from "./invoice-text-parser";

/**
 * The text of a digital (not scanned) PDF, searched for the usual invoice labels. Less reliable
 * than an e-invoice, so the values are marked as to be checked.
 */
const minimumTextLength = 50;

export class PdfTextInvoiceExtractor implements InvoiceExtractor {
	readonly name = "PDF text";

	async extract(document: InvoiceDocument): Promise<InvoiceExtraction | undefined> {
		const lines = await readPdfText(document.content);
		if (lines.join("").replace(/\s/g, "").length < minimumTextLength) {
			// No usable text: probably a scanned document
			return undefined;
		}
		const company = await getCompany();
		const data = parseInvoiceText(lines, {
			iban: company?.iban as null | string,
			name: company?.companyName as null | string,
			vatId: company?.vatId as null | string,
		});
		const found = [data.invoiceNumber, data.invoiceDate, data.grossAmount ?? data.netAmount].filter(Boolean).length;
		return {
			data,
			documentType: "PDF",
			message: found
				? "Invoice data read from the PDF text, check every value."
				: "No invoice data recognized in the PDF text. Enter the invoice data.",
		};
	}

	supports(document: InvoiceDocument): boolean {
		return document.mediaType === "application/pdf";
	}
}
