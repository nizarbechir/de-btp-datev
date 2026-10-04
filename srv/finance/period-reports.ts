import cds from "@sap/cds";
import { Readable } from "node:stream";

import { audit } from "../collaboration/audit";
import { isoDate } from "../core/dates";
import { accountantExport } from "./accountant-export";
import { vatOverview } from "./vat-overview";

/**
 * The VAT overview and accountant export of a period, as offered by the Finance and Tax Advisor
 * services. Both are scoped to the current organization.
 */
export function registerPeriodReports(srv: cds.ApplicationService) {
	srv.on("vatOverview", (req) => {
		const { fromDate, toDate } = period(req);
		return vatOverview(fromDate, toDate);
	});
	srv.on("accountantExport", async (req) => {
		const { fromDate, toDate } = period(req);
		const { content, fileName } = await accountantExport(fromDate, toDate);
		await audit({ action: "accountantExport", details: `${fromDate} to ${toDate}`, targetType: "AccountantExport" });
		return {
			$mediaContentDispositionType: "attachment",
			filename: fileName,
			mimetype: "application/zip",
			value: Readable.from(content),
		};
	});
}

/** The requested period; defaults to the current month. */
function period(req: cds.Request): { fromDate: string; toDate: string } {
	const today = new Date();
	const fromDate =
		(req.data.fromDate as string | undefined) ||
		isoDate(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)));
	const toDate = (req.data.toDate as string | undefined) || isoDate(today);
	if (toDate < fromDate) {
		return req.reject(400, "PERIOD_INVALID") as never;
	}
	return { fromDate, toDate };
}
