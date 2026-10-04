import { describe, expect, it } from "@jest/globals";
import cds from "@sap/cds";
import { Readable } from "node:stream";

/**
 * Field-level change history of financial records (db/change-tracking.cds): actor and timestamp per
 * changed field, no binary documents or derived totals, readable only together with the record.
 */
const projectRootDir = __dirname + "../../..";
const { axios, GET, PATCH, POST } = cds.test("serve", "--project", projectRootDir);

axios.defaults.auth = { password: "alice", username: "alice" };
axios.defaults.validateStatus = () => true;

const SALES = "/odata/v4/sales";
const ORGANIZATION = "/odata/v4/organization";
const settings = (active: boolean) => `${ORGANIZATION}/CompanySettings(ID=1,IsActiveEntity=${active})`;
const invoiceID = "44444444-0000-4000-8000-000000000008";
const invoice = `${SALES}/SalesInvoices(ID=${invoiceID},IsActiveEntity=true)`;

interface Change {
	attribute: string;
	createdAt: string;
	createdBy: string;
	valueChangedFrom: null | string;
	valueChangedTo: null | string;
}

async function changes(url: string, after = "1970-01-01"): Promise<Change[]> {
	const { data } = await GET(`${url}/changes?$filter=createdAt gt ${after}T00:00:00Z`);
	return (data.value as Change[]).filter((change) => change.createdBy !== "anonymous");
}

describe("Change history", () => {
	it("records who changed which company setting, including bank details", async () => {
		await POST(`${settings(true)}/OrganizationService.draftEdit`, {});
		await PATCH(settings(false), { bic: "PBNKDEFF", iban: "DE02100100100000000004", website: "new.example" });
		await POST(`${settings(false)}/OrganizationService.draftActivate`, {});

		const history = await changes(settings(true));
		expect(history).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ attribute: "iban", createdBy: "alice", valueChangedTo: "DE02100100100000000004" }),
				expect.objectContaining({ attribute: "bic", createdBy: "alice", valueChangedTo: "PBNKDEFF" }),
				expect.objectContaining({ attribute: "website", createdBy: "alice", valueChangedTo: "new.example" }),
			]),
		);
		expect(history.every((change) => !Number.isNaN(Date.parse(change.createdAt)))).toBe(true);
	});

	it("does not store uploaded documents or logos in the history", async () => {
		await POST(`${settings(true)}/OrganizationService.draftEdit`, {});
		const png = Readable.from([Buffer.from("89504e470d0a1a0a0000000d49484452", "hex")]);
		expect((await axios.put(`${settings(false)}/logo`, png, { headers: { "Content-Type": "image/png" } })).status).toBe(
			204,
		);
		await POST(`${settings(false)}/OrganizationService.draftActivate`, {});

		const attributes = (await changes(settings(true))).map((change) => change.attribute);
		expect(attributes).not.toContain("logo");
		expect(attributes).not.toContain("logoMediaType");
	});

	it("records payment status changes of an invoice, but not the derived paid amount", async () => {
		expect((await POST(`${invoice}/SalesService.recordPayment`, { amount: 100 })).status).toBe(200);

		const history = await changes(invoice);
		expect(history).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ attribute: "paymentStatus", createdBy: "alice", valueChangedTo: "PARTIAL" }),
			]),
		);
		expect(history.map((change) => change.attribute)).not.toContain("paidAmount");
	});

	it("records status changes of the invoice lifecycle, next to the business audit log", async () => {
		const unpaid = `${SALES}/SalesInvoices(ID=44444444-0000-4000-8000-000000000009,IsActiveEntity=true)`;
		expect((await POST(`${unpaid}/SalesService.cancelInvoice`, {})).status).toBe(200);
		const history = await changes(unpaid);
		expect(history).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					attribute: "status",
					createdBy: "alice",
					valueChangedFrom: "SENT",
					valueChangedTo: "CANCELLED",
				}),
			]),
		);

		const audit = await GET(`${ORGANIZATION}/AuditLogEntries?$filter=action eq 'cancelInvoice'&$count=true`);
		expect(audit.data["@odata.count"]).toBeGreaterThan(0);
	});

	it("shows the history only to users who may read the record", async () => {
		const asOtherUser = { auth: { password: "carol", username: "carol" } };
		const response = await GET(`${invoice}/changes`, asOtherUser);
		expect([403, 404]).toContain(response.status);
		expect([403, 405]).toContain((await GET(`${SALES}/ChangeView`)).status);
	});
});
