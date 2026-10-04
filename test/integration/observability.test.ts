import { describe, expect, it } from "@jest/globals";
import cds from "@sap/cds";

/**
 * Operations visibility: health checks without the business UI, and failure logs that identify the
 * operation without exposing uploaded data.
 */
const projectRootDir = __dirname + "../../..";
const test = cds.test("serve", "--project", projectRootDir);
const { axios, GET, POST } = test;
const log = test.log();

axios.defaults.validateStatus = () => true;
const alice = { auth: { password: "alice", username: "alice" } };

describe("Health", () => {
	it("answers liveness and readiness without authentication and without data", async () => {
		const live = await GET("/health");
		expect(live.status).toBe(200);
		expect(live.data).toMatchObject({ status: "UP" });

		const ready = await GET("/health/ready");
		expect(ready.status).toBe(200);
		expect(ready.data).toEqual({ database: "UP", status: "UP" });
	});
});

describe("Failure logs", () => {
	it("log a rejected bank import with operation and organization, but not the statement content", async () => {
		const content = "this is not a bank statement; IBAN DE02100100100000000004 SECRET-PAYLOAD";
		const response = await POST("/odata/v4/finance/importBankStatement", { content, fileName: "x.csv" }, alice);

		expect(response.status).toBeGreaterThanOrEqual(400);
		expect(log.output).toContain("importBankStatement");
		expect(log.output).toContain("77777777-0000-4000-8000-000000000001");
		expect(log.output).not.toContain("SECRET-PAYLOAD");
		expect(log.output).not.toContain("DE02100100100000000004");
	});

	it("log a failed e-mail send so a missing e-mail configuration can be diagnosed", async () => {
		const invoice = "/odata/v4/sales/SalesInvoices(ID=44444444-0000-4000-8000-000000000005,IsActiveEntity=true)";
		const response = await POST(`${invoice}/SalesService.sendReminder`, { recipient: "customer@example.com" }, alice);

		expect(response.status).toBe(503);
		expect(log.output).toMatch(/sendReminder failed/);
		expect(log.output).toContain("44444444-0000-4000-8000-000000000005");
	});
});
