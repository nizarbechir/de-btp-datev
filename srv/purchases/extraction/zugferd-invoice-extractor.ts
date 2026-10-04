import { extract } from "../../integrations/einvoice/zugferd";
import { InvoiceDocument, InvoiceExtraction, InvoiceExtractor } from "./invoice-extractor";

/** Structured data embedded in a ZUGFeRD / Factur-X PDF: exact, as issued by the supplier. */
export class ZugferdInvoiceExtractor implements InvoiceExtractor {
	readonly name = "ZUGFeRD";

	async extract(document: InvoiceDocument): Promise<InvoiceExtraction | undefined> {
		const einvoice = await extract(document.content);
		if (!einvoice) {
			return undefined;
		}
		return { data: einvoice.data, documentType: "ZUGFERD", message: "E-invoice read." };
	}

	supports(document: InvoiceDocument): boolean {
		return document.mediaType === "application/pdf";
	}
}
