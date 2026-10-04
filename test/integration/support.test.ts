import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals";
import cds from "@sap/cds";

import * as email from "../../srv/integrations/email/email-provider";

/**
 * Support tickets: creating and following tickets, sequential numbers, organization isolation of
 * tickets, messages and attachments, the support agent's access across organizations, status
 * changes and the e-mails sent through the EmailProvider (mocked: nothing leaves the test).
 */
const projectRootDir = __dirname + "../../..";
const { axios, GET, POST } = cds.test("serve", "--project", projectRootDir);

axios.defaults.validateStatus = () => true;

// A customer whose user ID is an e-mail address, like users of the identity provider in production.
const danaId = "dana@example.com";
(cds.env.requires.auth as { users: Record<string, unknown> }).users[danaId] = {
	password: "dana",
	roles: ["InvoiceManager"],
};
const alice = { auth: { password: "alice", username: "alice" } };
const bob = { auth: { password: "bob", username: "bob" } };
const dana = { auth: { password: "dana", username: danaId } };
const advisor = { auth: { password: "steuerberater", username: "steuerberater@example.de" } };
const support = { auth: { password: "support", username: "support" } };
type User = typeof alice;

const SUPPORT = "/odata/v4/support";
const supportEmail = "support-team@example.com";
const pdf = "%PDF-1.4\n1 0 obj <<>> endobj\ntrailer <<>>\n%%EOF";

const send = jest.fn<email.EmailProvider["send"]>();

let aliceTicket: Ticket;

interface Ticket {
	createdBy: string;
	creatorEmail: null | string;
	ID: string;
	organization_ID: string;
	organizationName: string;
	resolvedAt: null | string;
	status_code: string;
	ticketNumber: number;
}

async function action(user: User, ticket: Ticket, name: string, data: object) {
	return POST(`${ticketUrl(ticket)}/SupportService.${name}`, data, user);
}

/** Creates a ticket the way the app does: a draft that is then sent (activated). */
async function createTicket(user: User, data: object = {}): Promise<Ticket> {
	const draft = await POST(`${SUPPORT}/SupportTickets`, {}, user);
	expect(draft.status).toBe(201);
	const filled = await axios.patch(
		draftUrl(draft.data.ID),
		{ category_code: "SALES_INVOICES", description: "Nothing happens.", subject: "Invoice email not sending", ...data },
		user,
	);
	expect(filled.status).toBe(200);
	const saved = await POST(`${draftUrl(draft.data.ID)}/SupportService.draftActivate`, {}, user);
	expect(saved.status).toBe(201);
	return saved.data;
}

function draftUrl(id: string) {
	return `${SUPPORT}/SupportTickets(ID=${id},IsActiveEntity=false)`;
}

/** For the setup in beforeAll: fails unless the request returned the expected status. */
function ensure(response: { status: number }, status: number) {
	if (response.status !== status) {
		throw new Error(`Setup request failed with ${response.status}`);
	}
	return response;
}

function sentTo(address: string) {
	return send.mock.calls.map(([message]) => message).filter((message) => message.to.includes(address));
}

function ticketUrl(ticket: Ticket) {
	return `${SUPPORT}/SupportTickets(ID=${ticket.ID},IsActiveEntity=true)`;
}

beforeAll(async () => {
	for (const [user, companyName] of [
		[bob, "Bob Handwerk GmbH"],
		[dana, "John Consulting"],
	] as const) {
		ensure(await POST("/odata/v4/organization/createOrganization", { companyName }, user), 200);
	}
	aliceTicket = await createTicket(alice);
});

beforeEach(() => {
	process.env.SUPPORT_EMAIL = supportEmail;
	send.mockResolvedValue({ provider: "Test", sentAt: new Date().toISOString() });
	jest.spyOn(email, "getEmailProvider").mockReturnValue({ name: "Test", send });
});

afterEach(() => {
	jest.restoreAllMocks();
	delete process.env.SUPPORT_EMAIL;
});

describe("Creating a ticket", () => {
	it("stores organization, creator, number and status from the backend, never from the request", async () => {
		const ticket = await createTicket(dana, {
			creatorEmail: "attacker@example.com",
			organization_ID: aliceTicket.organization_ID,
			resolvedAt: "2026-01-01T00:00:00Z",
			status_code: "RESOLVED",
			ticketNumber: 1,
		});
		expect(ticket).toMatchObject({
			createdBy: danaId,
			creatorEmail: danaId,
			organizationName: "John Consulting",
			resolvedAt: null,
			status_code: "NEW",
		});
		expect(ticket.organization_ID).not.toBe(aliceTicket.organization_ID);
		expect(ticket.ticketNumber).toBeGreaterThan(1000);
	});

	it("defaults the priority to NORMAL and requires subject and description", async () => {
		const ticket = await createTicket(alice, { category_code: undefined });
		const read = await GET(`${ticketUrl(ticket)}?$select=priority_code,category_code`, alice);
		expect(read.data).toMatchObject({ category_code: "GENERAL", priority_code: "NORMAL" });

		const draft = await POST(`${SUPPORT}/SupportTickets`, { subject: "No description" }, alice);
		const saved = await POST(`${draftUrl(draft.data.ID)}/SupportService.draftActivate`, {}, alice);
		expect(saved.status).toBe(400);
	});

	it("rejects categories and priorities that do not exist", async () => {
		const draft = await POST(
			`${SUPPORT}/SupportTickets`,
			{ description: "x", priority_code: "CRITICAL", subject: "x" },
			alice,
		);
		const saved = await POST(`${draftUrl(draft.data.ID)}/SupportService.draftActivate`, {}, alice);
		expect(saved.status).toBe(400);
	});

	it("numbers tickets sequentially across organizations", async () => {
		const first = await createTicket(alice);
		const second = await createTicket(bob);
		const third = await createTicket(alice);
		expect([second.ticketNumber, third.ticketNumber]).toEqual([first.ticketNumber + 1, first.ticketNumber + 2]);
	});

	it("gives parallel tickets distinct numbers", async () => {
		const tickets = await Promise.all([alice, bob, dana, alice, bob, dana].map((user) => createTicket(user)));
		const numbers = tickets.map((ticket) => ticket.ticketNumber).sort((first, second) => first - second);
		expect(new Set(numbers).size).toBe(numbers.length);
		expect(numbers[numbers.length - 1] - numbers[0]).toBe(numbers.length - 1);
	});

	it("is not possible for the tax advisor or a support agent without membership", async () => {
		expect((await POST(`${SUPPORT}/SupportTickets`, { description: "x", subject: "x" }, advisor)).status).toBe(403);
		expect((await POST(`${SUPPORT}/SupportTickets`, { description: "x", subject: "x" }, support)).status).toBe(403);
	});
});

describe("E-mails on creation", () => {
	it("tells the support team and confirms to the creator", async () => {
		const ticket = await createTicket(dana, { priority_code: "HIGH" });
		const [toSupport] = sentTo(supportEmail);
		expect(toSupport.subject).toBe(`[Swiver] New support ticket #${ticket.ticketNumber} - Invoice email not sending`);
		expect(toSupport.replyTo).toBe(danaId);
		for (const part of [
			"John Consulting",
			danaId,
			"Sales Invoices",
			"High",
			"Invoice email not sending",
			"Nothing happens.",
		]) {
			expect(toSupport.body).toContain(part);
		}
		const [confirmation] = sentTo(danaId);
		expect(confirmation.subject).toBe(`[Swiver] We received your support request #${ticket.ticketNumber}`);
		expect(send).toHaveBeenCalledTimes(2);
	});

	it("skips the confirmation when the creator has no e-mail address", async () => {
		await createTicket(alice);
		expect(send).toHaveBeenCalledTimes(1);
		expect(sentTo(supportEmail)).toHaveLength(1);
	});

	it("creates the ticket without SUPPORT_EMAIL and only sends the confirmation", async () => {
		delete process.env.SUPPORT_EMAIL;
		await createTicket(dana);
		expect(sentTo(supportEmail)).toHaveLength(0);
		expect(sentTo(danaId)).toHaveLength(1);
	});

	it("creates the ticket when e-mail is not configured or sending fails", async () => {
		jest.spyOn(email, "getEmailProvider").mockImplementation(() => {
			throw new email.EmailNotConfiguredError();
		});
		expect((await createTicket(dana)).status_code).toBe("NEW");
		send.mockRejectedValue(new Error("Graph is down"));
		jest.spyOn(email, "getEmailProvider").mockReturnValue({ name: "Test", send });
		expect((await createTicket(dana)).status_code).toBe("NEW");
	});
});

describe("Organization isolation", () => {
	it("lists only the tickets of the user's organization", async () => {
		const list = await GET(`${SUPPORT}/SupportTickets?$select=organization_ID`, bob);
		expect(list.status).toBe(200);
		expect(list.data.value.length).toBeGreaterThan(0);
		expect(list.data.value.every((ticket: Ticket) => ticket.organization_ID !== aliceTicket.organization_ID)).toBe(
			true,
		);
	});

	it("does not reveal another organization's ticket by its UUID", async () => {
		expect((await GET(ticketUrl(aliceTicket), bob)).status).toBe(404);
		const navigation = await GET(`${ticketUrl(aliceTicket)}/messages`, bob);
		expect(navigation.status === 404 || navigation.data.value.length === 0).toBe(true);
		const messages = await GET(`${SUPPORT}/SupportMessages?$filter=ticket_ID eq ${aliceTicket.ID}`, bob);
		expect(messages.data.value).toEqual([]);
	});

	it("does not let a user reply to or change another organization's ticket", async () => {
		expect([403, 404]).toContain((await action(bob, aliceTicket, "reply", { message: "Hi" })).status);
		expect([403, 404]).toContain((await action(bob, aliceTicket, "setStatus", { status: "CLOSED" })).status);
		const messages = await GET(`${SUPPORT}/SupportMessages?$filter=ticket_ID eq ${aliceTicket.ID}`, alice);
		expect(messages.data.value.some((message: { message: string }) => message.message === "Hi")).toBe(false);
	});

	it("does not open the support app to the tax advisor of an organization", async () => {
		const list = await GET(`${SUPPORT}/SupportTickets`, advisor);
		expect([403, 404]).toContain(list.status);
	});
});

describe("Conversation and status", () => {
	let ticket: Ticket;

	beforeAll(async () => {
		ticket = await createTicket(dana);
	});

	it("lets the support agent see the tickets of all organizations with the organization's name", async () => {
		const list = await GET(`${SUPPORT}/SupportTickets?$select=ID,organizationName,canManage&$top=1000`, support);
		const names = new Set(list.data.value.map((entry: Ticket) => entry.organizationName));
		expect(names).toEqual(new Set(["Bob Handwerk GmbH", "John Consulting", "Nordwind IT Consulting"]));
		expect(list.data.value[0].canManage).toBe(true);
		expect((await GET(`${ticketUrl(aliceTicket)}?$select=canManage`, alice)).data.canManage).toBe(false);
	});

	it("records a customer reply and tells the support team", async () => {
		const response = await action(dana, ticket, "reply", { message: "Still broken." });
		expect(response.status).toBe(200);
		expect(response.data.status_code).toBe("NEW");
		const messages = await GET(`${ticketUrl(ticket)}/messages`, dana);
		expect(messages.data.value).toEqual([
			expect.objectContaining({ createdBy: danaId, fromSupport: false, message: "Still broken." }),
		]);
		expect(sentTo(supportEmail)[0].body).toContain("Still broken.");
	});

	it("rejects an empty reply", async () => {
		expect((await action(dana, ticket, "reply", { message: "  " })).status).toBe(400);
	});

	it("records the support reply, starts the work and notifies the creator", async () => {
		const response = await action(support, ticket, "reply", { message: "We are on it." });
		expect(response.status).toBe(200);
		expect(response.data.status_code).toBe("IN_PROGRESS");
		const messages = await GET(`${ticketUrl(ticket)}/messages?$orderby=createdAt`, dana);
		expect(messages.data.value.at(-1)).toMatchObject({ createdBy: "support", fromSupport: true });
		const [notification] = sentTo(danaId);
		expect(notification.subject).toBe(`[Swiver] New reply to your support request #${ticket.ticketNumber}`);
		expect(notification.body).toContain("We are on it.");
		expect(notification.replyTo).toBe(supportEmail);
	});

	it("does not let customers change the status", async () => {
		expect((await action(dana, ticket, "setStatus", { status: "RESOLVED" })).status).toBe(403);
	});

	it("notifies the customer when support waits for them, and reopens on their reply", async () => {
		const waiting = await action(support, ticket, "setStatus", { status: "WAITING_FOR_CUSTOMER" });
		expect(waiting.data.status_code).toBe("WAITING_FOR_CUSTOMER");
		expect(sentTo(danaId)[0].subject).toBe(`[Swiver] Your support request #${ticket.ticketNumber} needs your input`);
		const answered = await action(dana, ticket, "reply", { message: "Here is the information." });
		expect(answered.data.status_code).toBe("IN_PROGRESS");
	});

	it("does not e-mail for internal status changes", async () => {
		await action(support, ticket, "setStatus", { status: "NEW" });
		await action(support, ticket, "setStatus", { status: "IN_PROGRESS" });
		expect(send).not.toHaveBeenCalled();
	});

	it("rejects an unknown status", async () => {
		expect((await action(support, ticket, "setStatus", { status: "CRITICAL" })).status).toBe(400);
	});

	it("resolves with a date and an e-mail, and closed tickets take no replies", async () => {
		const resolved = await action(support, ticket, "setStatus", { status: "RESOLVED" });
		expect(resolved.data.resolvedAt).toBeTruthy();
		expect(sentTo(danaId)[0].subject).toBe(`[Swiver] Your support request #${ticket.ticketNumber} is resolved`);
		const closed = await action(support, ticket, "setStatus", { status: "CLOSED" });
		expect(closed.data).toMatchObject({ resolvedAt: resolved.data.resolvedAt, status_code: "CLOSED" });
		expect((await action(dana, ticket, "reply", { message: "One more thing" })).status).toBe(400);
	});

	it("does not let anyone edit or delete a sent ticket", async () => {
		expect((await POST(`${ticketUrl(ticket)}/SupportService.draftEdit`, {}, dana)).status).toBe(403);
		expect((await axios.patch(ticketUrl(ticket), { subject: "x" }, support)).status).toBe(403);
		expect((await axios.delete(ticketUrl(ticket), dana)).status).toBe(403);
	});
});

describe("Attachments", () => {
	let attachmentUrl: string;

	beforeAll(async () => {
		const draft = await POST(`${SUPPORT}/SupportTickets`, { description: "See file", subject: "With file" }, alice);
		const attachment = await POST(`${draftUrl(draft.data.ID)}/attachments`, { fileName: "../../invoice.pdf" }, alice);
		ensure(attachment, 201);
		const draftAttachment = `${SUPPORT}/SupportAttachments(ID=${attachment.data.ID},IsActiveEntity=false)`;
		const upload = await axios.put(`${draftAttachment}/content`, pdf, {
			...alice,
			headers: { "Content-Type": "application/pdf" },
		});
		ensure(upload, 204);
		ensure(await POST(`${draftUrl(draft.data.ID)}/SupportService.draftActivate`, {}, alice), 201);
		attachmentUrl = `${SUPPORT}/SupportAttachments(ID=${attachment.data.ID},IsActiveEntity=true)`;
	});

	it("stores the file with a plain file name for the organization and the support agent", async () => {
		expect((await GET(attachmentUrl, alice)).data.fileName).toBe("invoice.pdf");
		for (const user of [alice, support]) {
			const download = await axios.get(`${attachmentUrl}/content`, { ...user, responseType: "text" });
			expect(download.status).toBe(200);
			expect(download.data).toBe(pdf);
			expect(download.headers["content-disposition"]).toContain('attachment; filename="invoice.pdf"');
		}
	});

	it("is not downloadable by another organization", async () => {
		expect((await GET(attachmentUrl, bob)).status).toBe(404);
		expect((await GET(`${attachmentUrl}/content`, bob)).status).toBe(404);
	});

	it("accepts only PDF, PNG and JPEG", async () => {
		const draft = await POST(`${SUPPORT}/SupportTickets`, { description: "x", subject: "x" }, alice);
		const attachment = await POST(`${draftUrl(draft.data.ID)}/attachments`, { fileName: "run.exe" }, alice);
		const upload = await axios.put(
			`${SUPPORT}/SupportAttachments(ID=${attachment.data.ID},IsActiveEntity=false)/content`,
			"MZ executable",
			{ ...alice, headers: { "Content-Type": "application/pdf" } },
		);
		expect(upload.status).toBe(415);
	});

	it("cannot be added to another organization's ticket", async () => {
		const response = await POST(`${SUPPORT}/SupportAttachments`, { fileName: "x.pdf", ticket_ID: aliceTicket.ID }, bob);
		expect([403, 404, 405]).toContain(response.status);
	});
});
