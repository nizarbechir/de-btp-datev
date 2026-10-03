import { formatMoney } from "../core/invoice-pdf";
import { getCompany } from "../core/settings";
import { EmailAttachment, getEmailProvider, SentEmail } from "../integrations/email/email-provider";
import { requireOrganization } from "../organizations/organization-context";

export interface MailDocument {
	attachment: EmailAttachment;
	currency: string;
	customerName: string;
	dueDate?: null | string;
	grossAmount: Amount;
	invoiceDate?: null | string;
	number: string;
	outstanding?: Amount;
}

export interface MailOptions {
	message?: null | string;
	recipient: string;
	subject?: null | string;
}

export interface ReminderMail extends MailDocument {
	level: number;
}

/**
 * Application-level e-mails: invoices, quotes and payment reminders. Builds subject, text and
 * attachments; the provider only transports them.
 */
type Amount = null | number | string | undefined;

export async function sendInvoice(document: MailDocument, options: MailOptions): Promise<SentEmail> {
	const company = await sender();
	const subject = options.subject || `Invoice ${document.number} from ${company.name}`;
	const body =
		options.message ||
		[
			`Dear ${document.customerName},`,
			"",
			`please find attached invoice ${document.number} of ${formatDate(document.invoiceDate)} for ${formatMoney(document.grossAmount, document.currency)}.`,
			document.dueDate
				? `Please pay by ${formatDate(document.dueDate)}, using ${document.number} as payment reference.`
				: "",
			"",
			"Thank you for your business.",
			"",
			"Kind regards",
			company.signature,
		]
			.filter((line, index, lines) => line !== "" || lines[index - 1] !== "")
			.join("\n");
	return send(company, options.recipient, subject, body, document.attachment);
}

export async function sendQuote(document: MailDocument, options: MailOptions): Promise<SentEmail> {
	const company = await sender();
	const subject = options.subject || `Quote ${document.number} from ${company.name}`;
	const body =
		options.message ||
		[
			`Dear ${document.customerName},`,
			"",
			`thank you for your interest. Please find attached our quote ${document.number} for ${formatMoney(document.grossAmount, document.currency)}${document.dueDate ? `, valid until ${formatDate(document.dueDate)}` : ""}.`,
			"",
			"We look forward to working with you.",
			"",
			"Kind regards",
			company.signature,
		].join("\n");
	return send(company, options.recipient, subject, body, document.attachment);
}

export async function sendReminder(
	document: ReminderMail,
	options: MailOptions,
): Promise<{ body: string; sent: SentEmail; subject: string }> {
	const company = await sender();
	const subject = options.subject || `Payment reminder: invoice ${document.number}`;
	const body =
		options.message ||
		[
			`Dear ${document.customerName},`,
			"",
			`according to our records, invoice ${document.number} of ${formatDate(document.invoiceDate)} was due on ${formatDate(document.dueDate)}.`,
			`The outstanding amount is ${formatMoney(document.outstanding, document.currency)}.`,
			"",
			"If you have already paid, please disregard this message. Otherwise we kindly ask you to transfer the amount within the next 7 days.",
			"The invoice is attached for your convenience.",
			"",
			"Kind regards",
			company.signature,
		].join("\n");
	return { body, sent: await send(company, options.recipient, subject, body, document.attachment), subject };
}

function formatDate(value?: null | string): string {
	if (!value) {
		return "";
	}
	return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC", year: "numeric" }).format(
		new Date(value),
	);
}

async function send(
	company: { email?: string },
	recipient: string,
	subject: string,
	body: string,
	attachment: EmailAttachment,
) {
	const provider = getEmailProvider(requireOrganization());
	return provider.send({ attachments: [attachment], body, replyTo: company.email, subject, to: [recipient] });
}

async function sender() {
	const company = (await getCompany()) ?? {};
	const name = String(company.companyName ?? "");
	return {
		email: (company.email as string | undefined) ?? undefined,
		name,
		signature: [company.ownerName, name].filter(Boolean).join("\n"),
	};
}
