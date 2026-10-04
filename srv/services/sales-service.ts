import cds from "@sap/cds";

import { registerChangeHistoryGuard } from "../authorization/change-history-guard";
import { registerReadOnlyFlag } from "../authorization/read-only-flag";
import { auditActions } from "../collaboration/audit";
import { registerComments } from "../collaboration/comments";
import { assertNoStockMovements } from "../inventory/stock";
import { registerTenantGuard } from "../organizations/tenant-guard";
import { registerDeliveryNotes } from "../sales/delivery-notes";
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
		registerDeliveryNotes(this);
		// Products with stock history stay, so the stock ledger stays complete; deactivate them instead.
		this.before("DELETE", "SalesService.ProductServices", (req) => assertNoStockMovements(req));
		registerReadOnlyFlag(this);
		registerComments(this, { SalesInvoices: "salesInvoice" });
		auditActions(this, {
			DeliveryNoteItems: ["returnGoods"],
			DeliveryNotes: ["confirm"],
			SalesInvoices: ["finalize", "cancelInvoice", "markAsPaid", "recordPayment"],
		});
		return super.init();
	}
}
