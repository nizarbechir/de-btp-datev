import cds from "@sap/cds";

import { boundID } from "../core/requests";
import { currentOrganization } from "../organizations/organization-context";

/**
 * The audit trail of important business actions: who did what to which record, and when.
 * Never pass secrets or document contents as details. Reads (GET) are not audited.
 */
export interface AuditEntry {
	action: string;
	details?: string;
	/** Defaults to the current organization; set when acting on another one, e.g. accepting an invitation. */
	organizationId?: string;
	targetID?: string;
	targetType: string;
}

export async function audit(entry: AuditEntry): Promise<void> {
	const organizationId = entry.organizationId ?? currentOrganization()?.organizationId;
	if (!organizationId) {
		return;
	}
	await INSERT.into("swiver.AuditLogEntries").entries({
		action: entry.action,
		actor: cds.context?.user?.id,
		details: entry.details?.slice(0, 500),
		organization_ID: organizationId,
		targetID: entry.targetID,
		targetType: entry.targetType,
	});
}

/** Audits the successful bound actions of a service, e.g. { SalesInvoices: ["finalize", "cancelInvoice"] }. */
export function auditActions(srv: cds.ApplicationService, actions: Record<string, string[]>) {
	for (const [entity, events] of Object.entries(actions)) {
		srv.after(events, entity, (_result, req) =>
			audit({ action: req.event, targetID: boundID(req), targetType: entity }),
		);
	}
}
