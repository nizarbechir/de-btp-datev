import { describe, expect, it } from "@jest/globals";
import cds from "@sap/cds";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { decodePDFRawStream, PDFArray, PDFDict, PDFDocument, PDFName, PDFRawStream } from "pdf-lib";

import { extract } from "../../srv/integrations/einvoice/zugferd";

/**
 * ZUGFeRD / Factur-X output of real invoices from the test data: the embedded CII XML, its amounts
 * and the PDF/A-3 parts that tie the XML to the PDF. Full XSD, Schematron and veraPDF validation runs
 * with `npm run validate:zugferd`, which validates the PDFs this test writes to ZUGFERD_OUT.
 */
const projectRootDir = __dirname + "../../..";
const { axios, GET } = cds.test("serve", "--project", projectRootDir);

axios.defaults.auth = { password: "alice", username: "alice" };
axios.defaults.validateStatus = () => true;

const SERVICE = "/odata/v4/sales";
const singleRate = "44444444-0000-4000-8000-000000000001";
const twoRates = "44444444-0000-4000-8000-000000000002";

function all(xml: string, tag: string): string[] {
	return [...xml.matchAll(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, "g"))].map((match) => match[1]);
}

function cents(value: string): number {
	return Math.round(Number(value) * 100);
}

async function zugferdPdf(id: string): Promise<Buffer> {
	const response = await GET(
		`${SERVICE}/SalesInvoices(ID=${id},IsActiveEntity=true)/SalesService.zugferd(download=true)`,
		{ responseType: "arraybuffer" },
	);
	expect(response.status).toBe(200);
	const pdf = Buffer.from(response.data as ArrayBuffer);
	if (process.env.ZUGFERD_OUT) {
		mkdirSync(process.env.ZUGFERD_OUT, { recursive: true });
		writeFileSync(join(process.env.ZUGFERD_OUT, `${id}.pdf`), pdf);
	}
	return pdf;
}

describe("ZUGFeRD invoice", () => {
	it("embeds a complete EN 16931 invoice with a single 19 % VAT rate", async () => {
		const pdf = await zugferdPdf(singleRate);
		const embedded = await extract(pdf);

		expect(embedded).toBeDefined();
		const xml = embedded?.xml ?? "";
		expect(xml).toContain("<ram:ID>urn:cen.eu:en16931:2017</ram:ID>");
		expect(all(xml, "ram:TypeCode")[0]).toBe("380");
		expect(embedded?.data).toMatchObject({
			currency: "EUR",
			grossAmount: "9044.00",
			invoiceNumber: "INV-2026-0001",
			netAmount: "7600.00",
			taxAmount: "1444.00",
		});
		expect(all(xml, "ram:RateApplicablePercent")).toEqual(["19.00", "19.00"]);
		// Seller VAT ID and IBAN, required by the footer check before an invoice is issued
		expect(xml).toMatch(/<ram:ID schemeID="VA">DE\d+<\/ram:ID>/);
		expect(xml).toMatch(/<ram:IBANID>DE\d+<\/ram:IBANID>/);
	});

	it("adds up line items and VAT breakdown of an invoice with 19 % and 7 % items", async () => {
		const embedded = await extract(await zugferdPdf(twoRates));
		const xml = embedded?.xml ?? "";
		const lineTotals = all(xml, "ram:LineTotalAmount");
		// Three items, then the document line total
		expect(lineTotals).toHaveLength(4);
		const items = lineTotals.slice(0, 3).reduce((sum, value) => sum + cents(value), 0);
		expect(items).toBe(cents(lineTotals[3]));

		const taxBlocks = [...xml.matchAll(/<ram:ApplicableTradeTax><ram:CalculatedAmount>.*?<\/ram:ApplicableTradeTax>/g)];
		const breakdown = taxBlocks.map(([block]) => ({
			basis: all(block, "ram:BasisAmount")[0],
			rate: all(block, "ram:RateApplicablePercent")[0],
			tax: all(block, "ram:CalculatedAmount")[0],
		}));
		expect(breakdown).toEqual([
			{ basis: "2740.00", rate: "19.00", tax: "520.60" },
			{ basis: "149.70", rate: "7.00", tax: "10.48" },
		]);
		expect(embedded?.data).toMatchObject({ grossAmount: "3420.78", netAmount: "2889.70", taxAmount: "531.08" });
	});

	it("marks the PDF as PDF/A-3 with the XML as Factur-X alternative representation", async () => {
		const document = await PDFDocument.load(await zugferdPdf(twoRates), { updateMetadata: false });
		const catalog = document.catalog;

		const associated = catalog.lookup(PDFName.of("AF"), PDFArray);
		const fileSpec = associated.lookup(0, PDFDict);
		expect(fileSpec.get(PDFName.of("AFRelationship"))?.toString()).toBe("/Alternative");
		expect(fileSpec.get(PDFName.of("F"))?.toString()).toContain("factur-x.xml");

		const metadata = catalog.lookup(PDFName.of("Metadata")) as PDFRawStream;
		const xmp = Buffer.from(decodePDFRawStream(metadata).decode()).toString("utf8");
		expect(xmp).toMatch(/pdfaid:part(>|=")3/);
		expect(xmp).toMatch(/pdfaid:conformance(>|=")B/);
		expect(xmp).toContain("<fx:DocumentFileName>factur-x.xml</fx:DocumentFileName>");
		expect(xmp).toContain("<fx:ConformanceLevel>EN 16931</fx:ConformanceLevel>");
		expect(catalog.lookup(PDFName.of("OutputIntents"), PDFArray).size()).toBeGreaterThan(0);
	});
});
