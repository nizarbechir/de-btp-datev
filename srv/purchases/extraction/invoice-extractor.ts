import { ExtractedInvoice } from "../../integrations/einvoice/einvoice-types";

/**
 * Reads invoice data from an uploaded supplier document. Extractors are tried in order of
 * reliability; the first one that recognizes the document wins. Results are only proposals:
 * the user always checks them before a supplier invoice is created.
 */
export type DocumentType = "IMAGE" | "PDF" | "ZUGFERD";

export interface InvoiceDocument {
	content: Buffer;
	mediaType: string;
}

export interface InvoiceExtraction {
	data: ExtractedInvoice;
	documentType: DocumentType;
	/** True when an extractor failed and none recognized the document. */
	failed?: boolean;
	/** Shown to the user, e.g. how reliable the values are. */
	message: string;
}

export interface InvoiceExtractor {
	/** The invoice data, or undefined when the extractor does not recognize the document. */
	extract(document: InvoiceDocument): Promise<InvoiceExtraction | undefined>;
	readonly name: string;
	supports(document: InvoiceDocument): boolean;
}
