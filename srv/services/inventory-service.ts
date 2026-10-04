import cds, { Request } from "@sap/cds";

import { registerReadOnlyFlag } from "../authorization/read-only-flag";
import { auditActions } from "../collaboration/audit";
import { adjustStock, returnToSupplier } from "../inventory/manual-bookings";
import { rejectDomainError } from "../payments/payments";

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
			guarded(req, () => adjustStock(key(req), req.data.quantity, req.data.reason)),
		);
		this.on("returnToSupplier", Products, (req) =>
			guarded(req, () => returnToSupplier(key(req), req.data.quantity, req.data.reason)),
		);
		return super.init();
	}
}

async function guarded(req: Request, operation: () => Promise<unknown>) {
	try {
		await operation();
		return await SELECT.one.from(req.subject);
	} catch (error) {
		return rejectDomainError(req, error);
	}
}

function key(req: Request): string {
	const value = req.params.at(-1);
	return (typeof value === "object" ? (value as { ID: string }).ID : value) as string;
}
