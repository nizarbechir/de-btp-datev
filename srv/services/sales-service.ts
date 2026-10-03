import cds from "@sap/cds";

import { registerTenantGuard } from "../organizations/tenant-guard";
import { registerQuotes } from "../sales/quotes";
import { registerSalesInvoices } from "../sales/sales-invoices";

/**
 * Money in: customers, products and services, quotes and sales invoices.
 */
export default class SalesService extends cds.ApplicationService {
	async init() {
		registerTenantGuard(this);
		registerSalesInvoices(this);
		registerQuotes(this);
		return super.init();
	}
}
