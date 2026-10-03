import cds from "@sap/cds";

import { createOrganization } from "../organizations/onboarding";
import { currentOrganization, requireAdmin } from "../organizations/organization-context";
import { registerTenantGuard } from "../organizations/tenant-guard";

/**
 * The signed-in user's organization: onboarding, company settings and members.
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
		return super.init();
	}
}
