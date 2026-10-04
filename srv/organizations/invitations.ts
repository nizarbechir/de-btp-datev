import cds from "@sap/cds";
import { createHash, randomBytes } from "node:crypto";

import { audit, boundKey } from "../collaboration/audit";
import { EmailNotConfiguredError } from "../integrations/email/email-provider";
import { sendMembershipInvitation } from "./invitation-email";
import { MembershipRole, requireAdmin, resolveOrganization } from "./organization-context";
import { addFirmClient } from "./tax-firms";
import { assertOwned } from "./tenant-guard";

/**
 * Inviting users into an organization: an owner or admin invites an e-mail address with a role, the
 * invited user opens the link, signs in and accepts. Only the SHA-256 hash of the random token is
 * stored, invitations expire, and each can be accepted once.
 */
const Invitations = "swiver.Invitations";
const validDays = 14;
const invitableRoles: MembershipRole[] = ["ADMIN", "MEMBER", "TAX_ADVISOR"];
const log = cds.log("invitations");

interface Invitation {
	email: string;
	expiresAt: string;
	ID: string;
	organization_ID: string;
	role: MembershipRole;
	status: string;
}

/**
 * Creates the membership of the signed-in user. The e-mail of the signed-in user (from the identity
 * provider, or the user ID if it is an e-mail address) must match the invited address.
 */
export async function acceptInvitation(req: cds.Request) {
	const token = String(req.data.token ?? "");
	const invitation = (token && (await SELECT.one.from(Invitations).where({ tokenHash: hash(token) }))) as
		Invitation | undefined;
	if (!invitation || invitation.status !== "PENDING") {
		return req.reject(404, "INVITATION_INVALID");
	}
	if (new Date(invitation.expiresAt) < new Date()) {
		await UPDATE(Invitations, invitation.ID).with({ status: "EXPIRED", tokenHash: null });
		return req.reject(410, "INVITATION_EXPIRED");
	}
	if (userEmail(req.user) !== invitation.email.toLowerCase()) {
		return req.reject(403, "INVITATION_EMAIL_MISMATCH");
	}
	const organizationId = invitation.organization_ID;
	const now = new Date().toISOString();
	const existing = await SELECT.one
		.from("swiver.Memberships")
		.columns("ID")
		.where({ organization_ID: organizationId, userId: req.user.id });
	if (existing) {
		await UPDATE("swiver.Memberships", existing.ID).with({ lastUsedAt: now });
	} else {
		await INSERT.into("swiver.Memberships").entries({
			lastUsedAt: now,
			organization_ID: organizationId,
			role: invitation.role,
			userId: req.user.id,
		});
		if (invitation.role === "TAX_ADVISOR") {
			await addFirmClient(req.user.id, organizationId);
		}
	}
	await UPDATE(Invitations, invitation.ID).with({
		acceptedAt: now,
		acceptedBy: req.user.id,
		status: "ACCEPTED",
		tokenHash: null,
	});
	await audit({
		action: "invitationAccepted",
		details: `${req.user.id} as ${invitation.role}`,
		organizationId,
		targetID: invitation.ID,
		targetType: "Invitations",
	});
	const context = await resolveOrganization(req.user, organizationId);
	const organization = await SELECT.one.from("swiver.Organizations").columns("name").where({ ID: organizationId });
	return { name: organization?.name, organizationID: organizationId, role: context?.role, userId: req.user.id };
}

export async function inviteMember(req: cds.Request) {
	const organizationId = requireAdmin(req);
	const email = String(req.data.email ?? "")
		.trim()
		.toLowerCase();
	const role = req.data.role as MembershipRole;
	if (!/^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/.test(email)) {
		return req.reject(400, "INVALID_EMAIL");
	}
	if (!invitableRoles.includes(role)) {
		return req.reject(400, "INVALID_INVITATION_ROLE");
	}
	if (
		await SELECT.one.from("swiver.Memberships").columns("ID").where({ organization_ID: organizationId, userId: email })
	) {
		return req.reject(409, "ALREADY_MEMBER");
	}
	const ID = cds.utils.uuid();
	const token = newToken();
	await INSERT.into(Invitations).entries({
		email,
		expiresAt: expiry(),
		ID,
		invitedBy: req.user.id,
		organization_ID: organizationId,
		role,
		tokenHash: hash(token),
	});
	await audit({ action: "invitationCreated", details: `${email} as ${role}`, targetID: ID, targetType: "Invitations" });
	await send(req, ID, token);
	return SELECT.one.from("OrganizationService.Invitations", ID);
}

/** New link and expiry date; the previous link stops working. */
export async function resendInvitation(req: cds.Request) {
	const invitation = await openInvitation(req, ["PENDING", "EXPIRED"]);
	const token = newToken();
	await UPDATE(Invitations, invitation.ID).with({ expiresAt: expiry(), status: "PENDING", tokenHash: hash(token) });
	await send(req, invitation.ID, token);
	return SELECT.one.from(req.subject);
}

export async function revokeInvitation(req: cds.Request) {
	const invitation = await openInvitation(req, ["PENDING"]);
	await UPDATE(Invitations, invitation.ID).with({ status: "REVOKED", tokenHash: null });
	await audit({
		action: "invitationRevoked",
		details: invitation.email,
		targetID: invitation.ID,
		targetType: "Invitations",
	});
	return SELECT.one.from(req.subject);
}

/** SWIVER_APP_URL is the launchpad URL; the settings app accepts the invitation from the link. */
function acceptanceLink(req: cds.Request, token: string): string {
	const http = (req as { http?: { req?: { headers: Record<string, string>; protocol: string } } }).http?.req;
	const base =
		process.env.SWIVER_APP_URL ??
		`${http?.protocol ?? "http"}://${http?.headers.host ?? "localhost:4004"}/launchpad.html`;
	return `${base}#Settings-manage?invitation=${token}`;
}

function expiry(): string {
	return new Date(Date.now() + validDays * 24 * 60 * 60 * 1000).toISOString();
}

function hash(token: string): string {
	return createHash("sha256").update(token).digest("hex");
}

function newToken(): string {
	return randomBytes(32).toString("base64url");
}

/** The invitation the action was called on, if it has one of the given statuses. */
async function openInvitation(req: cds.Request, statuses: string[]): Promise<Invitation> {
	requireAdmin(req);
	const ID = boundKey(req);
	await assertOwned(req, Invitations, ID);
	const invitation = (await SELECT.one.from(Invitations, ID)) as Invitation;
	if (!statuses.includes(invitation.status)) {
		return req.reject(409, "INVITATION_NOT_PENDING") as never;
	}
	return invitation;
}

/**
 * Sends the e-mail. Without a configured e-mail provider the invitation is kept (it can be resent
 * later) and the user gets a warning instead of an error.
 */
async function send(req: cds.Request, invitationId: string, token: string) {
	const link = acceptanceLink(req, token);
	try {
		await sendMembershipInvitation(invitationId, link);
	} catch (error) {
		if (!(error instanceof EmailNotConfiguredError)) {
			throw error;
		}
		req.warn(424, "EMAIL_NOT_CONFIGURED");
		if (cds.env.profiles.includes("development")) {
			log.info("Invitation link (development only):", link);
		}
	}
}

function userEmail(user: cds.User): string {
	const email = (user.attr as Record<string, unknown> | undefined)?.email;
	return String(typeof email === "string" ? email : user.id).toLowerCase();
}
