import cds from "@sap/cds";

import { currentOrganization, requireOrganization } from "../organizations/organization-context";
import { assertOwned } from "../organizations/tenant-guard";
import { audit, boundKey } from "./audit";
import { notifyTaxAdvisorQuestion } from "./comment-email";

/**
 * Comments and questions on financial records, e.g. from the tax advisor. A record's addComment
 * action creates one; the team resolves it. Who may do what is decided by the `@restrict` annotations.
 * @param srv the service
 * @param targets the commentable entities of the service and their association in FinancialComments,
 * e.g. { SalesInvoices: "salesInvoice" }
 */
export function registerComments(srv: cds.ApplicationService, targets: Record<string, string>) {
	for (const [entity, association] of Object.entries(targets)) {
		srv.on("addComment", entity, async (req) => {
			const text = String(req.data.text ?? "").trim();
			if (!text) {
				return req.reject(400, "COMMENT_TEXT_MISSING");
			}
			const recordID = boundKey(req);
			await assertOwned(req, (req.target as cds.entity).name, recordID);
			const ID = cds.utils.uuid();
			await INSERT.into("swiver.FinancialComments").entries({
				[`${association}_ID`]: recordID,
				authorRole: currentOrganization()?.role,
				ID,
				organization_ID: requireOrganization(req),
				text,
			});
			await audit({ action: "commentCreated", details: `comment ${ID}`, targetID: recordID, targetType: entity });
			if (req.user.is("TaxAdvisor")) {
				await notifyTaxAdvisorQuestion(req, entity, recordID, text);
			}
			return SELECT.one.from(req.subject);
		});
	}
	srv.on("resolve", "FinancialComments", async (req) => {
		const ID = boundKey(req);
		await assertOwned(req, "swiver.FinancialComments", ID);
		await UPDATE("swiver.FinancialComments", ID).with({
			resolved: true,
			resolvedAt: new Date().toISOString(),
			resolvedBy: req.user.id,
		});
		await audit({ action: "commentResolved", targetID: ID, targetType: "FinancialComments" });
		return SELECT.one.from(req.subject);
	});
}
