import cds, { Request } from "@sap/cds";
import { Readable } from "node:stream";

import { isoDate } from "../core/dates";
import { accountantExport } from "../finance/accountant-export";
import { importBankStatement } from "../finance/bank-import";
import { dashboard } from "../finance/dashboard";
import { confirmMatch, ignoreTransaction, matchManually, suggestMatches, unmatch } from "../finance/matching";
import { vatOverview } from "../finance/vat-overview";
import { currentOrganization } from "../organizations/organization-context";
import { assertOwned, registerTenantGuard } from "../organizations/tenant-guard";
import { rejectDomainError } from "../payments/payments";

/**
 * Finance: bank import and matching, VAT overview, accountant export and the dashboard.
 */
export default class FinanceService extends cds.ApplicationService {
	async init() {
		const { BankTransactions } = this.entities as Record<string, cds.entity>;
		registerTenantGuard(this);

		this.on("importBankStatement", (req) =>
			guarded(req, () => importBankStatement(req.data.fileName ?? "statement.csv", req.data.content ?? "")),
		);
		this.on("suggestMatches", (req) => guarded(req, () => suggestMatches()));
		this.on("confirmMatch", BankTransactions, (req) => guarded(req, () => confirmMatch(key(req)), true));
		this.on("matchManually", BankTransactions, (req) =>
			guarded(
				req,
				async () => {
					await assertOwned(req, "swiver.SalesInvoices", req.data.salesInvoice, "REFERENCE_OTHER_ORGANIZATION");
					await assertOwned(req, "swiver.SupplierInvoices", req.data.supplierInvoice, "REFERENCE_OTHER_ORGANIZATION");
					await matchManually(key(req), req.data.salesInvoice, req.data.supplierInvoice);
				},
				true,
			),
		);
		this.on("ignore", BankTransactions, (req) => guarded(req, () => ignoreTransaction(key(req)), true));
		this.on("unmatch", BankTransactions, (req) => guarded(req, () => unmatch(key(req)), true));

		// Users without organization see the onboarding instead of figures.
		this.on("dashboard", () => (currentOrganization() ? dashboard() : { needsAttention: [] }));
		this.on("vatOverview", (req) => {
			const { fromDate, toDate } = period(req);
			return vatOverview(fromDate, toDate);
		});
		this.on("accountantExport", async (req) => {
			const { fromDate, toDate } = period(req);
			const { content, fileName } = await accountantExport(fromDate, toDate);
			return {
				$mediaContentDispositionType: "attachment",
				filename: fileName,
				mimetype: "application/zip",
				value: Readable.from(content),
			};
		});
		return super.init();
	}
}

async function guarded(req: Request, operation: () => Promise<unknown>, returnSubject = false) {
	try {
		const result = await operation();
		return returnSubject ? await SELECT.one.from(req.subject) : result;
	} catch (error) {
		return rejectDomainError(req, error);
	}
}

function key(req: Request): string {
	const value = req.params.at(-1);
	return (typeof value === "object" ? (value as { ID: string }).ID : value) as string;
}

/** The requested period; defaults to the current month. */
function period(req: Request): { fromDate: string; toDate: string } {
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
