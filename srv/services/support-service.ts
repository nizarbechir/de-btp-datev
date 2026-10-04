import cds from "@sap/cds";

import { invoiceDocumentTypes, validateUpload } from "../core/document-upload";
import { registerTenantGuard } from "../organizations/tenant-guard";
import { isSupportAgent, notifyTicketCreated, prepareTicket, reply, setStatus } from "../support/tickets";

/**
 * Support tickets of the customers, answered by the Swiver support team.
 */
export default class SupportService extends cds.ApplicationService {
	async init() {
		const { SupportAttachments, SupportTickets } = this.entities as Record<string, cds.entity & { drafts: cds.entity }>;
		registerTenantGuard(this);

		this.before("CREATE", SupportTickets, prepareTicket);
		this.after("CREATE", SupportTickets, (_result, req) => notifyTicketCreated((req.data as { ID: string }).ID));
		this.on("reply", SupportTickets, reply);
		this.on("setStatus", SupportTickets, setStatus);

		this.after("READ", SupportTickets, (result, req) => {
			for (const row of (Array.isArray(result) ? result : [result]) as (null | { canManage?: boolean })[]) {
				if (row) {
					row.canManage = isSupportAgent(req.user);
				}
			}
		});

		this.before(["CREATE", "UPDATE"], [SupportAttachments, SupportAttachments.drafts], (req) =>
			validateUpload(req, {
				allowed: invoiceDocumentTypes,
				content: "content",
				fileName: "fileName",
				mediaType: "mimeType",
			}),
		);

		return super.init();
	}
}
