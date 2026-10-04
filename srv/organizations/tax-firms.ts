import cds from "@sap/cds";

/**
 * Tax firms (Steuerberatungskanzleien). A client grants access to the firm by inviting one of its
 * staff; the firm's admins then assign staff to the client. Access itself stays an ordinary
 * TAX_ADVISOR membership of the client, kept in line with the assignments here, so the restrictions
 * and the organization context need nothing firm-specific, and the client sees and can remove
 * everyone with access.
 */
const TaxFirms = "swiver.TaxFirms";
const Staff = "swiver.TaxFirmStaff";
const Clients = "swiver.TaxFirmClients";
const Assignments = "swiver.TaxFirmAssignments";
const Memberships = "swiver.Memberships";

interface FirmData {
	clients?: { assignments?: { staff_ID?: string }[]; ID: string; organization_ID?: string }[];
	ID: string;
	staff?: { ID: string; role?: string; userId?: string }[];
}

/**
 * Called when a tax advisor accepts an invitation: if they work for a firm, the client becomes the
 * firm's client, assigned to them, and their membership is managed by the firm.
 */
export async function addFirmClient(userId: string, organizationId: string) {
	const staff = await firmOf(userId);
	if (!staff) {
		return;
	}
	let client = await SELECT.one
		.from(Clients)
		.columns("ID")
		.where({ firm_ID: staff.firm_ID, organization_ID: organizationId });
	if (!client) {
		client = { ID: cds.utils.uuid() };
		await INSERT.into(Clients).entries({ firm_ID: staff.firm_ID, ID: client.ID, organization_ID: organizationId });
	}
	if (!(await SELECT.one.from(Assignments).columns("ID").where({ client_ID: client.ID, staff_ID: staff.ID }))) {
		await INSERT.into(Assignments).entries({ client_ID: client.ID, staff_ID: staff.ID });
	}
	await UPDATE(Memberships)
		.with({ firm_ID: staff.firm_ID })
		.where({ organization_ID: organizationId, role: "TAX_ADVISOR", userId });
}

/** Creates a firm with the user as admin; the user's own tax advisor memberships become its clients. */
export async function createTaxFirm(req: cds.Request) {
	const name = String(req.data.name ?? "").trim();
	if (!name) {
		return req.reject(400, "TAX_FIRM_NAME_MISSING");
	}
	if (await firmOf(req.user.id)) {
		return req.reject(409, "TAX_FIRM_EXISTS");
	}
	const ID = cds.utils.uuid();
	const staffId = cds.utils.uuid();
	await INSERT.into(TaxFirms).entries({ ID, name, staff: [{ ID: staffId, role: "ADMIN", userId: req.user.id }] });
	const memberships = (await SELECT.from(Memberships)
		.columns("ID", "organization_ID")
		.where({ firm_ID: null, role: "TAX_ADVISOR", userId: req.user.id })) as { ID: string; organization_ID: string }[];
	for (const membership of memberships) {
		await INSERT.into(Clients).entries({
			assignments: [{ staff_ID: staffId }],
			firm_ID: ID,
			organization_ID: membership.organization_ID,
		});
		await UPDATE(Memberships, membership.ID).with({ firm_ID: ID });
	}
	return { ID, IsActiveEntity: true, name };
}

/** The firm the user works for, if any. */
export async function firmOf(userId: string): Promise<undefined | { firm_ID: string; ID: string; role: string }> {
	return SELECT.one.from(Staff).columns("ID", "firm_ID", "role").where({ userId });
}

/**
 * Called after a client saved its members: assignments of firm staff the client removed are
 * removed too, and a firm left without any member of the client loses the client.
 */
export async function releaseRemovedFirmAccess(organizationId: string) {
	const clients = (await SELECT.from(Clients).columns("ID", "firm_ID").where({ organization_ID: organizationId })) as {
		firm_ID: string;
		ID: string;
	}[];
	for (const client of clients) {
		const members = new Set(
			(
				(await SELECT.from(Memberships)
					.columns("userId")
					.where({ firm_ID: client.firm_ID, organization_ID: organizationId })) as { userId: string }[]
			).map((membership) => membership.userId),
		);
		if (!members.size) {
			await DELETE.from(Assignments).where({ client_ID: client.ID });
			await DELETE.from(Clients, client.ID);
			continue;
		}
		const assignments = (await SELECT.from(Assignments)
			.columns("ID", "staff.userId as userId")
			.where({ client_ID: client.ID })) as { ID: string; userId: string }[];
		for (const assignment of assignments) {
			if (!members.has(assignment.userId)) {
				await DELETE.from(Assignments, assignment.ID);
			}
		}
	}
}

/** Gives every assigned staff member a membership of the client, and removes the others. */
export async function syncFirmMemberships(firmId: string) {
	const clients = (await SELECT.from(Clients).columns("ID", "organization_ID").where({ firm_ID: firmId })) as {
		ID: string;
		organization_ID: string;
	}[];
	const staff = (await SELECT.from(Staff).columns("ID", "userId").where({ firm_ID: firmId })) as {
		ID: string;
		userId: string;
	}[];
	const assignments = clients.length
		? ((await SELECT.from(Assignments)
				.columns("client_ID", "staff_ID")
				.where({ client_ID: { in: clients.map((client) => client.ID) } })) as { client_ID: string; staff_ID: string }[])
		: [];
	const wanted = new Map<string, { organization_ID: string; userId: string }>();
	for (const assignment of assignments) {
		const organization_ID = clients.find((client) => client.ID === assignment.client_ID)?.organization_ID;
		const userId = staff.find((member) => member.ID === assignment.staff_ID)?.userId;
		if (organization_ID && userId) {
			wanted.set(`${organization_ID}|${userId}`, { organization_ID, userId });
		}
	}
	const existing = (await SELECT.from(Memberships)
		.columns("ID", "organization_ID", "userId")
		.where({ firm_ID: firmId })) as {
		ID: string;
		organization_ID: string;
		userId: string;
	}[];
	for (const membership of existing) {
		if (!wanted.delete(`${membership.organization_ID}|${membership.userId}`)) {
			await DELETE.from(Memberships, membership.ID);
		}
	}
	for (const { organization_ID, userId } of wanted.values()) {
		// Someone who is already a member (e.g. the owner) keeps their own membership.
		if (!(await SELECT.one.from(Memberships).columns("ID").where({ organization_ID, userId }))) {
			await INSERT.into(Memberships).entries({ firm_ID: firmId, organization_ID, role: "TAX_ADVISOR", userId });
		}
	}
}

/**
 * Checks a firm before it is saved: at least one admin and no clients the firm did not get through
 * an invitation. Assignments of removed staff are dropped.
 */
export async function validateTaxFirm(req: cds.Request) {
	const data = req.data as FirmData;
	const staff = data.staff ?? [];
	if (!staff.some((member) => member.role === "ADMIN")) {
		return req.reject(400, "TAX_FIRM_ADMIN_REQUIRED");
	}
	const active = (await SELECT.from(Clients).columns("ID", "organization_ID").where({ firm_ID: data.ID })) as {
		ID: string;
		organization_ID: string;
	}[];
	const staffIds = new Set(staff.map((member) => member.ID));
	for (const client of data.clients ?? []) {
		const existing = active.find((entry) => entry.ID === client.ID);
		if (!existing || (client.organization_ID && client.organization_ID !== existing.organization_ID)) {
			return req.reject(403, "TAX_FIRM_CLIENT_BY_INVITATION");
		}
		client.assignments = client.assignments?.filter((assignment) => staffIds.has(assignment.staff_ID ?? ""));
	}
}
