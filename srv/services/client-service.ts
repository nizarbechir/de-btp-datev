import cds from "@sap/cds";

import { boundKey } from "../collaboration/audit";
import { createTaxFirm, syncFirmMemberships, validateTaxFirm } from "../organizations/tax-firms";

/**
 * The client cockpit and the tax firm. Reads are generic; what is visible is decided by the
 * memberships (srv/authorization/authorization.cds).
 */
export default class ClientService extends cds.ApplicationService {
	async init() {
		const { TaxFirmClients, TaxFirms } = this.entities as Record<string, cds.entity & { drafts: cds.entity }>;

		// The client the user works in, also for the next sign-in.
		this.on("open", "Clients", async (req) => {
			await UPDATE("swiver.Memberships")
				.set({ lastUsedAt: new Date().toISOString() })
				.where({ organization_ID: boundKey(req), userId: req.user.id });
		});

		this.on("createTaxFirm", createTaxFirm);
		// Firms are created with createTaxFirm, clients come from invitations.
		this.before("NEW", TaxFirms.drafts, (req) => req.reject(403, "TAX_FIRM_CHANGE_NOT_ALLOWED"));
		this.before(["CREATE", "DELETE"], TaxFirms, (req) => req.reject(403, "TAX_FIRM_CHANGE_NOT_ALLOWED"));
		this.before("NEW", TaxFirmClients.drafts, (req) => req.reject(403, "TAX_FIRM_CLIENT_BY_INVITATION"));
		this.before("SAVE", TaxFirms, validateTaxFirm);
		this.after("SAVE", TaxFirms, (_result, req) => syncFirmMemberships(req.data.ID));
		return super.init();
	}
}
