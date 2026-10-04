import { describe, expect, it } from "@jest/globals";

import { serviceDateRow } from "../../srv/core/invoice-pdf";
import { labelsFor, supplyKind } from "../../srv/core/invoice-pdf-labels";

const german = labelsFor("DE");
const date = (value: null | string | undefined) => String(value);

describe("service date wording on invoices", () => {
	it("tells goods, services and a mix apart by the product types of the lines", () => {
		expect(supplyKind([])).toBe("services");
		expect(supplyKind(["SERVICE", undefined])).toBe("services");
		expect(supplyKind(["GOODS", "GOODS"])).toBe("goods");
		expect(supplyKind(["GOODS", "SERVICE"])).toBe("mixed");
	});

	it("prints Leistungsdatum and Leistungszeitraum for services, as before", () => {
		expect(serviceDateRow({ invoiceDate: "2026-10-01" }, german, date)).toEqual(["Leistungsdatum", "2026-10-01"]);
		const period = { servicePeriodEnd: "2026-09-30", servicePeriodStart: "2026-09-01" };
		expect(serviceDateRow(period, german, date)[0]).toBe("Leistungszeitraum");
	});

	it("prints Lieferdatum for goods", () => {
		const invoice = { invoiceDate: "2026-10-05", servicePeriodStart: "2026-10-02", supplyKind: "goods" as const };
		expect(serviceDateRow(invoice, german, date)).toEqual(["Lieferdatum", "2026-10-02"]);
		expect(serviceDateRow({ ...invoice, supplyKind: "mixed" }, german, date)[0]).toBe("Liefer-/Leistungsdatum");
	});
});
