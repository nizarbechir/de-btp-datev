import cds from "@sap/cds";

import { registerReadOnlyFlag } from "../authorization/read-only-flag";
import { auditActions } from "../collaboration/audit";
import { boundID, guardedSubject } from "../core/requests";
import { adjustStock, returnToSupplier } from "../inventory/manual-bookings";

/**
 * Stock of the goods with stock tracking: corrections and supplier returns. The actions only reach
 * products of the user's organization (`@restrict`); the stock ledger checks it again.
 */
export default class InventoryService extends cds.ApplicationService {
	async init() {
		const { Products } = this.entities;
		registerReadOnlyFlag(this);
		auditActions(this, { Products: ["adjustStock", "returnToSupplier"] });
		this.on("adjustStock", Products, (req) =>
			guardedSubject(req, () => adjustStock(boundID(req), req.data.quantity, req.data.reason)),
		);
		this.on("returnToSupplier", Products, (req) =>
			guardedSubject(req, () => returnToSupplier(boundID(req), req.data.quantity, req.data.reason)),
		);
		return super.init();
	}
}
