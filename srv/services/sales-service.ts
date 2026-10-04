import cds from "@sap/cds";

import { registerChangeHistoryGuard } from "../authorization/change-history-guard";
import { registerReadOnlyFlag } from "../authorization/read-only-flag";
import { auditActions } from "../collaboration/audit";
import { registerComments } from "../collaboration/comments";
import { registerTenantGuard } from "../organizations/tenant-guard";
import { registerQuotes } from "../sales/quotes";
import { registerSalesInvoices } from "../sales/sales-invoices";

/**
 * Money in: customers, products and services, quotes and sales invoices.
 */
export default class SalesService extends cds.ApplicationService {
	async init() {
		registerTenantGuard(this);
		registerChangeHistoryGuard(this);
		registerSalesInvoices(this);
		registerQuotes(this);
		registerReadOnlyFlag(this);
		registerComments(this, { SalesInvoices: "salesInvoice" });
		auditActions(this, { SalesInvoices: ["finalize", "cancelInvoice", "markAsPaid", "recordPayment"] });
		return super.init();
	}
}
