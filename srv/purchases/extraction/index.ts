import cds from "@sap/cds";

import { DocumentType, InvoiceDocument, InvoiceExtraction, InvoiceExtractor } from "./invoice-extractor";
import { PdfTextInvoiceExtractor } from "./pdf-text-invoice-extractor";
import { ZugferdInvoiceExtractor } from "./zugferd-invoice-extractor";

export type { DocumentType, InvoiceDocument, InvoiceExtraction, InvoiceExtractor } from "./invoice-extractor";

/** In order of reliability. */
const extractors: InvoiceExtractor[] = [
	new ZugferdInvoiceExtractor(),
	new PdfTextInvoiceExtractor(),
	// TODO(feature): AI/OCR supplier invoice extraction (AiOcrInvoiceExtractor) for scanned PDFs and
	// images, added here as the last extractor; the inbox and the invoice form need no change
];

/**
 * Runs the extractors until one recognizes the document. A failing extractor is logged and the
 * next one is tried. Without a result, the document type and a hint for manual entry are returned.
 */
export async function extractInvoice(document: InvoiceDocument): Promise<InvoiceExtraction> {
	let failed = false;
	for (const extractor of extractors.filter((candidate) => candidate.supports(document))) {
		try {
			const extraction = await extractor.extract(document);
			if (extraction) {
				return extraction;
			}
		} catch (error) {
			failed = true;
			cds.log("invoice-extraction").warn(`${extractor.name} extraction failed`, error);
		}
	}
	const documentType: DocumentType = document.mediaType === "application/pdf" ? "PDF" : "IMAGE";
	return {
		data: {},
		documentType,
		failed,
		message: failed
			? "The document could not be read. Enter the invoice data."
			: documentType === "PDF"
				? "No readable text found (scanned document?). Enter the invoice data."
				: "Enter the invoice data.",
	};
}
