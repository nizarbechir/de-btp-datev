import cds, { Request } from "@sap/cds";

import { registerChangeHistoryGuard } from "../authorization/change-history-guard";
import { registerReadOnlyFlag } from "../authorization/read-only-flag";
import { auditActions } from "../collaboration/audit";
import { registerComments } from "../collaboration/comments";
import { logFailure } from "../core/operation-log";
import { boundID, rejectDomainError } from "../core/requests";
import { importBankStatement } from "../finance/bank-import";
import { dashboard } from "../finance/dashboard";
import { confirmMatch, ignoreTransaction, matchManually, suggestMatches, unmatch } from "../finance/matching";
import { registerPeriodReports } from "../finance/period-reports";
import { currentOrganization } from "../organizations/organization-context";
import { assertOwned, registerTenantGuard } from "../organizations/tenant-guard";

/**
 * Finance: bank import and matching, VAT overview, accountant export and the dashboard.
 */
export default class FinanceService extends cds.ApplicationService {
	async init() {
		const { BankTransactions } = this.entities as Record<string, cds.entity>;
		registerTenantGuard(this);
		registerChangeHistoryGuard(this);
		registerReadOnlyFlag(this);
		registerComments(this, { BankTransactions: "bankTransaction" });
		auditActions(this, { BankTransactions: ["confirmMatch", "matchManually", "unmatch", "ignore"] });

		this.on("importBankStatement", (req) =>
			guarded(req, () => importBankStatement(req.data.fileName ?? "statement.csv", req.data.content ?? "")),
		);
		this.on("suggestMatches", (req) => guarded(req, () => suggestMatches()));
		this.on("confirmMatch", BankTransactions, (req) => guarded(req, () => confirmMatch(boundID(req)), true));
		this.on("matchManually", BankTransactions, (req) =>
			guarded(
				req,
				async () => {
					await assertOwned(req, "swiver.SalesInvoices", req.data.salesInvoice, "REFERENCE_OTHER_ORGANIZATION");
					await assertOwned(req, "swiver.SupplierInvoices", req.data.supplierInvoice, "REFERENCE_OTHER_ORGANIZATION");
					await matchManually(boundID(req), req.data.salesInvoice, req.data.supplierInvoice);
				},
				true,
			),
		);
		this.on("ignore", BankTransactions, (req) => guarded(req, () => ignoreTransaction(boundID(req)), true));
		this.on("unmatch", BankTransactions, (req) => guarded(req, () => unmatch(boundID(req)), true));

		// Users without organization see the onboarding instead of figures.
		this.on("dashboard", () => (currentOrganization() ? dashboard() : { needsAttention: [] }));
		registerPeriodReports(this);
		return super.init();
	}
}

async function guarded(req: Request, operation: () => Promise<unknown>, returnSubject = false) {
	try {
		const result = await operation();
		return returnSubject ? await SELECT.one.from(req.subject) : result;
	} catch (error) {
		logFailure("bank", req.event, error, { target: req.params.length ? boundID(req) : undefined });
		return rejectDomainError(req, error);
	}
}
