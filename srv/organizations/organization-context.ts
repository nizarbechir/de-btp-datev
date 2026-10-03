import cds from "@sap/cds";

/**
 * Resolves the signed-in user's organization and role. The organization is stored on the user as
 * the attribute `organization`, which the `@restrict` annotations use to filter every query, so all
 * services, actions, value helps and expands only ever see the user's own organization.
 */
export type MembershipRole = "ADMIN" | "MEMBER" | "OWNER";

export interface OrganizationContext {
	organizationId: string;
	role: MembershipRole;
	userId: string;
}

const Memberships = "swiver.Memberships";
/** Lets a user who belongs to several organizations pick one. */
const organizationHeader = "x-organization-id";

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
	res: unknown,
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
	if (currentOrganization()?.role === "MEMBER") {
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
 * the only (or first) one.
 */
// TODO(feature): multi-workspace switcher
export async function resolveOrganization(
	user: cds.User,
	requested?: string,
): Promise<OrganizationContext | undefined> {
	const memberships = (await SELECT.from(Memberships)
		.columns("organization_ID", "role")
		.where({ userId: user.id })
		.orderBy("createdAt")) as { organization_ID: string; role: MembershipRole }[];
	const membership = memberships.find((entry) => entry.organization_ID === requested) ?? memberships[0];
	const attr = (user.attr ?? {}) as Record<string, unknown>;
	if (!membership) {
		delete attr.organization;
		delete attr.organizationRole;
		return undefined;
	}
	attr.organization = membership.organization_ID;
	attr.organizationRole = membership.role;
	user.attr = attr as typeof user.attr;
	return { organizationId: membership.organization_ID, role: membership.role, userId: user.id };
}
