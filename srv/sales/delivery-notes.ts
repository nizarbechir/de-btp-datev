import cds, { Request } from "@sap/cds";

import { isoDate } from "../core/dates";
import { nextDeliveryNoteNumber } from "../core/numbering";
import { boundID, DomainError, guarded } from "../core/requests";
import { getCompanySettings } from "../core/settings";
import { bookMovements, isStockTracked, positiveQuantity, quantity, units } from "../inventory/stock";
import { requireOrganization } from "../organizations/organization-context";
import { recalculateDraft, sortByPosition } from "./document-items";
import { convertQuote } from "./quotes";
import { invoiceDocument } from "./sales-invoices";

/**
 * Delivery notes: DRAFT (editable, no stock effect) → CONFIRMED (stock booked out, locked).
 * Confirming is the only stock-out of a sale; quotes and invoices never change stock.
 * TODO(feature): delivery note PDF (Lieferschein)
 * TODO(feature): cancelling a confirmed delivery note with compensating movements
 */
const Notes = "SalesService.DeliveryNotes";
const NoteDrafts = "SalesService.DeliveryNotes.drafts";
const Items = "SalesService.DeliveryNoteItems";
const ItemDrafts = "SalesService.DeliveryNoteItems.drafts";

type Data = Record<string, unknown>;
interface Note {
	customer_ID: string;
	deliveryDate: string;
	HasDraftEntity: boolean;
	ID: string;
	quote_ID: null | string;
	salesInvoice_ID: null | string;
	status_code: string;
}

/** Fields only the backend sets: number on first save, status and links through the actions. */
const backendFields = ["deliveryNoteNumber", "status_code", "salesInvoice_ID", "confirmedAt", "confirmedBy"] as const;

export function registerDeliveryNotes(srv: cds.ApplicationService) {
	srv.before("NEW", NoteDrafts, async (req) => {
		const data = req.data as Data;
		data.deliveryDate ??= isoDate(new Date());
		data.status_code = "DRAFT";
		if (data.customer_ID) {
			Object.assign(data, await deliveryAddress(data.customer_ID as string));
		}
	});
	// Picking a customer proposes its delivery address
	srv.before("UPDATE", NoteDrafts, async (req) => {
		if (req.data.customer_ID) {
			Object.assign(req.data, await deliveryAddress(req.data.customer_ID));
		}
	});
	srv.before(["NEW", "UPDATE"], ItemDrafts, async (req) => {
		if (req.data.productService_ID) {
			await prefillFromProduct(req.data as Data);
		}
	});

	srv.before(["CREATE", "UPDATE"], Notes, async (req) => {
		const data = req.data as Data;
		for (const field of backendFields) {
			Reflect.deleteProperty(data, field);
		}
		if (req.event === "UPDATE") {
			const note = await loadNote(boundID(req));
			if (note && note.status_code !== "DRAFT") {
				return req.reject(409, "DELIVERY_NOTE_LOCKED");
			}
			Reflect.deleteProperty(data, "quote_ID");
		}
		const items = data.items as (Data & { position?: null | number })[] | undefined;
		if (req.event === "CREATE" && !items?.length) {
			return req.reject(400, "DELIVERY_NOTE_WITHOUT_ITEMS");
		}
		sortByPosition(items ?? []).forEach((item, index) => {
			item.position = index + 1;
			item.returnedQuantity = 0;
		});
		if (req.event === "CREATE") {
			data.status_code = "DRAFT";
			data.deliveryNoteNumber = await nextDeliveryNoteNumber(String(data.deliveryDate));
			if (!data.deliveryStreet && !data.deliveryCity && data.customer_ID) {
				Object.assign(data, await deliveryAddress(data.customer_ID as string));
			}
		}
	});
	srv.before(["EDIT", "DELETE"], Notes, async (req) => {
		const note = await loadNote(boundID(req));
		if (note && note.status_code !== "DRAFT") {
			return req.reject(409, "DELIVERY_NOTE_LOCKED");
		}
	});
	srv.before(["CREATE", "UPDATE", "DELETE"], Items, (req) => req.reject(405, "DELIVERY_NOTE_ITEMS_ONLY_IN_DRAFT"));

	srv.on("confirm", Notes, (req) => guarded(req, () => confirm(req)));
	srv.on("createInvoice", Notes, (req) => guarded(req, () => createInvoice(srv, req)));
	srv.on("returnGoods", Items, (req) => guarded(req, () => returnGoods(req)));
	srv.on("createDeliveryNote", "SalesService.Quotes", (req) => guarded(req, () => createFromQuote(srv, req)));
}

/** Confirms the delivery and books the stock-tracked goods out of stock, once. */
async function confirm(req: Request) {
	const note = await requireNote(boundID(req));
	if (note.status_code === "CONFIRMED") {
		return reload(note.ID);
	}
	const items = await itemsWithProducts(note.ID);
	if (!items.length) {
		throw new DomainError("DELIVERY_NOTE_WITHOUT_ITEMS", 400);
	}
	const changed = await UPDATE("swiver.DeliveryNotes")
		.set({ confirmedAt: new Date().toISOString(), confirmedBy: req.user.id, status_code: "CONFIRMED" })
		.where({ ID: note.ID, status_code: "DRAFT" });
	if (changed) {
		await bookMovements(
			items.filter(isStockTracked).map((item) => ({
				deliveryNote_ID: note.ID,
				deliveryNoteItem_ID: item.ID,
				movementDate: note.deliveryDate,
				product_ID: item.productService_ID as string,
				quantity: quantity(-units(item.quantity)),
				type: "DELIVERY" as const,
			})),
		);
	}
	return reload(note.ID);
}

/** A draft delivery note with the goods of the quote. */
async function createFromQuote(srv: cds.ApplicationService, req: Request) {
	const quote = (await SELECT.one
		.from("SalesService.Quotes")
		.columns("ID", "customer_ID", "status_code", "HasDraftEntity")
		.where({ ID: boundID(req), organization_ID: requireOrganization(req) })) as null | {
		customer_ID: string;
		HasDraftEntity: boolean;
		ID: string;
		status_code: string;
	};
	if (!quote) {
		throw new DomainError("QUOTE_NOT_FOUND", 404);
	}
	if (quote.HasDraftEntity) {
		throw new DomainError("QUOTE_BEING_EDITED");
	}
	if (quote.status_code === "REJECTED") {
		throw new DomainError("QUOTE_REJECTED");
	}
	const items = await SELECT.from("swiver.QuoteItems")
		.columns("position", "description", "quantity", "unit", "productService_ID")
		.where({ "productService.type_code": "GOODS", quote_ID: quote.ID })
		.orderBy("position");
	if (!items.length) {
		throw new DomainError("QUOTE_WITHOUT_GOODS");
	}
	const ID = cds.utils.uuid();
	await srv.send("NEW", NoteDrafts, {
		customer_ID: quote.customer_ID,
		ID,
		items: items.map((item: Data) => ({ ...item, ID: cds.utils.uuid() })),
	});
	await UPDATE(NoteDrafts).set({ quote_ID: quote.ID }).where({ ID });
	return SELECT.one.from(NoteDrafts).where({ ID });
}

/**
 * The draft invoice of a confirmed delivery: converted from the quote (with its prices and any
 * services), or from the delivered items at the products' prices. The delivery date is printed as
 * Lieferdatum.
 */
async function createInvoice(srv: cds.ApplicationService, req: Request) {
	const note = await requireNote(boundID(req));
	if (note.status_code !== "CONFIRMED") {
		throw new DomainError("DELIVERY_NOTE_NOT_CONFIRMED");
	}
	if (note.salesInvoice_ID && (await invoiceExists(note.salesInvoice_ID))) {
		throw new DomainError("DELIVERY_NOTE_ALREADY_INVOICED");
	}
	let invoiceID: string;
	if (note.quote_ID) {
		invoiceID = ((await convertQuote(srv, note.quote_ID)) as { ID: string }).ID;
	} else {
		const { defaultTaxRate } = await getCompanySettings();
		const items = await SELECT.from("swiver.DeliveryNoteItems")
			.columns(
				"position",
				"description",
				"quantity",
				"unit",
				"productService_ID",
				"productService.defaultPrice as unitPrice",
				"productService.defaultTaxRate as taxRate",
			)
			.where({ deliveryNote_ID: note.ID })
			.orderBy("position");
		invoiceID = cds.utils.uuid();
		await srv.send("NEW", invoiceDocument.documentDrafts, {
			customer_ID: note.customer_ID,
			ID: invoiceID,
			items: items.map((item: Data) => ({
				...item,
				ID: cds.utils.uuid(),
				taxRate: item.taxRate ?? defaultTaxRate,
				unitPrice: item.unitPrice ?? 0,
			})),
		});
		await recalculateDraft(invoiceDocument, invoiceID);
	}
	await UPDATE(invoiceDocument.documentDrafts)
		.set({ servicePeriodEnd: null, servicePeriodStart: note.deliveryDate })
		.where({ ID: invoiceID });
	await UPDATE("swiver.DeliveryNotes").set({ salesInvoice_ID: invoiceID }).where({ ID: note.ID });
	return SELECT.one.from(invoiceDocument.documentDrafts).where({ ID: invoiceID });
}

/** The customer's delivery address, or its billing address if it has none. */
async function deliveryAddress(customerID: string): Promise<Data> {
	const customer = await SELECT.one
		.from("swiver.Customers")
		.where({ ID: customerID, organization_ID: requireOrganization() });
	if (!customer) {
		return {};
	}
	if (customer.deliveryStreet || customer.deliveryCity) {
		return {
			deliveryCity: customer.deliveryCity,
			deliveryCountry_code: customer.deliveryCountry_code ?? customer.country_code,
			deliveryName: customer.deliveryName ?? customer.companyName ?? customer.name,
			deliveryPostalCode: customer.deliveryPostalCode,
			deliveryStreet: customer.deliveryStreet,
		};
	}
	return {
		deliveryCity: customer.city,
		deliveryCountry_code: customer.country_code,
		deliveryName: customer.companyName ?? customer.name,
		deliveryPostalCode: customer.postalCode,
		deliveryStreet: customer.street,
	};
}

async function invoiceExists(invoiceID: string): Promise<boolean> {
	return Boolean(
		(await SELECT.one.from(invoiceDocument.documentDrafts).columns("ID").where({ ID: invoiceID })) ||
		(await SELECT.one.from("swiver.SalesInvoices").columns("ID").where({ ID: invoiceID })),
	);
}

async function itemsWithProducts(noteID: string) {
	return SELECT.from("swiver.DeliveryNoteItems")
		.columns(
			"ID",
			"quantity",
			"returnedQuantity",
			"productService_ID",
			"productService.type_code as type_code",
			"productService.trackStock as trackStock",
		)
		.where({ deliveryNote_ID: noteID }) as unknown as Promise<
		{
			ID: string;
			productService_ID: null | string;
			quantity: string;
			returnedQuantity: null | string;
			trackStock: boolean | null;
			type_code: null | string;
		}[]
	>;
}

async function loadNote(noteID: string) {
	return SELECT.one
		.from(Notes)
		.columns(
			"ID",
			"status_code",
			"customer_ID",
			"deliveryDate",
			"quote_ID",
			"salesInvoice_ID",
			"HasDraftEntity",
		)
		.where({ ID: noteID, organization_ID: requireOrganization() }) as unknown as Promise<Note | null>;
}

/** Picking a product fills the description and unit of the line; the user can still change them. */
async function prefillFromProduct(data: Data) {
	const product = await SELECT.one
		.from("swiver.ProductServices")
		.columns("name", "description", "unit")
		.where({ ID: data.productService_ID, organization_ID: requireOrganization() });
	if (product) {
		data.description = product.description ? `${product.name}\n${product.description}` : product.name;
		data.unit = product.unit;
	}
}

async function reload(noteID: string) {
	return SELECT.one.from(Notes).where({ ID: noteID });
}

/**
 * The delivery note of the current organization, locked until the transaction ends, so parallel
 * requests for it (e.g. a double confirm) run one after the other.
 */
async function requireNote(noteID: string): Promise<Note> {
	await SELECT.one.from("swiver.DeliveryNotes").columns("ID").where({ ID: noteID }).forUpdate();
	const note = await loadNote(noteID);
	if (!note) {
		throw new DomainError("DELIVERY_NOTE_NOT_FOUND", 404);
	}
	if (note.HasDraftEntity) {
		throw new DomainError("DELIVERY_NOTE_BEING_EDITED");
	}
	return note;
}

/** Books goods the customer sent back into stock; at most what was delivered on this line. */
async function returnGoods(req: Request) {
	const line = (await SELECT.one
		.from("swiver.DeliveryNoteItems")
		.columns("deliveryNote_ID")
		.where({ ID: boundID(req) })) as null | { deliveryNote_ID: string };
	if (!line) {
		throw new DomainError("RECORD_NOT_FOUND", 404);
	}
	const note = await requireNote(line.deliveryNote_ID);
	if (note.status_code !== "CONFIRMED") {
		throw new DomainError("DELIVERY_NOTE_NOT_CONFIRMED");
	}
	const item = (await itemsWithProducts(note.ID)).find((entry) => entry.ID === boundID(req));
	if (!item || !isStockTracked(item)) {
		throw new DomainError("PRODUCT_NOT_STOCK_TRACKED", 400);
	}
	const returned = positiveQuantity(req.data.quantity);
	const open = units(item.quantity) - units(item.returnedQuantity);
	if (returned > open) {
		throw new DomainError("RETURN_EXCEEDS_DELIVERED", 409, [quantity(open)]);
	}
	await UPDATE("swiver.DeliveryNoteItems")
		.set({ returnedQuantity: quantity(units(item.returnedQuantity) + returned) })
		.where({ ID: item.ID });
	await bookMovements([
		{
			deliveryNote_ID: note.ID,
			deliveryNoteItem_ID: item.ID,
			product_ID: item.productService_ID as string,
			quantity: quantity(returned),
			reason: typeof req.data.reason === "string" ? req.data.reason.trim() || null : null,
			type: "CUSTOMER_RETURN",
		},
	]);
	return SELECT.one.from(Items).where({ ID: item.ID });
}
