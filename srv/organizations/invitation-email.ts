import { getEmailProvider } from "../integrations/email/email-provider";

/**
 * The invitation e-mail. Builds subject and text; the e-mail provider only transports it.
 */
const roleDescriptions: Record<string, { access: string; name: string }> = {
	ADMIN: { access: "manage the organization, its settings and members, and all financial data", name: "Admin" },
	MEMBER: { access: "work with customers, suppliers, invoices, payments and bank transactions", name: "Member" },
	// eslint-disable-next-line @typescript-eslint/naming-convention -- membership role code
	TAX_ADVISOR: {
		access:
			"read invoices, supplier invoices, receipts, payments, bank transactions and the VAT overview, download documents, run the accountant export and leave questions on records",
		name: "Tax Advisor (Steuerberater)",
	},
};

export async function sendMembershipInvitation(invitationId: string, link: string) {
	const invitation = await SELECT.one
		.from("swiver.Invitations")
		.columns("email", "role", "expiresAt", "invitedBy", "organization_ID", "organization.name as organizationName")
		.where({ ID: invitationId });
	const role = roleDescriptions[invitation.role] ?? { access: "", name: invitation.role };
	const expires = new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "UTC" }).format(
		new Date(invitation.expiresAt),
	);
	const body = [
		"Hello,",
		"",
		`${invitation.invitedBy} has invited you to join ${invitation.organizationName} on Swiver as ${role.name}.`,
		"",
		`With this role you can ${role.access}.`,
		"",
		"To accept, open the link below and sign in with this e-mail address:",
		link,
		"",
		`The invitation is valid until ${expires}. If you did not expect it, you can ignore this e-mail.`,
	].join("\n");
	await getEmailProvider(invitation.organization_ID).send({
		body,
		subject: `Invitation to ${invitation.organizationName} on Swiver`,
		to: [invitation.email],
	});
}
