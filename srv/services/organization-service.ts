import cds from "@sap/cds";

import { audit, boundKey } from "../collaboration/audit";
import { acceptInvitation, inviteMember, resendInvitation, revokeInvitation } from "../organizations/invitations";
import { createOrganization } from "../organizations/onboarding";
import { currentOrganization, requireAdmin } from "../organizations/organization-context";
import { registerTenantGuard } from "../organizations/tenant-guard";

/**
 * The signed-in user's organization: onboarding, company settings, members and invitations.
 * Only owners and admins change settings and members.
 */
const logoMediaTypes = ["image/png", "image/jpeg"];

export default class OrganizationService extends cds.ApplicationService {
	async init() {
		const { CompanySettings, Memberships, Organizations } = this.entities as Record<
			string,
			cds.entity & { drafts: cds.entity }
		>;
		registerTenantGuard(this);

		this.on("myOrganization", async (req) => {
			const context = currentOrganization();
			if (!context) {
				return { userId: req.user.id };
			}
			const organization = await SELECT.one
				.from("swiver.Organizations")
				.columns("name")
				.where({ ID: context.organizationId });
			const settings = await SELECT.one
				.from("swiver.CompanySettings")
				.columns("ID")
				.where({ organization_ID: context.organizationId });
			return {
				name: organization?.name,
				organizationID: context.organizationId,
				role: context.role,
				settingsID: settings?.ID,
				userId: req.user.id,
			};
		});
		this.on("createOrganization", async (req) => {
			const context = await createOrganization(req, req.data);
			return {
				name: req.data.companyName,
				organizationID: context.organizationId,
				role: context.role,
				userId: req.user.id,
			};
		});

		// Invitations
		this.on("inviteMember", Organizations, inviteMember);
		this.on("resend", "Invitations", resendInvitation);
		this.on("revoke", "Invitations", revokeInvitation);
		this.on("acceptInvitation", acceptInvitation);

		// Users with several memberships (e.g. a tax advisor) pick the organization they work in.
		this.on("switchTo", Organizations, async (req) => {
			const organizationId = boundKey(req);
			await UPDATE("swiver.Memberships")
				.set({ lastUsedAt: new Date().toISOString() })
				.where({ organization_ID: organizationId, userId: req.user.id });
			return SELECT.one.from(req.subject);
		});
		this.after("READ", [Organizations, Organizations.drafts], (result, req) => {
			const current = currentOrganization()?.organizationId;
			const admin = req.user.is("OrganizationAdmin");
			for (const row of (Array.isArray(result) ? result : [result]) as (Record<string, unknown> & { ID: string })[]) {
				if (row) {
					row.isCurrent = row.ID === current;
					row.readOnly = !(admin && row.ID === current);
				}
			}
		});

		this.before(["EDIT", "UPDATE", "CREATE", "DELETE", "NEW"], [Organizations, CompanySettings, Memberships], (req) => {
			requireAdmin(req);
		});
		this.before("UPDATE", [CompanySettings, CompanySettings.drafts], (req) => {
			const mediaType = (req.data as { logoMediaType?: string }).logoMediaType;
			if (mediaType && !logoMediaTypes.includes(mediaType)) {
				req.reject(415, "UNSUPPORTED_DOCUMENT_TYPE", "logo", [mediaType]);
			}
		});
		// The organization keeps at least one owner.
		this.before("SAVE", Organizations, async (req) => {
			const members = (req.data.members ?? []) as { role?: string }[];
			if (!members.some((member) => member.role === "OWNER")) {
				req.reject(400, "OWNER_REQUIRED");
			}
		});
		this.before("SAVE", Organizations, (req) => auditMemberChanges(req.data.ID, req.data.members ?? []));
		return super.init();
	}
}

/** Audits removed members and changed roles, comparing the saved draft with the active members. */
async function auditMemberChanges(organizationId: string, members: { ID: string; role?: string }[]) {
	const active = (await SELECT.from("swiver.Memberships")
		.columns("ID", "userId", "role")
		.where({ organization_ID: organizationId })) as { ID: string; role: string; userId: string }[];
	for (const member of active) {
		const saved = members.find((entry) => entry.ID === member.ID);
		if (!saved) {
			await audit({ action: "memberRemoved", details: member.userId, targetID: member.ID, targetType: "Memberships" });
		} else if (saved.role && saved.role !== member.role) {
			await audit({
				action: "roleChanged",
				details: `${member.userId}: ${member.role} to ${saved.role}`,
				targetID: member.ID,
				targetType: "Memberships",
			});
		}
	}
}
