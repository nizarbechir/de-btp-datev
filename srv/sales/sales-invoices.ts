import cds, { Request } from "@sap/cds";

import { addDays, isoDate } from "../core/dates";
import { renderSalesInvoicePdf } from "../core/invoice-pdf";
import { nextCustomerNumber, nextSalesInvoiceNumber } from "../core/numbering";
import { logFailure } from "../core/operation-log";
import { boundID, boundKey, DomainError, rejectDomainError } from "../core/requests";
import { getCompanySettings, missingFooterFields } from "../core/settings";
import { ZugferdValidationError } from "../integrations/einvoice/zugferd";
import { requireOrganization } from "../organizations/organization-context";
import { recordPayment, removeManualPayments } from "../payments/payments";
import { sendInvoice, sendReminder } from "./document-emails";
import { applyTotals, DocumentConfig, recalculateDraft, registerItemCalculation } from "./document-items";
import { renderZugferdPdf } from "./einvoice-context";
import { assertIssuable, assertTransition, isIssued, LifecycleAction } from "./invoice-lifecycle";
import { DocumentData, loadInvoiceDocument, pdfResponse } from "./sales-documents";

/**
 * Sales invoices: numbering, totals, lifecycle (finalize, send, cancel, correct), payments,
 * PDF and ZUGFeRD, e-mail and reminders. The handlers only check the request and call the domain modules.
 */
const Invoices = "SalesService.SalesInvoices";
const InvoiceDrafts = "SalesService.SalesInvoices.drafts";
const Items = "SalesService.SalesInvoiceItems";

export const invoiceDocument: DocumentConfig = {
	documentDrafts: InvoiceDrafts,
	itemDrafts: "SalesService.SalesInvoiceItems.drafts",
	itemKey: "invoice_ID",
	taxDrafts: "SalesService.SalesInvoiceTaxes.drafts",
};

type Data = Record<string, unknown>;

/** Fields only the backend sets: number on first save, status, payments and e-mail through the actions. */
const backendFields = [
	"invoiceNumber",
	"status_code",
	"paymentDate",
	"paymentStatus_code",
	"paidAmount",
	"replacesInvoice_ID",
	"quote_ID",
	"sentAt",
	"sentTo",
	"emailMessageId",
] as const;

export function registerSalesInvoices(srv: cds.ApplicationService) {
	// Customers get their number on first save.
	srv.before("CREATE", "SalesService.Customers", async (req) => {
		req.data.customerNumber = await nextCustomerNumber();
	});
	srv.before("UPDATE", "SalesService.Customers", (req) => {
		delete req.data.customerNumber;
	});

	// New invoices start with today's date and the company's payment terms.
	srv.before("NEW", InvoiceDrafts, async (req) => {
		const settings = await getCompanySettings();
		const data = req.data as Data;
		const invoiceDate = (data.invoiceDate as string | undefined) ?? isoDate(new Date());
		data.invoiceDate = invoiceDate;
		data.dueDate ??= isoDate(addDays(new Date(invoiceDate), settings.defaultPaymentTermDays));
		data.currency_code ??= settings.defaultCurrency_code;
		data.status_code = "DRAFT";
	});
	srv.before("NEW", invoiceDocument.itemDrafts, async (req) => {
		req.data.taxRate ??= (await getCompanySettings()).defaultTaxRate;
	});
	srv.before("UPDATE", InvoiceDrafts, (req) => keepPaymentTerm(req));
	registerItemCalculation(srv, invoiceDocument.itemDrafts, invoiceDocument);

	// Saving: the backend calculates all amounts and gives out the invoice number.
	srv.before(["CREATE", "UPDATE"], Invoices, async (req) => {
		const data = req.data as Data;
		for (const field of backendFields) {
			Reflect.deleteProperty(data, field);
		}
		if (req.event === "CREATE") {
			data.status_code = "DRAFT";
		}
		if (!applyTotals(req, true, "SALES_INVOICE_WITHOUT_ITEMS")) {
			return;
		}
		if (req.event === "CREATE") {
			const { invoicePrefix } = await getCompanySettings();
			data.invoiceNumber = await nextSalesInvoiceNumber(invoicePrefix, String(data.invoiceDate));
		}
	});
	srv.before("EDIT", Invoices, async (req) => {
		const invoice = await loadInvoice(boundID(req));
		if (invoice && invoice.status_code !== "DRAFT") {
			return req.reject(409, "INVOICE_LOCKED");
		}
	});

	// Issued invoices are locked, also against direct OData requests that bypass the draft:
	// the invoice itself only changes while it is a draft, its items and taxes only through the draft.
	srv.before("UPDATE", Invoices, async (req) => {
		const invoice = await loadInvoice(boundID(req));
		if (invoice && invoice.status_code !== "DRAFT") {
			return req.reject(409, "INVOICE_LOCKED");
		}
	});
	srv.before(["CREATE", "UPDATE", "DELETE"], [Items, "SalesService.SalesInvoiceTaxes"], (req) =>
		req.reject(405, "INVOICE_ITEMS_ONLY_IN_DRAFT"),
	);

	// Lifecycle
	srv.on("finalize", Invoices, (req) => guarded(req, () => changeStatus(req, "finalize", "FINALIZED")));
	srv.on("markAsSent", Invoices, (req) => guarded(req, () => changeStatus(req, "send", "SENT")));
	srv.on("cancelInvoice", Invoices, (req) => guarded(req, () => changeStatus(req, "cancel", "CANCELLED")));
	srv.on("correct", Invoices, (req) => guarded(req, () => correct(srv, req)));
	srv.on("duplicate", Invoices, (req) => guarded(req, () => duplicate(srv, req)));

	// Payments
	srv.on("markAsPaid", Invoices, (req) =>
		guarded(req, async () => {
			await recordPayment({ invoiceID: boundID(req), kind: "sales" });
			return reload(req);
		}),
	);
	srv.on("recordPayment", Invoices, (req) =>
		guarded(req, async () => {
			const { amount, paymentDate, reference } = req.data;
			await recordPayment({ amount, invoiceID: boundID(req), kind: "sales", paymentDate, reference });
			return reload(req);
		}),
	);
	srv.on("reopen", Invoices, (req) =>
		guarded(req, async () => {
			await removeManualPayments("sales", boundID(req));
			return reload(req);
		}),
	);

	// Documents and e-mail
	srv.on("createCustomer", InvoiceDrafts, (req) => createCustomer(req));
	srv.on("pdf", [Invoices, InvoiceDrafts], (req) => pdf(req));
	srv.on("zugferd", Invoices, (req) => guarded(req, () => zugferd(req)));
	srv.on("sendByEmail", Invoices, (req) => guarded(req, () => sendByEmail(req)));
	srv.on("sendReminder", Invoices, (req) => guarded(req, () => remind(req)));
}

/** An invoice needs items, a customer and the complete company footer from Settings before it is issued. */
async function assertCanIssue(invoice: { customer_ID: null | string; ID: string }) {
	assertIssuable(invoice, await itemCount(invoice.ID));
	const missing = await missingFooterFields();
	if (missing.length) {
		throw new DomainError("CANNOT_FINALIZE_WITHOUT_COMPANY_DETAILS", 400, [missing.join(", ")]);
	}
}

/** The invoice PDF to send: ZUGFeRD if the data is complete, otherwise the normal PDF with a warning. */
async function attachmentFor(req: Request, document: DocumentData) {
	const number = document.invoice.invoiceNumber ?? "Invoice";
	try {
		const replaced = await replacedNumber(document.invoice as Data);
		const { pdf } = await renderZugferdPdf(document, replaced);
		return { content: pdf, contentType: "application/pdf", name: `${number}.pdf` };
	} catch (error) {
		if (!(error instanceof ZugferdValidationError)) {
			throw error;
		}
		req.warn("ZUGFERD_INCOMPLETE_SENT_AS_PDF", undefined, [error.problems.join(", ")]);
		return { content: await renderSalesInvoicePdf(document), contentType: "application/pdf", name: `${number}.pdf` };
	}
}

async function changeStatus(req: Request, action: LifecycleAction, status: string) {
	const invoice = await requireInvoice(boundID(req), true);
	assertTransition(action, invoice.status_code);
	if (action === "cancel" && Number(invoice.paidAmount ?? 0) > 0) {
		throw new DomainError("INVOICE_HAS_PAYMENTS");
	}
	if (status === "FINALIZED" || (status === "SENT" && invoice.status_code === "DRAFT")) {
		await assertCanIssue(invoice);
	}
	await setStatus(invoice, status);
	return reload(req);
}

/** Creates a new draft with the same customer, texts and items, dated today. */
async function copyToDraft(srv: cds.ApplicationService, id: string, extra: Data = {}): Promise<string> {
	const source = await SELECT.one
		.from(Invoices)
		.columns("customer_ID", "currency_code", "subject", "introductionText", "footerText", "notes")
		.where({ ID: id });
	const items = await SELECT.from(Items)
		.columns("position", "description", "quantity", "unit", "unitPrice", "taxRate", "productService_ID")
		.where({ invoice_ID: id })
		.orderBy("position");
	const copyID = cds.utils.uuid();
	await srv.send("NEW", InvoiceDrafts, {
		...source,
		...extra,
		ID: copyID,
		items: items.map((item: Data) => ({ ...item, ID: cds.utils.uuid() })),
	});
	await recalculateDraft(invoiceDocument, copyID);
	return copyID;
}

/** Cancels the issued invoice (if not yet cancelled) and opens a corrected copy that replaces it. */
async function correct(srv: cds.ApplicationService, req: Request) {
	const invoice = await requireInvoice(boundID(req), true);
	assertTransition("correct", invoice.status_code);
	// Also a correction that is still an unsaved draft counts: an invoice is corrected only once.
	const replacement = { replacesInvoice_ID: invoice.ID };
	if (
		(await SELECT.one.from(Invoices).columns("ID").where(replacement)) ||
		(await SELECT.one.from(InvoiceDrafts).columns("ID").where(replacement))
	) {
		throw new DomainError("INVOICE_ALREADY_CORRECTED");
	}
	if (invoice.status_code !== "CANCELLED") {
		if (Number(invoice.paidAmount ?? 0) > 0) {
			throw new DomainError("INVOICE_HAS_PAYMENTS");
		}
		await setStatus(invoice, "CANCELLED");
	}
	const copyID = await copyToDraft(srv, invoice.ID);
	await UPDATE(InvoiceDrafts).set({ replacesInvoice_ID: invoice.ID }).where({ ID: copyID });
	return SELECT.one.from(InvoiceDrafts).where({ ID: copyID });
}

/** Creates a customer from the invoice editor and assigns it to the invoice. */
async function createCustomer(req: Request) {
	const ID = boundID(req);
	const { city, companyName, country, email, name, postalCode, street } = req.data;
	if (!companyName && !name) {
		return req.reject(400, "CUSTOMER_NAME_MISSING");
	}
	const customer = {
		city,
		companyName,
		country_code: country || "DE",
		customerNumber: await nextCustomerNumber(),
		email,
		ID: cds.utils.uuid(),
		name,
		organization_ID: requireOrganization(req),
		postalCode,
		street,
	};
	await INSERT.into("swiver.Customers").entries(customer);
	await UPDATE(InvoiceDrafts).set({ customer_ID: customer.ID }).where({ ID });
	return SELECT.one.from(InvoiceDrafts).where({ ID });
}

async function duplicate(srv: cds.ApplicationService, req: Request) {
	const invoice = await requireInvoice(boundID(req));
	const copyID = await copyToDraft(srv, invoice.ID);
	return SELECT.one.from(InvoiceDrafts).where({ ID: copyID });
}

/** Runs a domain operation and turns business rule violations into readable errors. */
async function guarded<T>(req: Request, operation: () => Promise<T>): Promise<T> {
	try {
		return await operation();
	} catch (error) {
		if (!(error instanceof ZugferdValidationError)) {
			logFailure("sales", req.event, error, { invoice: req.params.length ? boundID(req) : undefined });
		}
		if (error instanceof ZugferdValidationError) {
			return req.reject(400, "ZUGFERD_INCOMPLETE", undefined, [error.problems.join(", ")]) as never;
		}
		return rejectDomainError(req, error);
	}
}

async function itemCount(invoiceID: string): Promise<number> {
	const result = await SELECT.one.from(Items).columns("count(1) as count").where({ invoice_ID: invoiceID });
	return Number(result?.count ?? 0);
}

/** When the invoice date changes, move the due date along so the payment term stays the same. */
async function keepPaymentTerm(req: Request) {
	if (!req.data.invoiceDate || "dueDate" in req.data) {
		return;
	}
	const current = await SELECT.one
		.from(InvoiceDrafts)
		.columns("invoiceDate", "dueDate")
		.where({ ID: req.data.ID ?? boundID(req) });
	if (!current?.invoiceDate || !current.dueDate) {
		return;
	}
	const term = (Date.parse(current.dueDate) - Date.parse(current.invoiceDate)) / (24 * 60 * 60 * 1000);
	req.data.dueDate = isoDate(addDays(new Date(req.data.invoiceDate), term));
}

async function loadInvoice(id: string) {
	return SELECT.one
		.from(Invoices)
		.columns("ID", "status_code", "customer_ID", "paidAmount", "paymentStatus_code", "dueDate", "HasDraftEntity")
		.where({ ID: id, organization_ID: requireOrganization() }) as unknown as Promise<null | {
		customer_ID: null | string;
		dueDate: string;
		HasDraftEntity: boolean;
		ID: string;
		paidAmount: null | string;
		paymentStatus_code: string;
		status_code: string;
	}>;
}

function mailDocument(document: DocumentData) {
	const invoice = document.invoice;
	return {
		currency: invoice.currency_code || "EUR",
		customerName: invoice.customer?.name || invoice.customer?.companyName || "Sir or Madam",
		dueDate: invoice.dueDate,
		grossAmount: invoice.grossAmount,
		invoiceDate: invoice.invoiceDate,
		number: invoice.invoiceNumber ?? "",
	};
}

async function pdf(req: Request) {
	const { ID, IsActiveEntity } = boundKey(req);
	const active = IsActiveEntity === undefined || IsActiveEntity === true || IsActiveEntity === "true";
	const document = await loadInvoiceDocument(ID, active);
	if (!document) {
		return req.reject(404, "INVOICE_NOT_FOUND");
	}
	const content = await renderSalesInvoicePdf(document);
	return pdfResponse(content, `${document.invoice.invoiceNumber ?? "Invoice-Draft"}.pdf`, Boolean(req.data.download));
}

function recipientOf(req: Request, document: DocumentData): string {
	const customer = document.invoice.customer as (Data & { email?: string }) | undefined;
	const recipient = (req.data.recipient as string | undefined)?.trim() || customer?.email;
	if (!recipient) {
		throw new DomainError("RECIPIENT_MISSING", 400);
	}
	return recipient;
}

async function reload(req: Request) {
	return SELECT.one.from(Invoices).where({ ID: boundID(req) });
}

/** Sends a payment reminder for an overdue invoice and records it. */
async function remind(req: Request) {
	const invoice = await requireInvoice(boundID(req));
	const today = isoDate(new Date());
	if (!isIssued(invoice.status_code) || invoice.paymentStatus_code === "PAID" || !(invoice.dueDate < today)) {
		throw new DomainError("INVOICE_NOT_OVERDUE");
	}
	const document = (await loadInvoiceDocument(invoice.ID)) as DocumentData;
	const recipient = recipientOf(req, document);
	const previous = await SELECT.one
		.from("swiver.ReminderRecords")
		.columns("count(1) as count")
		.where({ invoice_ID: invoice.ID });
	const level = Number(previous?.count ?? 0) + 1;
	const outstanding = (Number(document.invoice.grossAmount ?? 0) - Number(invoice.paidAmount ?? 0)).toFixed(2);
	const { body, sent, subject } = await sendReminder(
		{ ...mailDocument(document), attachment: await attachmentFor(req, document), level, outstanding },
		{ recipient },
	);
	await INSERT.into("swiver.ReminderRecords").entries({
		invoice_ID: invoice.ID,
		level,
		message: body,
		organization_ID: requireOrganization(req),
		recipient,
		sentAt: sent.sentAt,
		subject,
	});
	return reload(req);
}

async function replacedNumber(invoice: Data): Promise<null | string> {
	if (!invoice.replacesInvoice_ID) {
		return null;
	}
	const replaced = await SELECT.one.from(Invoices).columns("invoiceNumber").where({ ID: invoice.replacesInvoice_ID });
	return (replaced?.invoiceNumber as string | undefined) ?? null;
}

/**
 * The invoice of the current organization; with `lock`, its row stays locked until the transaction
 * ends, so parallel requests for the same invoice run one after the other.
 */
async function requireInvoice(id: string, lock = false) {
	if (lock) {
		await SELECT.one.from("swiver.SalesInvoices").columns("ID").where({ ID: id }).forUpdate();
	}
	const invoice = await loadInvoice(id);
	if (!invoice) {
		throw new DomainError("INVOICE_NOT_FOUND", 404);
	}
	if (invoice.HasDraftEntity) {
		throw new DomainError("SALES_INVOICE_BEING_EDITED");
	}
	return invoice;
}

/** Finalizes a draft if needed, e-mails the invoice with its ZUGFeRD PDF and marks it as sent. */
async function sendByEmail(req: Request) {
	const invoice = await requireInvoice(boundID(req), true);
	assertTransition("send", invoice.status_code);
	if (invoice.status_code === "DRAFT") {
		await assertCanIssue(invoice);
		await setStatus(invoice, "FINALIZED");
	}
	const document = (await loadInvoiceDocument(invoice.ID)) as DocumentData;
	const recipient = recipientOf(req, document);
	const sent = await sendInvoice(
		{ ...mailDocument(document), attachment: await attachmentFor(req, document) },
		{ message: req.data.message, recipient, subject: req.data.subject },
	);
	await UPDATE(Invoices)
		.set({ emailMessageId: sent.messageId ?? null, sentAt: sent.sentAt, sentTo: recipient, status_code: "SENT" })
		.where({ ID: invoice.ID });
	return reload(req);
}

/** Changes the status only if nobody changed it in the meantime (e.g. a parallel finalize). */
async function setStatus(invoice: { ID: string; status_code: string }, status: string) {
	const changed = await UPDATE(Invoices)
		.set({ status_code: status })
		.where({ ID: invoice.ID, status_code: invoice.status_code });
	if (!changed) {
		throw new DomainError("SALES_INVOICE_STATUS_CHANGE_NOT_ALLOWED");
	}
}

/** The ZUGFeRD PDF of an issued invoice. */
async function zugferd(req: Request) {
	const invoice = await requireInvoice(boundID(req));
	if (!isIssued(invoice.status_code)) {
		throw new DomainError("ZUGFERD_REQUIRES_FINALIZED");
	}
	const document = (await loadInvoiceDocument(invoice.ID)) as DocumentData;
	const { pdf: content } = await renderZugferdPdf(document, await replacedNumber(document.invoice as Data));
	return pdfResponse(content, `${document.invoice.invoiceNumber}-zugferd.pdf`, Boolean(req.data.download));
}
