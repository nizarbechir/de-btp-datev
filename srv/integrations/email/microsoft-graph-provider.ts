import cds from "@sap/cds";

import type { EmailMessage, EmailProvider, SentEmail } from "./email-provider";

/**
 * Sends e-mails through Microsoft Graph v1.0 (sendMail) with the OAuth 2.0 client credentials flow.
 * The app registration needs the application permission Mail.Send.
 * Configuration (environment or bound service): MS_GRAPH_TENANT_ID, MS_GRAPH_CLIENT_ID,
 * MS_GRAPH_CLIENT_SECRET, MS_GRAPH_SENDER_EMAIL.
 */
export interface GraphConfig {
	clientId: string;
	clientSecret: string;
	senderEmail: string;
	tenantId: string;
}

const graphUrl = "https://graph.microsoft.com/v1.0";
const log = cds.log("email");

export class MicrosoftGraphEmailProvider implements EmailProvider {
	readonly name = "MicrosoftGraph";
	private token?: { expiresAt: number; value: string };

	constructor(private config: GraphConfig) {}

	async send(message: EmailMessage): Promise<SentEmail> {
		const domain = this.config.senderEmail.split("@")[1] ?? "swiver";
		const messageId = `<${cds.utils.uuid()}@${domain}>`;
		const response = await fetch(`${graphUrl}/users/${encodeURIComponent(this.config.senderEmail)}/sendMail`, {
			body: JSON.stringify({
				message: {
					attachments: (message.attachments ?? []).map((attachment) => ({
						// eslint-disable-next-line @typescript-eslint/naming-convention -- Graph API property
						"@odata.type": "#microsoft.graph.fileAttachment",
						contentBytes: attachment.content.toString("base64"),
						contentType: attachment.contentType,
						name: attachment.name,
					})),
					body: { content: message.body, contentType: "Text" },
					internetMessageId: messageId,
					replyTo: message.replyTo ? [{ emailAddress: { address: message.replyTo } }] : [],
					subject: message.subject,
					toRecipients: message.to.map((address) => ({ emailAddress: { address } })),
				},
				saveToSentItems: true,
			}),
			headers: { Authorization: `Bearer ${await this.accessToken()}`, "Content-Type": "application/json" },
			method: "POST",
		});
		if (!response.ok) {
			// The error body has Graph's error code and message; cut it so no large payload ends up in the logs.
			log.error("Microsoft Graph sendMail failed", response.status, (await response.text()).slice(0, 500));
			throw new Error(`The e-mail could not be sent (Microsoft Graph status ${response.status}).`);
		}
		return { messageId, provider: this.name, sentAt: new Date().toISOString() };
	}

	private async accessToken(): Promise<string> {
		if (this.token && this.token.expiresAt > Date.now() + 60_000) {
			return this.token.value;
		}
		const response = await fetch(`https://login.microsoftonline.com/${this.config.tenantId}/oauth2/v2.0/token`, {
			body: new URLSearchParams({
				// eslint-disable-next-line @typescript-eslint/naming-convention -- OAuth parameter
				client_id: this.config.clientId,
				// eslint-disable-next-line @typescript-eslint/naming-convention -- OAuth parameter
				client_secret: this.config.clientSecret,
				// eslint-disable-next-line @typescript-eslint/naming-convention -- OAuth parameter
				grant_type: "client_credentials",
				scope: "https://graph.microsoft.com/.default",
			}),
			method: "POST",
		});
		if (!response.ok) {
			log.error("Microsoft Graph token request failed", response.status, (await response.text()).slice(0, 500));
			throw new Error("The e-mail provider rejected the credentials.");
		}
		const { access_token: value, expires_in: expiresIn } = (await response.json()) as {
			access_token: string;
			expires_in: number;
		};
		this.token = { expiresAt: Date.now() + expiresIn * 1000, value };
		return value;
	}
}

/** Reads the configuration from the environment, or from cds.env (e.g. a bound user-provided service). */
export function readGraphConfig(): GraphConfig | undefined {
	const env = {
		...((cds.env.requires as Record<string, { credentials?: Record<string, string> }>)["ms-graph"]?.credentials ?? {}),
		...process.env,
	};
	const config = {
		clientId: env.MS_GRAPH_CLIENT_ID,
		clientSecret: env.MS_GRAPH_CLIENT_SECRET,
		senderEmail: env.MS_GRAPH_SENDER_EMAIL,
		tenantId: env.MS_GRAPH_TENANT_ID,
	};
	return Object.values(config).every(Boolean) ? (config as GraphConfig) : undefined;
}
