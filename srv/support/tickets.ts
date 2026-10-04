import cds from "@sap/cds";

import { nextSupportTicketNumber } from "../core/numbering";
import { boundID } from "../core/requests";
import { currentOrganization } from "../organizations/organization-context";
import {
	sendCustomerReply,
	sendSupportReply,
	sendSupportResolved,
	sendSupportTicketConfirmation,
	sendSupportTicketCreated,
	sendSupportWaitingForCustomer,
	ticketMail,
} from "./notifications";

/**
 * Support ticket lifecycle. Customers (owners, admins, members) create tickets and reply; support
 * agents reply and change the status. Who may call what is decided by `@restrict`; the organization
 * check here is a second line of defense for the actions.
 *
 * Status flow: NEW -> IN_PROGRESS (first support reply) -> WAITING_FOR_CUSTOMER / RESOLVED -> CLOSED.
 * A customer reply on a ticket waiting for them or resolved puts it back to IN_PROGRESS.
 */
export type TicketStatus = "CLOSED" | "IN_PROGRESS" | "NEW" | "RESOLVED" | "WAITING_FOR_CUSTOMER";

export const supportAgentRole = "SupportAgent";
const statuses: TicketStatus[] = ["NEW", "IN_PROGRESS", "WAITING_FOR_CUSTOMER", "RESOLVED", "CLOSED"];
const Tickets = "swiver.SupportTickets";

interface Ticket {
	ID: string;
	organization_ID: string;
	status_code: TicketStatus;
}

export function isSupportAgent(user?: cds.User): boolean {
	return Boolean(user?.is(supportAgentRole));
}

/** After a ticket is saved: tells the support team and confirms to the creator. */
export async function notifyTicketCreated(ticketId: string) {
	const ticket = await ticketMail(ticketId);
	await sendSupportTicketCreated(ticket);
	await sendSupportTicketConfirmation(ticket);
}

/** Before a ticket is saved for the first time: number, status and creator e-mail come from the backend. */
export async function prepareTicket(req: cds.Request) {
	const data = req.data as Record<string, unknown>;
	data.ticketNumber = await nextSupportTicketNumber();
	data.status_code = "NEW";
	data.resolvedAt = null;
	data.creatorEmail = userEmail(req.user);
}

export async function reply(req: cds.Request) {
	const message = String(req.data.message ?? "").trim();
	if (!message) {
		return req.reject(400, "SUPPORT_MESSAGE_MISSING");
	}
	const ticket = await readTicket(req);
	if (ticket.status_code === "CLOSED") {
		return req.reject(400, "SUPPORT_TICKET_CLOSED");
	}
	const fromSupport = isSupportAgent(req.user);
	await INSERT.into("swiver.SupportMessages").entries({ fromSupport, message, ticket_ID: ticket.ID });
	let status = ticket.status_code;
	if (fromSupport && status === "NEW") {
		status = "IN_PROGRESS";
	} else if (!fromSupport && (status === "WAITING_FOR_CUSTOMER" || status === "RESOLVED")) {
		status = "IN_PROGRESS";
	}
	// Always updated, so the ticket's modifiedAt shows the last activity.
	await UPDATE(Tickets, ticket.ID).with({
		status_code: status,
		...(status === ticket.status_code ? {} : { resolvedAt: null }),
	});
	const mail = await ticketMail(ticket.ID);
	await (fromSupport ? sendSupportReply(mail, message) : sendCustomerReply(mail, message));
	return SELECT.one.from(req.subject);
}

export async function setStatus(req: cds.Request) {
	const status = req.data.status as TicketStatus;
	if (!statuses.includes(status)) {
		return req.reject(400, "SUPPORT_STATUS_INVALID");
	}
	const ticket = await readTicket(req);
	if (status !== ticket.status_code) {
		// Closing keeps the resolution date; any other status than RESOLVED reopens the ticket.
		const resolvedAt = status === "RESOLVED" ? new Date().toISOString() : null;
		await UPDATE(Tickets, ticket.ID).with({ status_code: status, ...(status === "CLOSED" ? {} : { resolvedAt }) });
		if (status === "WAITING_FOR_CUSTOMER") {
			await sendSupportWaitingForCustomer(await ticketMail(ticket.ID));
		} else if (status === "RESOLVED") {
			await sendSupportResolved(await ticketMail(ticket.ID));
		}
	}
	return SELECT.one.from(req.subject);
}

/** The ticket of a bound action; 404 unless it belongs to the user's organization or the user is an agent. */
async function readTicket(req: cds.Request): Promise<Ticket> {
	const ticket = (await SELECT.one
		.from(Tickets)
		.columns("ID", "organization_ID", "status_code")
		.where({ ID: boundID(req) })) as Ticket | undefined;
	if (!ticket || (!isSupportAgent(req.user) && ticket.organization_ID !== currentOrganization()?.organizationId)) {
		return req.reject(404, "RECORD_NOT_FOUND") as never;
	}
	return ticket;
}

/** The signed-in user's e-mail: the identity provider's email attribute, or the user ID if it is one. */
function userEmail(user: cds.User): null | string {
	const attr = (user.attr ?? {}) as { email?: unknown };
	const email = typeof attr.email === "string" ? attr.email : user.id;
	return /^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/.test(email) ? email : null;
}
