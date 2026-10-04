import cds from "@sap/cds";

import { getCompany } from "../core/settings";
import { EmailNotConfiguredError, getEmailProvider } from "../integrations/email/email-provider";
import { requireOrganization } from "../organizations/organization-context";

/**
 * Tells the owners and admins by e-mail that the tax advisor asked a question on a record.
 * Recipients are the owners and admins whose user ID is an e-mail address, otherwise the company
 * e-mail. A failed e-mail never fails the comment.
 * TODO(feature): notification preferences per member
 */
const recordLabels: Record<string, { column: string; name: string }> = {
	BankTransactions: { column: "counterpartyName", name: "bank transaction" },
	IncomingDocuments: { column: "originalFileName", name: "document" },
	SalesInvoices: { column: "invoiceNumber", name: "sales invoice" },
	SupplierInvoices: { column: "invoiceNumber", name: "supplier invoice" },
};
const log = cds.log("comments");

export async function notifyTaxAdvisorQuestion(req: cds.Request, entity: string, recordID: string, text: string) {
	try {
		const recipients = await ownerEmails();
		if (!recipients.length) {
			return;
		}
		const label = recordLabels[entity] ?? { column: "ID", name: "record" };
		const record = await SELECT.one
			.from(req.target as cds.entity)
			.columns(label.column)
			.where({ ID: recordID });
		const reference = `${label.name} ${String(record?.[label.column] ?? "")}`.trim();
		await getEmailProvider(requireOrganization()).send({
			body: [
				"Hello,",
				"",
				`your tax advisor ${req.user.id} has a question on ${reference}:`,
				"",
				`"${text}"`,
				"",
				"Please answer it in Swiver; you find it in the Comments and Questions section of the record.",
			].join("\n"),
			subject: `Question from your tax advisor on ${reference}`,
			to: recipients,
		});
	} catch (error) {
		if (!(error instanceof EmailNotConfiguredError)) {
			log.warn("The tax advisor question could not be sent by e-mail:", error);
		}
	}
}

async function ownerEmails(): Promise<string[]> {
	const owners = (await SELECT.from("swiver.Memberships")
		.columns("userId")
		.where({ organization_ID: requireOrganization(), role: { in: ["OWNER", "ADMIN"] } })) as { userId: string }[];
	const emails = owners.map((owner) => owner.userId).filter((userId) => userId.includes("@"));
	if (emails.length) {
		return emails;
	}
	const company = await getCompany();
	return company?.email ? [String(company.email)] : [];
}
