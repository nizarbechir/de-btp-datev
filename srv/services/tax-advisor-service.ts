import cds from "@sap/cds";

import { registerPeriodReports } from "../finance/period-reports";

/**
 * The tax advisor's workspace. Everything is read-only and generic, except the VAT overview and the
 * accountant export, which are shared with the Finance service.
 */
export default class TaxAdvisorService extends cds.ApplicationService {
	async init() {
		registerPeriodReports(this);
		return super.init();
	}
}
