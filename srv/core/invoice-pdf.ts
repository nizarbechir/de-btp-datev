import PDFDocument from "pdfkit";

import { labelsFor, PdfLabels, SupplyKind } from "./invoice-pdf-labels";
import { documentFonts } from "./pdf-fonts";

/** PDF/A-3b output for e-invoices: embedded fonts, attachments and additional XMP metadata. */
export interface PdfArchiveOptions {
	attachments: PdfAttachment[];
	/** Font files to embed; every invoice PDF embeds fonts, see documentFonts. */
	fonts: { bold: string; regular: string };
	xmp?: string;
}

/** A file embedded in the PDF, e.g. the ZUGFeRD invoice XML. */
export interface PdfAttachment {
	content: Buffer;
	description?: string;
	mimeType: string;
	name: string;
	relationship: "Alternative" | "Data" | "Source" | "Supplement" | "Unspecified";
}

export interface SalesInvoicePdfData {
	company?: {
		bankName?: null | string;
		bic?: null | string;
		city?: null | string;
		companyName?: null | string;
		country_code?: null | string;
		documentLanguage_code?: null | string;
		email?: null | string;
		iban?: null | string;
		managingDirectors?: null | string;
		ownerName?: null | string;
		phone?: null | string;
		postalCode?: null | string;
		registerCourt?: null | string;
		registerNumber?: null | string;
		street?: null | string;
		taxNumber?: null | string;
		vatId?: null | string;
		website?: null | string;
	};
	invoice: {
		currency_code?: null | string;
		customer?: null | {
			city?: null | string;
			companyName?: null | string;
			country?: null | { name?: null | string };
			country_code?: null | string;
			customerNumber?: null | string;
			ID?: string;
			name?: null | string;
			postalCode?: null | string;
			street?: null | string;
			vatId?: null | string;
		};
		customer_ID?: null | string;
		dueDate?: null | string;
		footerText?: null | string;
		grossAmount?: Value;
		introductionText?: null | string;
		invoiceDate?: null | string;
		invoiceNumber?: null | string;
		items?: {
			description?: null | string;
			netAmount?: Value;
			position?: null | number;
			quantity?: Value;
			taxRate?: Value;
			unit?: null | string;
			unitPrice?: Value;
		}[];
		netAmount?: Value;
		paymentDate?: null | string;
		paymentStatus_code?: null | string;
		replacesInvoice_ID?: null | string;
		servicePeriodEnd?: null | string;
		servicePeriodStart?: null | string;
		status_code?: null | string;
		subject?: null | string;
		/** Decides between Leistungsdatum and Lieferdatum; services if not given. */
		supplyKind?: SupplyKind;
		taxAmount?: Value;
		taxes?: { netAmount?: Value; taxAmount?: Value; taxRate?: Value }[];
	};
	kind?: "invoice" | "quote";
	logo?: Buffer;
}

/** Language-specific labels and formatting of one document. */
interface Format {
	date: (value: null | string | undefined) => string;
	labels: PdfLabels;
	money: (value: Value) => string;
	number: (value: Value, maximumFractionDigits: number) => string;
}

type Value = null | number | string | undefined;

const page = { bottom: 760, left: 56, right: 539, width: 483 };
const color = { border: "#e4e7ec", muted: "#667085", soft: "#f2f4f7", text: "#101828" };
const font = { bold: "Helvetica-Bold", regular: "Helvetica" };

/** Page footer columns: seller, contact, tax IDs, bank. */
const footerColumns = [
	{ posX: 0, width: 108 },
	{ posX: 112, width: 106 },
	{ posX: 222, width: 126 },
	{ posX: 352, width: 131 },
];

/** Item table columns: horizontal position, width and alignment. */
const columns = {
	amount: { align: "right", posX: 454, width: 85 },
	description: { align: "left", posX: 86, width: 156 },
	position: { align: "left", posX: 56, width: 26 },
	quantity: { align: "right", posX: 246, width: 40 },
	taxRate: { align: "right", posX: 414, width: 36 },
	unit: { align: "left", posX: 292, width: 50 },
	unitPrice: { align: "right", posX: 344, width: 66 },
} as const;

export function formatMoney(value: Value, currency: string, locale = "en-US"): string {
	return new Intl.NumberFormat(locale, { currency, style: "currency" }).format(Number(value ?? 0));
}

/**
 * Renders a sales invoice as an A4 PDF: seller, customer address, invoice details, items,
 * totals per tax rate, payment information and the seller's details in the page footer.
 * All labels, dates and amounts use the document language of the company settings.
 */
export function renderSalesInvoicePdf(
	{ company = {}, invoice, kind = "invoice", logo }: SalesInvoicePdfData,
	archive?: PdfArchiveOptions,
): Promise<Buffer> {
	const fonts = archive?.fonts ?? documentFonts;
	const doc = new PDFDocument({
		bufferPages: true,
		font: fonts.regular,
		margins: { bottom: 40, left: 56, right: 56, top: 48 },
		size: "A4",
		...(archive && { pdfVersion: "1.7", subset: "PDF/A-3b" }),
	});
	// The layout uses the Helvetica names; they point to the embedded fonts.
	doc.registerFont(font.regular, fonts.regular);
	doc.registerFont(font.bold, fonts.bold);
	const chunks: Buffer[] = [];
	doc.on("data", (chunk: Buffer) => chunks.push(chunk));
	const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

	const format = documentFormat(company.documentLanguage_code, invoice.currency_code || "EUR");
	const { labels } = format;

	drawSeller(doc, company, logo);
	drawRecipient(doc, company, invoice);
	drawDetails(doc, invoice, kind, format);

	// Title, service description and introduction
	setTop(doc, 300);
	const label = labels.documentTitle[kind];
	const title = invoice.invoiceNumber ? `${label} ${invoice.invoiceNumber}` : `${label} (${labels.draft})`;
	doc.font(font.bold).fontSize(20).fillColor(color.text).text(title, page.left, doc.y);
	drawStatusBadge(doc, invoice, labels);
	if (invoice.subject) {
		doc.moveDown(0.3).font(font.bold).fontSize(11).fillColor(color.text).text(invoice.subject, page.left, doc.y, {
			width: page.width,
		});
	}
	if (invoice.introductionText) {
		doc
			.moveDown(0.8)
			.font(font.regular)
			.fontSize(10)
			.fillColor(color.text)
			.text(invoice.introductionText, { width: page.width });
	}

	drawItems(doc, invoice, format);
	drawTotals(doc, invoice, format);
	if (kind === "quote") {
		ensureSpace(doc, 40);
		doc.font(font.regular).fontSize(10).fillColor(color.text);
		doc.text(labels.quoteValidUntil(format.date(invoice.dueDate)), page.left, doc.y, { width: page.width });
	} else {
		drawPayment(doc, company, invoice, format);
	}

	if (invoice.footerText) {
		ensureSpace(doc, 40);
		doc.moveDown(1).font(font.regular).fontSize(10).fillColor(color.text).text(invoice.footerText, page.left, doc.y, {
			width: page.width,
		});
	}

	drawPageFooters(doc, company, labels);
	for (const attachment of archive?.attachments ?? []) {
		// pdfkit supports the PDF/A-3 relationship, its type definitions do not know it yet
		doc.file(attachment.content, {
			description: attachment.description,
			name: attachment.name,
			relationship: attachment.relationship,
			type: attachment.mimeType,
		} as PDFKit.Mixins.PDFAttachmentOptions);
	}
	if (archive?.xmp) {
		doc.appendXML(archive.xmp);
	}
	doc.end();
	return done;
}

/**
 * The service period, or the single service date (Lieferdatum for goods); without one, the invoice
 * date is the service date.
 */
export function serviceDateRow(
	invoice: SalesInvoicePdfData["invoice"],
	labels: PdfLabels,
	date: Format["date"],
): [string, string] {
	const start = invoice.servicePeriodStart;
	const end = invoice.servicePeriodEnd;
	const kind = invoice.supplyKind ?? "services";
	if (start && end && start !== end) {
		return [labels.servicePeriod[kind], `${date(start)} – ${date(end)}`];
	}
	return [labels.serviceDate[kind], date(start || end || invoice.invoiceDate)];
}

/** Labels and formatters for the document language: 03.10.2026 and 1.234,56 € in German. */
function documentFormat(languageCode: null | string | undefined, currency: string): Format {
	const labels = labelsFor(languageCode);
	const dates = new Intl.DateTimeFormat(
		labels.locale,
		labels.locale === "de-DE"
			? { day: "2-digit", month: "2-digit", timeZone: "UTC", year: "numeric" }
			: { day: "numeric", month: "short", timeZone: "UTC", year: "numeric" },
	);
	return {
		date: (value) => (value ? dates.format(new Date(value)) : ""),
		labels,
		// The standard PDF fonts have no width for the no-break space that German amounts use.
		money: (value) => formatMoney(value, currency, labels.locale).replace(/[\u00a0\u202f]/g, " "),
		number: (value, maximumFractionDigits) =>
			new Intl.NumberFormat(labels.locale, { maximumFractionDigits }).format(Number(value ?? 0)),
	};
}

function drawDetails(
	doc: PDFKit.PDFDocument,
	invoice: SalesInvoicePdfData["invoice"],
	kind: "invoice" | "quote",
	{ date, labels }: Format,
) {
	const rows: [string, string][] = [
		[labels.documentNumber[kind], invoice.invoiceNumber || labels.assignedWhenSaved],
		[labels.documentDate[kind], date(invoice.invoiceDate)],
	];
	if (kind === "invoice") {
		rows.push(serviceDateRow(invoice, labels, date));
	}
	rows.push([labels.dueDate[kind], date(invoice.dueDate)]);
	if (invoice.customer?.customerNumber) {
		rows.push([labels.customerNumber, invoice.customer.customerNumber]);
	}
	if (invoice.customer?.vatId) {
		rows.push([labels.customerVatId, invoice.customer.vatId]);
	}
	const posX = 320;
	const labelWidth = 88;
	let posY = 160;
	doc.roundedRect(posX - 12, posY - 10, page.right - posX + 12, rows.length * 18 + 14, 6).fill(color.soft);
	for (const [label, value] of rows) {
		doc.font(font.regular).fontSize(9).fillColor(color.muted).text(label, posX, posY, { width: labelWidth });
		// Long values, such as a service period, shrink instead of wrapping into the next row.
		const valueWidth = page.right - posX - labelWidth - 12;
		doc.font(font.bold).fontSize(9);
		const size = Math.max(7, (9 * valueWidth) / Math.max(doc.widthOfString(value), valueWidth));
		doc
			.fontSize(size)
			.fillColor(color.text)
			.text(value, posX + labelWidth, posY + (9 - size) / 2, { align: "right", lineBreak: false, width: valueWidth });
		posY += 18;
	}
}

function drawItemHeader(doc: PDFKit.PDFDocument, labels: PdfLabels) {
	const posY = doc.y;
	doc.rect(page.left, posY, page.width, 22).fill(color.soft);
	const headers: Record<keyof typeof columns, string> = {
		amount: labels.amount,
		description: labels.description,
		position: labels.position,
		quantity: labels.quantity,
		taxRate: labels.vat,
		unit: labels.unit,
		unitPrice: labels.unitPrice,
	};
	doc.font(font.bold).fontSize(8.5).fillColor(color.muted);
	for (const [column, label] of Object.entries(headers) as [keyof typeof columns, string][]) {
		const { align, posX, width } = columns[column];
		doc.text(label, posX, posY + 7, { align, width });
	}
	setTop(doc, posY + 22);
}

function drawItems(doc: PDFKit.PDFDocument, invoice: SalesInvoicePdfData["invoice"], format: Format) {
	const { labels, money } = format;
	doc.moveDown(1.2);
	drawItemHeader(doc, labels);
	const items = [...(invoice.items ?? [])].sort((first, second) => (first.position ?? 0) - (second.position ?? 0));
	items.forEach((item, index) => {
		const description = item.description ?? "";
		doc.font(font.regular).fontSize(9.5);
		const height = Math.max(doc.heightOfString(description, { width: columns.description.width }), 12) + 12;
		if (doc.y + height > page.bottom - 40) {
			doc.addPage();
			drawItemHeader(doc, labels);
		}
		const posY = doc.y + 6;
		const cells: [keyof typeof columns, string][] = [
			["position", String(item.position ?? index + 1)],
			["description", description],
			["quantity", format.number(item.quantity, 3)],
			["unit", labels.units[(item.unit ?? "").toLowerCase()] ?? item.unit ?? ""],
			["unitPrice", money(item.unitPrice)],
			["taxRate", `${format.number(item.taxRate, 2)} %`],
			["amount", money(item.netAmount)],
		];
		doc.fillColor(color.text);
		for (const [column, text] of cells) {
			const { align, posX, width } = columns[column];
			doc.text(text, posX, posY, { align, width });
		}
		setTop(doc, posY + height - 6);
		doc.moveTo(page.left, doc.y).lineTo(page.right, doc.y).lineWidth(0.5).strokeColor(color.border).stroke();
	});
}

function drawPageFooters(
	doc: PDFKit.PDFDocument,
	company: NonNullable<SalesInvoicePdfData["company"]>,
	labels: PdfLabels,
) {
	const blocks = [
		[company.companyName, company.ownerName, company.street, join(" ", company.postalCode, company.city)],
		[company.phone, company.email, company.website],
		[
			company.managingDirectors && `${labels.managingDirectors}: ${company.managingDirectors}`,
			join(", ", company.registerCourt, company.registerNumber),
			company.taxNumber && `${labels.taxNumber} ${company.taxNumber}`,
			company.vatId && `${labels.vatId} ${company.vatId}`,
		],
		[company.bankName, company.iban && `IBAN ${formatIban(company.iban)}`, company.bic && `BIC ${company.bic}`],
	].map((lines) => lines.filter(Boolean).join("\n"));
	const range = doc.bufferedPageRange();
	for (let index = range.start; index < range.start + range.count; index++) {
		doc.switchToPage(index);
		const posY = 778;
		doc
			.moveTo(page.left, posY - 8)
			.lineTo(page.right, posY - 8)
			.lineWidth(0.5)
			.strokeColor(color.border)
			.stroke();
		doc.font(font.regular).fontSize(6.5).fillColor(color.muted);
		blocks.forEach((text, column) => {
			const { posX, width } = footerColumns[column];
			doc.text(text, page.left + posX, posY, { height: 52, width });
		});
		if (range.count > 1) {
			doc.text(labels.page(index + 1, range.count), page.left, posY - 22, { align: "right", width: page.width });
		}
	}
}

function drawPayment(
	doc: PDFKit.PDFDocument,
	company: NonNullable<SalesInvoicePdfData["company"]>,
	invoice: SalesInvoicePdfData["invoice"],
	{ date, labels, money }: Format,
) {
	ensureSpace(doc, 70);
	doc.font(font.bold).fontSize(10).fillColor(color.text).text(labels.payment, page.left, doc.y);
	doc.moveDown(0.3).font(font.regular).fontSize(10);
	if (invoice.paymentStatus_code === "PAID") {
		doc.text(labels.paidOn(date(invoice.paymentDate)), { width: page.width });
		return;
	}
	const reference = invoice.invoiceNumber ? labels.paymentReference(invoice.invoiceNumber) : "";
	doc.text(`${labels.payBy(money(invoice.grossAmount), date(invoice.dueDate))}${reference}`, {
		width: page.width,
	});
	const bank = [
		company.bankName,
		company.iban ? `IBAN ${formatIban(company.iban)}` : undefined,
		company.bic ? `BIC ${company.bic}` : undefined,
	].filter(Boolean);
	if (bank.length) {
		doc.moveDown(0.2).fillColor(color.muted).text(bank.join("  ·  "), { width: page.width });
	}
}

function drawRecipient(
	doc: PDFKit.PDFDocument,
	company: NonNullable<SalesInvoicePdfData["company"]>,
	invoice: SalesInvoicePdfData["invoice"],
) {
	const top = 160;
	const sender = [company.companyName, company.street, join(" ", company.postalCode, company.city)]
		.filter(Boolean)
		.join(" · ");
	doc.font(font.regular).fontSize(7).fillColor(color.muted).text(sender, page.left, top, { width: 240 });

	const customer = invoice.customer ?? {};
	const foreign = customer.country_code && customer.country_code !== company.country_code;
	const lines = [
		customer.companyName,
		customer.name,
		customer.street,
		join(" ", customer.postalCode, customer.city),
		foreign ? (customer.country?.name ?? customer.country_code) : undefined,
	].filter(Boolean) as string[];
	setTop(doc, top + 16);
	lines.forEach((line, index) => {
		doc
			.font(index === 0 ? font.bold : font.regular)
			.fontSize(10.5)
			.fillColor(color.text)
			.text(line, page.left, doc.y, { width: 240 });
	});
}

function drawSeller(doc: PDFKit.PDFDocument, company: NonNullable<SalesInvoicePdfData["company"]>, logo?: Buffer) {
	if (logo) {
		try {
			doc.image(logo, page.right - 150, 40, { align: "right", fit: [150, 56] });
		} catch {
			// An unreadable logo must not prevent the invoice from being created.
		}
	}
	doc
		.font(font.bold)
		.fontSize(16)
		.fillColor(color.text)
		.text(company.companyName || "Your Company", page.left, 48, {
			width: 300,
		});
	const lines = [
		company.street,
		join(" ", company.postalCode, company.city),
		company.email,
		company.phone,
		company.website,
	];
	doc.moveDown(0.2).font(font.regular).fontSize(9).fillColor(color.muted);
	for (const line of lines.filter(Boolean)) {
		doc.text(line as string, { width: 300 });
	}
}

function drawStatusBadge(doc: PDFKit.PDFDocument, invoice: SalesInvoicePdfData["invoice"], labels: PdfLabels) {
	const badge =
		invoice.paymentStatus_code === "PAID" && invoice.status_code !== "CANCELLED"
			? { color: "#067647", fill: "#ecfdf3", text: labels.paid }
			: invoice.status_code === "CANCELLED"
				? { color: "#b42318", fill: "#fef3f2", text: labels.cancelled }
				: undefined;
	if (!badge) {
		return;
	}
	const posY = doc.y - 22;
	doc.font(font.bold).fontSize(9);
	const width = doc.widthOfString(badge.text) + 16;
	doc.roundedRect(page.right - width, posY, width, 18, 9).fill(badge.fill);
	doc.fillColor(badge.color).text(badge.text, page.right - width, posY + 5, { align: "center", width });
	doc.fillColor(color.text);
	setLeft(doc, page.left);
	setTop(doc, posY + 22);
}

/**
 * Totals on a white background: net amount, VAT per rate, a divider and the bold total.
 * Values are right-aligned in their own column, so long VAT labels never run into them.
 */
function drawTotals(
	doc: PDFKit.PDFDocument,
	invoice: SalesInvoicePdfData["invoice"],
	{ labels, money, number }: Format,
) {
	const taxes = invoice.taxes ?? [];
	ensureSpace(doc, 80 + taxes.length * 18);
	const posX = 290;
	const valueWidth = 110;
	const labelWidth = page.right - posX - valueWidth;
	let posY = doc.y + 18;
	const row = (label: string, value: string) => {
		doc.font(font.regular).fontSize(9.5).fillColor(color.muted).text(label, posX, posY, { width: labelWidth });
		doc.fillColor(color.text).text(value, posX + labelWidth, posY, { align: "right", width: valueWidth });
		posY += 18;
	};
	row(labels.netAmount, money(invoice.netAmount));
	for (const tax of [...taxes].sort((first, second) => Number(second.taxRate) - Number(first.taxRate))) {
		row(labels.vatOn(number(tax.taxRate, 2), money(tax.netAmount)), money(tax.taxAmount));
	}
	posY += 2;
	doc.moveTo(posX, posY).lineTo(page.right, posY).lineWidth(0.75).strokeColor(color.border).stroke();
	posY += 10;
	doc.font(font.bold).fontSize(11.5).fillColor(color.text).text(labels.total, posX, posY, { width: labelWidth });
	doc.text(money(invoice.grossAmount), posX + labelWidth, posY, { align: "right", width: valueWidth });
	setTop(doc, posY + 34);
	setLeft(doc, page.left);
}

function ensureSpace(doc: PDFKit.PDFDocument, height: number) {
	if (doc.y + height > page.bottom) {
		doc.addPage();
	}
}

function formatIban(iban: string): string {
	return iban
		.replace(/\s+/g, "")
		.replace(/(.{4})/g, "$1 ")
		.trim();
}

function join(separator: string, ...parts: (null | string | undefined)[]): string {
	return parts.filter(Boolean).join(separator);
}

/** Moves the text cursor to the given horizontal position. */
function setLeft(doc: PDFKit.PDFDocument, left: number) {
	// eslint-disable-next-line id-length -- pdfkit's cursor property
	doc.x = left;
}

/** Moves the text cursor to the given vertical position. */
function setTop(doc: PDFKit.PDFDocument, top: number) {
	// eslint-disable-next-line id-length -- pdfkit's cursor property
	doc.y = top;
}
