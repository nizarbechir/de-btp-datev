import { describe, expect, it } from "@jest/globals";

import { addDays, firstDayOfMonth, isoDate } from "../../srv/core/dates";

const today = new Date("2026-10-03T10:00:00Z");

describe("dates", () => {
	it("formats dates as ISO dates", () => {
		expect(isoDate(today)).toBe("2026-10-03");
	});

	it("adds days across month boundaries", () => {
		expect(isoDate(addDays(today, 30))).toBe("2026-11-02");
	});

	it("returns the first day of the month", () => {
		expect(isoDate(firstDayOfMonth(today))).toBe("2026-10-01");
	});
});
