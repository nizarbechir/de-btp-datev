import cds from "@sap/cds";

/**
 * Resolves the signed-in user's organization and role. The organization is stored on the user as
 * the attribute `organization`, which the `@restrict` annotations use to filter every query, so all
 * services, actions, value helps and expands only ever see the user's own organization.
 * The membership role becomes a CAP role, so `@restrict` can grant per role:
 * OrganizationMember (owner, admin, member), OrganizationAdmin (owner, admin) and TaxAdvisor.
 */
export type MembershipRole = "ADMIN" | "MEMBER" | "OWNER" | "TAX_ADVISOR";

const organizationRoles = ["OrganizationMember", "OrganizationAdmin", "TaxAdvisor"];

export interface OrganizationContext {
	organizationId: string;
	role: MembershipRole;
	userId: string;
}

const Memberships = "swiver.Memberships";
/** Lets a user who belongs to several organizations pick one. */
const organizationHeader = "x-organization-id";

/** True for owners, admins and members; false for the read-only tax advisor. */
export function canChangeRecords(): boolean {
	return Boolean(cds.context?.user?.is("OrganizationMember"));
}

/** The current organization, or undefined if the user does not belong to one yet. */
export function currentOrganization(): OrganizationContext | undefined {
	const user = cds.context?.user;
	const attr = user?.attr as Record<string, unknown> | undefined;
	if (!user || typeof attr?.organization !== "string") {
		return undefined;
	}
	return { organizationId: attr.organization, role: attr.organizationRole as MembershipRole, userId: user.id };
}

/** Express middleware, added after authentication: resolves the organization once per request. */
export async function organizationMiddleware(
	req: { headers: Record<string, unknown> },
	_res: unknown,
	next: (error?: unknown) => void,
) {
	try {
		const user = cds.context?.user;
		if (user && !user.is("anonymous")) {
			await resolveOrganization(user, req.headers[organizationHeader] as string | undefined);
		}
		next();
	} catch (error) {
		next(error);
	}
}

/** Fails the request unless the user is an owner or admin of the current organization. */
export function requireAdmin(req: cds.Request): string {
	const organizationId = requireOrganization(req);
	if (!req.user.is("OrganizationAdmin")) {
		return req.reject(403, "ADMIN_ROLE_REQUIRED") as never;
	}
	return organizationId;
}

/** Fails the request if the user has no organization; returns the organization ID otherwise. */
export function requireOrganization(req?: cds.Request): string {
	const context = currentOrganization();
	if (!context) {
		if (req) {
			return req.reject(403, "NO_ORGANIZATION") as never;
		}
		throw Object.assign(new Error("NO_ORGANIZATION"), { code: "NO_ORGANIZATION", status: 403 });
	}
	return context.organizationId;
}

/**
 * Picks the user's membership: the requested organization if the user is a member of it, otherwise
 * the one last switched to, otherwise the first one.
 */
// TODO(feature): dedicated Steuerberater client cockpit
export async function resolveOrganization(
	user: cds.User,
	requested?: string,
): Promise<OrganizationContext | undefined> {
	const memberships = (await SELECT.from(Memberships)
		.columns("organization_ID", "role", "lastUsedAt")
		.where({ userId: user.id })
		.orderBy("createdAt")) as { lastUsedAt?: null | string; organization_ID: string; role: MembershipRole }[];
	const lastUsed = [...memberships].sort((first, second) =>
		(second.lastUsedAt ?? "").localeCompare(first.lastUsedAt ?? ""),
	)[0];
	const membership = memberships.find((entry) => entry.organization_ID === requested) ?? lastUsed;
	const attr = (user.attr ?? {}) as Record<string, unknown>;
	// Roles of a previous resolution never carry over; the identity provider does not grant these.
	const roles = user.roles as Record<string, unknown>;
	for (const role of organizationRoles) {
		Reflect.deleteProperty(roles, role);
	}
	if (!membership) {
		delete attr.organization;
		delete attr.organizationRole;
		return undefined;
	}
	attr.organization = membership.organization_ID;
	attr.organizationRole = membership.role;
	user.attr = attr as typeof user.attr;
	for (const role of capRoles(membership.role)) {
		roles[role] = 1;
	}
	return { organizationId: membership.organization_ID, role: membership.role, userId: user.id };
}

function capRoles(role: MembershipRole): string[] {
	if (role === "TAX_ADVISOR") {
		return ["TaxAdvisor"];
	}
	return role === "MEMBER" ? ["OrganizationMember"] : ["OrganizationMember", "OrganizationAdmin"];
}
