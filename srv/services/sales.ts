import cds, { Request } from "@sap/cds";
import { Readable } from "node:stream";

import { Customers, SalesInvoiceItems, SalesInvoices } from "#cds-models/FinanceService";

import { addDays, isoDate } from "../core/dates";
import { renderSalesInvoicePdf, SalesInvoicePdfData } from "../core/invoice-pdf";
import { calculateInvoice, calculateItem, ItemInput } from "../core/money";
import { nextCustomerNumber, nextSalesInvoiceNumber } from "../core/numbering";
import { getCompanySettings } from "../core/settings";

const draft = "DRAFT";
const sent = "SENT";
const paid = "PAID";
const cancelled = "CANCELLED";

// Queries use the entity names: amounts are written as decimal strings, which the generated types don't allow.
const Invoices = "FinanceService.SalesInvoices";
const InvoiceDrafts = "FinanceService.SalesInvoices.drafts";
const Items = "FinanceService.SalesInvoiceItems";
const ItemDrafts = "FinanceService.SalesInvoiceItems.drafts";
const TaxDrafts = "FinanceService.SalesInvoiceTaxes.drafts";
const Settings = "FinanceService.CompanySettings";

type Data = Record<string, unknown>;
interface InvoiceKey {
	ID: string;
	IsActiveEntity?: boolean | string;
}

type Item = ItemInput & { ID?: string; position?: null | number };

/** Fields only the backend sets: number on first save, status and payment date through the actions. */
const backendFields = ["invoiceNumber", "status_code", "paymentDate"] as const;

/** Recalculates the items, totals and tax lines of an invoice being edited. */
export async function recalculateDraft(invoiceID: string) {
	const invoice = await SELECT.one
		.from(InvoiceDrafts)
		.columns("ID", "DraftAdministrativeData_DraftUUID")
		.where({ ID: invoiceID });
	if (!invoice) {
		return;
	}
	const items = sortByPosition(
		(await SELECT.from(ItemDrafts)
			.columns("ID", "position", "quantity", "unitPrice", "taxRate")
			.where({ invoice_ID: invoiceID })) as Item[],
	);
	for (const [index, item] of items.entries()) {
		await UPDATE(ItemDrafts)
			.set({ ...calculateItem(item), position: index + 1 })
			.where({ ID: item.ID });
	}

	const { taxes, ...totals } = calculateInvoice(items);
	await UPDATE(InvoiceDrafts).set(totals).where({ ID: invoiceID });
	await DELETE.from(TaxDrafts).where({ invoice_ID: invoiceID });
	if (taxes.length) {
		await INSERT.into(TaxDrafts).entries(
			taxes.map((tax) => ({
				...tax,
				DraftAdministrativeData_DraftUUID: invoice.DraftAdministrativeData_DraftUUID,
				HasActiveEntity: false,
				ID: cds.utils.uuid(),
				invoice_ID: invoiceID,
			})),
		);
	}
}

/**
 * Sales invoicing: customers, sales invoices with items, numbering, totals, status actions and PDF.
 */
export function registerSales(srv: cds.ApplicationService) {
	// Customers get their number on first save.
	srv.before("CREATE", Customers, async (req) => {
		req.data.customerNumber = await nextCustomerNumber();
	});
	srv.before("UPDATE", Customers, (req) => {
		delete req.data.customerNumber;
	});

	// New invoices start with today's date and the company's payment terms.
	srv.before("NEW", SalesInvoices.drafts, async (req) => {
		const settings = await getCompanySettings();
		const data = req.data as Data;
		const invoiceDate = (data.invoiceDate as string | undefined) ?? isoDate(new Date());
		data.invoiceDate = invoiceDate;
		data.dueDate ??= isoDate(addDays(new Date(invoiceDate), settings.defaultPaymentTermDays));
		data.currency_code ??= settings.defaultCurrency_code;
		data.status_code = draft;
	});
	srv.before("NEW", SalesInvoiceItems.drafts, async (req) => {
		req.data.taxRate ??= (await getCompanySettings()).defaultTaxRate;
	});
	srv.before("UPDATE", SalesInvoices.drafts, (req) => keepPaymentTerm(req));

	// Recalculate items and totals while editing, so the user sees them without saving.
	const itemInvoice = new WeakMap<Request, string>();
	srv.before(["UPDATE", "DELETE"], SalesInvoiceItems.drafts, async (req) => {
		const item = await SELECT.one
			.from(ItemDrafts)
			.columns("invoice_ID")
			.where({ ID: itemKey(req) });
		if (item?.invoice_ID) {
			itemInvoice.set(req, item.invoice_ID);
		}
	});
	srv.after(["UPDATE", "DELETE"], SalesInvoiceItems.drafts, async (results, req) => {
		const invoiceID = itemInvoice.get(req);
		if (invoiceID) {
			await recalculateDraft(invoiceID);
		}
	});
	srv.after("NEW", SalesInvoiceItems.drafts, async (results, req) => {
		const invoiceID = (req.data as Data).invoice_ID as string | undefined;
		if (invoiceID) {
			await recalculateDraft(invoiceID);
		}
	});

	// Saving: the backend calculates all amounts and gives out the invoice number.
	srv.before(["CREATE", "UPDATE"], SalesInvoices, async (req) => {
		const data = req.data as Data;
		for (const field of backendFields) {
			Reflect.deleteProperty(data, field);
		}
		if (req.event === "CREATE") {
			data.status_code = draft;
		}
		if (!applyTotals(req)) {
			return;
		}
		if (req.event === "CREATE") {
			const { invoicePrefix } = await getCompanySettings();
			data.invoiceNumber = await nextSalesInvoiceNumber(invoicePrefix, String(data.invoiceDate));
		}
	});

	srv.before("EDIT", SalesInvoices, async (req) => {
		const invoice = await SELECT.one
			.from(Invoices)
			.columns("status_code")
			.where({ ID: invoiceKey(req).ID });
		if (invoice?.status_code === paid || invoice?.status_code === cancelled) {
			return req.reject(409, "INVOICE_CLOSED");
		}
		if (invoice?.status_code === sent) {
			req.warn("EDIT_SENT_INVOICE");
		}
	});

	// Status actions
	srv.on("markAsSent", SalesInvoices, (req) => setStatus(req, [draft], { status_code: sent }));
	srv.on("markAsPaid", SalesInvoices, (req) =>
		setStatus(req, [sent], { paymentDate: isoDate(new Date()), status_code: paid }),
	);
	srv.on("cancelInvoice", SalesInvoices, (req) => setStatus(req, [draft, sent], { status_code: cancelled }));
	srv.on("reopen", SalesInvoices, (req) => setStatus(req, [paid, cancelled], { paymentDate: null, status_code: sent }));

	srv.on("duplicate", SalesInvoices, (req) => duplicate(srv, req));
	srv.on("createCustomer", SalesInvoices.drafts, (req) => createCustomer(req));
	srv.on("pdf", [Invoices, InvoiceDrafts], (req) => pdf(req));
}

/** Sets item amounts, positions, totals and tax lines on the invoice being saved. Returns false if it has no items. */
function applyTotals(req: Request): boolean {
	const items = (req.data.items ?? (req.event === "CREATE" ? [] : undefined)) as Item[] | undefined;
	if (items === undefined) {
		return true;
	}
	if (items.length === 0) {
		req.error(400, "SALES_INVOICE_WITHOUT_ITEMS", "items");
		return false;
	}
	sortByPosition(items).forEach((item, index) => Object.assign(item, calculateItem(item), { position: index + 1 }));
	const { taxes, ...totals } = calculateInvoice(items);
	Object.assign(req.data, totals, { taxes });
	return true;
}

/** Creates a customer from the invoice editor and assigns it to the invoice. */
async function createCustomer(req: Request) {
	const { ID } = invoiceKey(req);
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
		postalCode,
		street,
	};
	await INSERT.into("swiver.Customers").entries(customer);
	await UPDATE(InvoiceDrafts).set({ customer_ID: customer.ID }).where({ ID });
	return SELECT.one.from(InvoiceDrafts).where({ ID });
}

/** Creates a new draft with the same customer, texts and items, dated today. */
async function duplicate(srv: cds.ApplicationService, req: Request) {
	const { ID } = invoiceKey(req);
	const source = await SELECT.one
		.from(Invoices)
		.columns("customer_ID", "currency_code", "subject", "introductionText", "footerText", "notes")
		.where({ ID });
	if (!source) {
		return req.reject(404, "INVOICE_NOT_FOUND");
	}
	const items = await SELECT.from(Items)
		.columns("position", "description", "quantity", "unit", "unitPrice", "taxRate")
		.where({ invoice_ID: ID })
		.orderBy("position");

	const copyID = cds.utils.uuid();
	await srv.send("NEW", InvoiceDrafts, {
		...source,
		ID: copyID,
		items: items.map((item: Data) => ({ ...item, ID: cds.utils.uuid() })),
	});
	await recalculateDraft(copyID);
	return SELECT.one.from(InvoiceDrafts).where({ ID: copyID });
}

function invoiceKey(req: Request): InvoiceKey {
	const key = req.params.at(-1);
	return (typeof key === "object" ? key : { ID: key }) as InvoiceKey;
}

function isActive(key: InvoiceKey): boolean {
	return key.IsActiveEntity === undefined || key.IsActiveEntity === true || key.IsActiveEntity === "true";
}

function itemKey(req: Request): string {
	if (req.data?.ID) {
		return req.data.ID;
	}
	return invoiceKey(req).ID;
}

/** When the invoice date changes, move the due date along so the payment term stays the same. */
async function keepPaymentTerm(req: Request) {
	if (!req.data.invoiceDate || "dueDate" in req.data) {
		return;
	}
	const current = await SELECT.one
		.from(InvoiceDrafts)
		.columns("invoiceDate", "dueDate")
		.where({ ID: req.data.ID ?? invoiceKey(req).ID });
	if (!current?.invoiceDate || !current.dueDate) {
		return;
	}
	const term = (Date.parse(current.dueDate) - Date.parse(current.invoiceDate)) / (24 * 60 * 60 * 1000);
	req.data.dueDate = isoDate(addDays(new Date(req.data.invoiceDate), term));
}

async function pdf(req: Request) {
	const key = invoiceKey(req);
	const active = isActive(key);
	const invoice = (await SELECT.one.from(active ? Invoices : InvoiceDrafts).where({ ID: key.ID })) as
		SalesInvoicePdfData["invoice"] | undefined;
	if (!invoice) {
		return req.reject(404, "INVOICE_NOT_FOUND");
	}
	const byInvoice = { invoice_ID: key.ID };
	invoice.items = await SELECT.from(active ? Items : ItemDrafts)
		.where(byInvoice)
		.orderBy("position");
	invoice.taxes = await SELECT.from(active ? "FinanceService.SalesInvoiceTaxes" : TaxDrafts).where(byInvoice);
	invoice.customer = await SELECT.one.from("FinanceService.Customers").where({ ID: invoice.customer_ID ?? null });
	if (invoice.customer?.country_code) {
		invoice.customer.country = await SELECT.one
			.from("sap.common.Countries")
			.columns("name")
			.where({ code: invoice.customer.country_code });
	}
	const company = (await SELECT.one.from(Settings).where({ ID: 1 })) as SalesInvoicePdfData["company"];
	const logo = await SELECT.one.from(Settings).columns("logo").where({ ID: 1 });

	const content = await renderSalesInvoicePdf({ company, invoice, logo: await toBuffer(logo?.logo) });
	return {
		$mediaContentDispositionType: req.data.download ? "attachment" : "inline",
		filename: `${invoice.invoiceNumber ?? "Invoice-Draft"}.pdf`,
		mimetype: "application/pdf",
		value: Readable.from(content),
	};
}

async function setStatus(
	req: Request,
	allowedFrom: string[],
	change: { paymentDate?: null | string; status_code: string },
) {
	const { ID } = invoiceKey(req);
	const invoice = await SELECT.one.from(Invoices).columns("status_code", "HasDraftEntity").where({ ID });
	if (!invoice) {
		return req.reject(404, "INVOICE_NOT_FOUND");
	}
	if (invoice.HasDraftEntity) {
		return req.reject(409, "SALES_INVOICE_BEING_EDITED");
	}
	if (!allowedFrom.includes(invoice.status_code as string)) {
		return req.reject(409, "SALES_INVOICE_STATUS_CHANGE_NOT_ALLOWED");
	}
	await UPDATE(Invoices).set(change).where({ ID });
	return SELECT.one.from(Invoices).where({ ID });
}

function sortByPosition<T extends Item>(items: T[]): T[] {
	return items.sort(
		(first, second) => (first.position ?? Number.MAX_SAFE_INTEGER) - (second.position ?? Number.MAX_SAFE_INTEGER),
	);
}

async function toBuffer(stream: unknown): Promise<Buffer | undefined> {
	if (!stream) {
		return undefined;
	}
	if (Buffer.isBuffer(stream)) {
		return stream;
	}
	const chunks: Buffer[] = [];
	for await (const chunk of stream as Readable) {
		chunks.push(Buffer.from(chunk));
	}
	return chunks.length ? Buffer.concat(chunks) : undefined;
}
