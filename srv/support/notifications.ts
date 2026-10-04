import cds from "@sap/cds";

import { EmailMessage, EmailNotConfiguredError, getEmailProvider } from "../integrations/email/email-provider";

/**
 * The support e-mails. Builds subject and text; the e-mail provider only transports them.
 * The support team's address is SUPPORT_EMAIL (environment) or `swiver.support.email` (CDS environment).
 * A failed or missing e-mail never fails the ticket: it is logged and the ticket stays as it is.
 * TODO(feature): notification preferences per user
 */
export interface TicketMail {
	category?: string;
	createdBy: string;
	creatorEmail?: null | string;
	description: string;
	organization_ID: string;
	organizationName?: string;
	priority?: string;
	subject: string;
	ticketNumber: number;
}

const log = cds.log("support");

/** To the support team: the customer answered. */
export async function sendCustomerReply(ticket: TicketMail, message: string) {
	await sendToSupport(ticket, {
		body: [
			`${creator(ticket)} replied to support ticket #${ticket.ticketNumber} "${ticket.subject}":`,
			"",
			message,
		].join("\n"),
		subject: `[Swiver] Customer reply on support ticket #${ticket.ticketNumber} - ${ticket.subject}`,
	});
}

/** To the creator: support answered. */
export async function sendSupportReply(ticket: TicketMail, message: string) {
	await sendToCustomer(ticket, {
		body: [
			"Hello,",
			"",
			`the Swiver support team replied to your request #${ticket.ticketNumber} "${ticket.subject}":`,
			"",
			message,
			"",
			"You can reply in the Support app of Swiver.",
		].join("\n"),
		subject: `[Swiver] New reply to your support request #${ticket.ticketNumber}`,
	});
}

/** To the creator: the ticket is resolved. */
export async function sendSupportResolved(ticket: TicketMail) {
	await sendToCustomer(ticket, {
		body: [
			"Hello,",
			"",
			`your support request #${ticket.ticketNumber} "${ticket.subject}" has been resolved.`,
			"",
			"If the problem is not solved, reply in the Support app of Swiver and the ticket is reopened.",
		].join("\n"),
		subject: `[Swiver] Your support request #${ticket.ticketNumber} is resolved`,
	});
}

/** To the creator: we received the ticket. */
export async function sendSupportTicketConfirmation(ticket: TicketMail) {
	await sendToCustomer(ticket, {
		body: [
			"Hello,",
			"",
			`we received your support request #${ticket.ticketNumber} "${ticket.subject}" and will get back to you as soon as possible.`,
			"",
			"You can follow the ticket and reply in the Support app of Swiver.",
		].join("\n"),
		subject: `[Swiver] We received your support request #${ticket.ticketNumber}`,
	});
}

/** To the support team: a customer opened a ticket. */
export async function sendSupportTicketCreated(ticket: TicketMail) {
	await sendToSupport(ticket, {
		body: [
			`New support ticket #${ticket.ticketNumber} from ${ticket.organizationName}.`,
			"",
			`Organization: ${ticket.organizationName}`,
			`Created by: ${creator(ticket)}`,
			`Category: ${ticket.category}`,
			`Priority: ${ticket.priority}`,
			`Subject: ${ticket.subject}`,
			"",
			ticket.description,
		].join("\n"),
		subject: `[Swiver] New support ticket #${ticket.ticketNumber} - ${ticket.subject}`,
	});
}

/** To the creator: support needs more information. */
export async function sendSupportWaitingForCustomer(ticket: TicketMail) {
	await sendToCustomer(ticket, {
		body: [
			"Hello,",
			"",
			`the Swiver support team needs more information on your request #${ticket.ticketNumber} "${ticket.subject}".`,
			"",
			"Please reply in the Support app of Swiver.",
		].join("\n"),
		subject: `[Swiver] Your support request #${ticket.ticketNumber} needs your input`,
	});
}

export function supportEmail(): string | undefined {
	const env = cds.env as { swiver?: { support?: { email?: string } } };
	return process.env.SUPPORT_EMAIL || env.swiver?.support?.email || undefined;
}

/** Loads what the e-mails show about a ticket. */
export async function ticketMail(ticketId: string): Promise<TicketMail> {
	return SELECT.one
		.from("swiver.SupportTickets")
		.columns(
			"ticketNumber",
			"subject",
			"description",
			"createdBy",
			"creatorEmail",
			"organization_ID",
			"organization.name as organizationName",
			"category.name as category",
			"priority.name as priority",
		)
		.where({ ID: ticketId }) as unknown as Promise<TicketMail>;
}

function creator(ticket: TicketMail): string {
	return ticket.creatorEmail && ticket.creatorEmail !== ticket.createdBy
		? `${ticket.createdBy} <${ticket.creatorEmail}>`
		: ticket.createdBy;
}

async function send(ticket: TicketMail, message: EmailMessage) {
	try {
		await getEmailProvider(ticket.organization_ID).send(message);
	} catch (error) {
		if (error instanceof EmailNotConfiguredError) {
			log.warn(`E-mail is not configured: "${message.subject}" was not sent.`);
		} else {
			log.error(`"${message.subject}" could not be sent:`, error);
		}
	}
}

async function sendToCustomer(ticket: TicketMail, message: Omit<EmailMessage, "to">) {
	if (!ticket.creatorEmail) {
		log.info(`Ticket #${ticket.ticketNumber}: the creator has no e-mail address, "${message.subject}" was not sent.`);
		return;
	}
	await send(ticket, { ...message, replyTo: supportEmail(), to: [ticket.creatorEmail] });
}

async function sendToSupport(ticket: TicketMail, message: Omit<EmailMessage, "to">) {
	const to = supportEmail();
	if (!to) {
		log.warn(
			`SUPPORT_EMAIL is not configured: the support team was not notified about ticket #${ticket.ticketNumber}.`,
		);
		return;
	}
	await send(ticket, { ...message, replyTo: ticket.creatorEmail, to: [to] });
}
