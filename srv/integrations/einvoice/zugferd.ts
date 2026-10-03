import { PdfArchiveOptions } from "../../core/invoice-pdf";
import { documentFonts } from "../../core/pdf-fonts";
import { readCii } from "./cii-reader";
import { writeCii } from "./cii-writer";
import { EInvoiceContext, ExtractedInvoice } from "./einvoice-types";
import { readEmbeddedFiles } from "./pdf-attachments";
import { facturXXmp } from "./xmp";

/**
 * ZUGFeRD 2.x (Factur-X), profile EN 16931: a PDF/A-3 invoice with the structured invoice data
 * embedded as factur-x.xml.
 * - generate: XML plus the options to render the PDF/A-3 with any renderer that supports them
 * - extract: the invoice data of a received ZUGFeRD PDF
 * - validate: the EN 16931 fields this application must provide
 * TODO(feature): XRechnung support
 * TODO(feature): full schema and schematron validation (e.g. KoSIT validator)
 */
export const xmlFileName = "factur-x.xml";
const knownXmlNames = [xmlFileName, "zugferd-invoice.xml", "ZUGFeRD-invoice.xml", "xrechnung.xml"];
const conformanceLevel = "EN 16931";

export class ZugferdValidationError extends Error {
	constructor(public problems: string[]) {
		super(`The e-invoice is incomplete: ${problems.join(", ")}`);
	}
}

/** The invoice data of a ZUGFeRD / Factur-X PDF, or undefined if the PDF contains no e-invoice. */
export async function extract(pdf: Buffer): Promise<undefined | { data: ExtractedInvoice; xml: string }> {
	const files = await readEmbeddedFiles(pdf);
	const file =
		files.find((entry) => knownXmlNames.some((name) => name.toLowerCase() === entry.name.toLowerCase())) ??
		files.find((entry) => entry.name.toLowerCase().endsWith(".xml"));
	if (!file) {
		return undefined;
	}
	const xml = file.content.toString("utf8");
	return { data: readCii(xml), xml };
}

/** The XML and the PDF/A-3 options (fonts, attachment, XMP) for rendering the invoice PDF. */
export function generate(invoice: EInvoiceContext): { pdfOptions: PdfArchiveOptions; xml: string } {
	const problems = validate(invoice);
	if (problems.length) {
		throw new ZugferdValidationError(problems);
	}
	const xml = writeCii(invoice);
	return {
		pdfOptions: {
			attachments: [
				{
					content: Buffer.from(xml, "utf8"),
					description: "Factur-X/ZUGFeRD invoice",
					mimeType: "text/xml",
					name: xmlFileName,
					relationship: "Alternative",
				},
			],
			fonts: documentFonts,
			xmp: facturXXmp(xmlFileName, conformanceLevel),
		},
		xml,
	};
}

/** Missing or inconsistent EN 16931 information, as readable problem descriptions. */
export function validate(invoice: EInvoiceContext): string[] {
	const problems: string[] = [];
	const require = (value: unknown, problem: string) => {
		if (value === undefined || value === null || value === "") {
			problems.push(problem);
		}
	};
	require(invoice.invoiceNumber, "invoice number");
	require(invoice.invoiceDate, "invoice date");
	require(invoice.currency, "currency");
	require(invoice.seller.name, "seller name (company settings)");
	require(invoice.seller.countryCode, "seller country (company settings)");
	if (!invoice.seller.vatId && !invoice.seller.taxNumber) {
		problems.push("seller VAT ID or tax number (company settings)");
	}
	require(invoice.buyer.name, "customer name");
	require(invoice.buyer.countryCode, "customer country");
	if (!invoice.lines.length) {
		problems.push("at least one item");
	}
	const cents = (value: string) => Math.round(Number(value) * 100);
	const sum = (values: string[]) => values.reduce((total, value) => total + cents(value), 0);
	if (sum(invoice.lines.map((line) => line.netAmount)) !== cents(invoice.netAmount)) {
		problems.push("item amounts do not add up to the net amount");
	}
	if (sum(invoice.taxes.map((tax) => tax.taxAmount)) !== cents(invoice.taxAmount)) {
		problems.push("VAT lines do not add up to the VAT amount");
	}
	if (cents(invoice.netAmount) + cents(invoice.taxAmount) !== cents(invoice.grossAmount)) {
		problems.push("net amount and VAT do not add up to the total");
	}
	return problems;
}
