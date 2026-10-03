import { MicrosoftGraphEmailProvider, readGraphConfig } from "./microsoft-graph-provider";

/**
 * Sending e-mails, independent of the provider. Business code only uses getEmailProvider().send().
 * TODO(feature): secure organization-specific email-provider credentials
 * TODO(feature): additional email providers
 */
export interface EmailAttachment {
	content: Buffer;
	contentType: string;
	name: string;
}

export interface EmailMessage {
	attachments?: EmailAttachment[];
	body: string;
	replyTo?: null | string;
	subject: string;
	to: string[];
}

export interface EmailProvider {
	readonly name: string;
	send(message: EmailMessage): Promise<SentEmail>;
}

export interface SentEmail {
	messageId?: string;
	provider: string;
	sentAt: string;
}

export class EmailNotConfiguredError extends Error {
	constructor() {
		super("Email provider is not configured.");
	}
}

/**
 * The provider for an organization. For now one deployment-wide Microsoft Graph configuration
 * sends for all organizations (with the organization's e-mail as reply-to).
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- per-organization providers will use it
export function getEmailProvider(organizationId: string): EmailProvider {
	const config = readGraphConfig();
	if (!config) {
		throw new EmailNotConfiguredError();
	}
	return new MicrosoftGraphEmailProvider(config);
}
