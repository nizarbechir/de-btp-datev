import { beforeAll, describe, expect, it } from "@jest/globals";
import cds from "@sap/cds";
import { unzipSync } from "fflate";
import { Readable } from "node:stream";

import { detectDocumentType, sanitizeFileName } from "../../srv/core/document-upload";

/**
 * Upload and download safety for financial documents: real file type from the content, size limit,
 * file names that can never become paths, malformed documents that fail safely, and export entries
 * that do not use user-controlled names. Cross-organization downloads: tenant-isolation.test.ts.
 */
const projectRootDir = __dirname + "../../..";
const { axios, GET, PATCH, POST } = cds.test("serve", "--project", projectRootDir);

axios.defaults.auth = { password: "alice", username: "alice" };
axios.defaults.validateStatus = () => true;

const PURCHASING = "/odata/v4/purchasing";
const pdf = "%PDF-1.4\n1 0 obj <<>> endobj\ntrailer <<>>\n%%EOF";
const png = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex");
const jpeg = Buffer.from("ffd8ffe000104a464946", "hex");

let draft: string;

async function upload(url: string, content: Buffer | string, contentType: string) {
	// The test client sends strings and streams as they are (other objects as JSON)
	const body = typeof content === "string" ? content : Readable.from([content]);
	return axios.put(url, body, { headers: { "Content-Type": contentType } });
}

beforeAll(async () => {
	const created = await POST(`${PURCHASING}/SupplierInvoices`, {});
	draft = `${PURCHASING}/SupplierInvoices(ID=${created.data.ID},IsActiveEntity=false)`;
});

describe("Detecting the file type", () => {
	it("recognizes PDF, PNG and JPEG by their content only", () => {
		expect(detectDocumentType(Buffer.from(pdf))).toBe("application/pdf");
		expect(detectDocumentType(png)).toBe("image/png");
		expect(detectDocumentType(jpeg)).toBe("image/jpeg");
		expect(detectDocumentType(Buffer.from("MZ executable"))).toBeUndefined();
		expect(detectDocumentType(Buffer.from("<html><script>"))).toBeUndefined();
		expect(detectDocumentType(Buffer.alloc(0))).toBeUndefined();
	});

	it("turns user-controlled file names into plain names", () => {
		expect(sanitizeFileName("../../etc/passwd")).toBe("passwd");
		expect(sanitizeFileName("C:\\Users\\x\\invoice.pdf")).toBe("invoice.pdf");
		expect(sanitizeFileName('inv"oice\r\nX-Header: 1.pdf')).toBe("invoiceX-Header 1.pdf");
		expect(sanitizeFileName("...hidden")).toBe("hidden");
		expect(sanitizeFileName("../")).toBeUndefined();
		expect(sanitizeFileName("a".repeat(300))).toHaveLength(255);
	});
});

describe("Uploading a supplier invoice document", () => {
	it("accepts PDF, PNG and JPEG and stores the detected type", async () => {
		for (const [content, type] of [
			[pdf, "application/pdf"],
			[png, "image/png"],
			[jpeg, "image/jpeg"],
		] as const) {
			expect((await upload(`${draft}/documentContent`, content, type)).status).toBe(204);
			expect((await GET(draft)).data.documentMediaType).toBe(type);
		}
	});

	it.each([
		["text declared as text", "plain text", "text/plain"],
		["text declared as PDF", "plain text", "application/pdf"],
		["HTML declared as PDF", "<html><script>alert(1)</script>", "application/pdf"],
		["a PDF declared as PNG", pdf, "image/png"],
		["an executable declared as JPEG", "MZ\u0090\u0000", "image/jpeg"],
	])("rejects %s", async (_name, content, type) => {
		expect((await upload(`${draft}/documentContent`, content, type)).status).toBe(415);
	});

	it("rejects documents above the size limit", async () => {
		const large = Buffer.concat([Buffer.from(pdf), Buffer.alloc(10 * 1024 * 1024)]);
		expect((await upload(`${draft}/documentContent`, large, "application/pdf")).status).toBe(413);
	});

	it("stores only a plain file name", async () => {
		await PATCH(draft, { documentFileName: "../../../etc/passwd" });
		expect((await GET(draft)).data.documentFileName).toBe("passwd");
	});

	it("keeps a malformed PDF from breaking the draft (no extracted data, no server error)", async () => {
		const response = await upload(`${draft}/documentContent`, "%PDF-1.7 this is not really a pdf", "application/pdf");
		expect(response.status).toBe(204);
		expect((await GET(draft)).status).toBe(200);
	});
});

describe("Inbox and logo", () => {
	it("processes a malformed inbox PDF without failing the request", async () => {
		const created = await POST(`${PURCHASING}/IncomingDocuments`, {});
		const url = `${PURCHASING}/IncomingDocuments(ID=${created.data.ID},IsActiveEntity=false)`;
		expect((await upload(`${url}/content`, "%PDF-1.4 broken", "application/pdf")).status).toBe(204);
		expect((await upload(`${url}/content`, "<svg onload=alert(1)>", "image/png")).status).toBe(415);
		const saved = await POST(`${url}/PurchasingService.draftActivate`, {});
		expect(saved.status).toBe(201);
	});

	it("accepts only PNG and JPEG logos", async () => {
		const settings = "/odata/v4/organization/CompanySettings(ID=1,IsActiveEntity=false)";
		await POST("/odata/v4/organization/CompanySettings(ID=1,IsActiveEntity=true)/OrganizationService.draftEdit", {});
		expect((await upload(`${settings}/logo`, pdf, "application/pdf")).status).toBe(415);
		expect((await upload(`${settings}/logo`, pdf, "image/png")).status).toBe(415);
		expect((await upload(`${settings}/logo`, png, "image/png")).status).toBe(204);
		await POST(`${settings}/OrganizationService.draftActivate`, {});
	});
});

describe("Accountant export", () => {
	it("names document entries from invoice data and media type, never from the uploaded file name", async () => {
		const invoice = "22222222-0000-4000-8000-000000000002";
		await POST(`${PURCHASING}/SupplierInvoices(ID=${invoice},IsActiveEntity=true)/PurchasingService.draftEdit`, {});
		const edit = `${PURCHASING}/SupplierInvoices(ID=${invoice},IsActiveEntity=false)`;
		await upload(`${edit}/documentContent`, pdf, "application/pdf");
		await PATCH(edit, { documentFileName: "x.pdf/../../../evil.sh" });
		expect((await POST(`${edit}/PurchasingService.draftActivate`, {})).status).toBe(200);

		const response = await GET("/odata/v4/finance/accountantExport(fromDate=2000-01-01,toDate=2099-12-31)", {
			responseType: "arraybuffer",
		});
		expect(response.status).toBe(200);
		const entries = Object.keys(unzipSync(new Uint8Array(response.data as ArrayBuffer)));
		const documents = entries.filter((entry) => entry.startsWith("purchases/"));
		expect(documents.length).toBeGreaterThan(0);
		for (const entry of entries) {
			expect(entry).not.toContain("..");
			expect(entry).not.toMatch(/^\//);
		}
		expect(documents.every((entry) => /\.(?:pdf|png|jpg)$/.test(entry))).toBe(true);
	});
});
