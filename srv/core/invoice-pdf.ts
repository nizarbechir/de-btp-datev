import PDFDocument from "pdfkit";

export interface SalesInvoicePdfData {
	company?: {
		bankName?: null | string;
		bic?: null | string;
		city?: null | string;
		companyName?: null | string;
		country_code?: null | string;
		email?: null | string;
		iban?: null | string;
		ownerName?: null | string;
		phone?: null | string;
		postalCode?: null | string;
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
		status_code?: null | string;
		subject?: null | string;
		taxes?: { netAmount?: Value; taxAmount?: Value; taxRate?: Value }[];
	};
	logo?: Buffer;
}

type Value = null | number | string | undefined;

const page = { bottom: 760, left: 56, right: 539, width: 483 };
const color = { accent: "#1f4fd1", border: "#e4e7ec", muted: "#667085", soft: "#f2f4f7", text: "#101828" };
const font = { bold: "Helvetica-Bold", regular: "Helvetica" };

/** Page footer columns: seller, contact, tax IDs, bank. */
const footerColumns = [
	{ posX: 0, width: 110 },
	{ posX: 115, width: 130 },
	{ posX: 250, width: 95 },
	{ posX: 345, width: 138 },
];

/** Item table columns: horizontal position, width and alignment. */
const columns = {
	amount: { align: "right", posX: 454, width: 85 },
	description: { align: "left", posX: 80, width: 170 },
	position: { align: "left", posX: 56, width: 20 },
	quantity: { align: "right", posX: 254, width: 40 },
	taxRate: { align: "right", posX: 414, width: 36 },
	unit: { align: "left", posX: 300, width: 42 },
	unitPrice: { align: "right", posX: 344, width: 66 },
} as const;

export function formatMoney(value: Value, currency: string): string {
	return new Intl.NumberFormat("en-US", { currency, style: "currency" }).format(Number(value ?? 0));
}

/**
 * Renders a sales invoice as an A4 PDF: seller, customer address, invoice details, items,
 * totals per tax rate, payment information and the seller's details in the page footer.
 */
export function renderSalesInvoicePdf({ company = {}, invoice, logo }: SalesInvoicePdfData): Promise<Buffer> {
	const doc = new PDFDocument({ bufferPages: true, margins: { bottom: 40, left: 56, right: 56, top: 48 }, size: "A4" });
	const chunks: Buffer[] = [];
	doc.on("data", (chunk: Buffer) => chunks.push(chunk));
	const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

	const currency = invoice.currency_code || "EUR";
	const money = (value: Value) => formatMoney(value, currency);

	drawSeller(doc, company, logo);
	drawRecipient(doc, company, invoice);
	drawDetails(doc, invoice);

	// Title, subject and introduction
	setTop(doc, 300);
	const title = invoice.invoiceNumber ? `Invoice ${invoice.invoiceNumber}` : "Invoice (draft)";
	doc.font(font.bold).fontSize(20).fillColor(color.text).text(title, page.left, doc.y);
	drawStatusBadge(doc, invoice);
	if (invoice.subject) {
		doc.moveDown(0.3).font(font.regular).fontSize(11).fillColor(color.muted).text(invoice.subject, page.left, doc.y, {
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

	drawItems(doc, invoice, money);
	drawTotals(doc, invoice, money);
	drawPayment(doc, company, invoice, money);

	if (invoice.footerText) {
		ensureSpace(doc, 40);
		doc.moveDown(1).font(font.regular).fontSize(10).fillColor(color.text).text(invoice.footerText, page.left, doc.y, {
			width: page.width,
		});
	}

	drawPageFooters(doc, company);
	doc.end();
	return done;
}

function drawDetails(doc: PDFKit.PDFDocument, invoice: SalesInvoicePdfData["invoice"]) {
	const rows: [string, string][] = [
		["Invoice number", invoice.invoiceNumber || "Assigned when saved"],
		["Invoice date", formatDate(invoice.invoiceDate)],
		["Due date", formatDate(invoice.dueDate)],
	];
	if (invoice.customer?.customerNumber) {
		rows.push(["Customer number", invoice.customer.customerNumber]);
	}
	if (invoice.customer?.vatId) {
		rows.push(["Customer VAT ID", invoice.customer.vatId]);
	}
	const posX = 340;
	let posY = 160;
	doc.roundedRect(posX - 12, posY - 10, page.right - posX + 12, rows.length * 18 + 14, 6).fill(color.soft);
	for (const [label, value] of rows) {
		doc.font(font.regular).fontSize(9).fillColor(color.muted).text(label, posX, posY, { width: 90 });
		doc
			.font(font.bold)
			.fontSize(9)
			.fillColor(color.text)
			.text(value, posX + 90, posY, { align: "right", width: page.right - posX - 102 });
		posY += 18;
	}
}

function drawItemHeader(doc: PDFKit.PDFDocument) {
	const posY = doc.y;
	doc.rect(page.left, posY, page.width, 22).fill(color.soft);
	const labels: Record<keyof typeof columns, string> = {
		amount: "Amount",
		description: "Description",
		position: "Pos.",
		quantity: "Qty",
		taxRate: "VAT",
		unit: "Unit",
		unitPrice: "Price",
	};
	doc.font(font.bold).fontSize(8.5).fillColor(color.muted);
	for (const [column, label] of Object.entries(labels) as [keyof typeof columns, string][]) {
		const { align, posX, width } = columns[column];
		doc.text(label, posX, posY + 7, { align, width });
	}
	setTop(doc, posY + 22);
}

function drawItems(doc: PDFKit.PDFDocument, invoice: SalesInvoicePdfData["invoice"], money: (value: Value) => string) {
	doc.moveDown(1.2);
	drawItemHeader(doc);
	const items = [...(invoice.items ?? [])].sort((first, second) => (first.position ?? 0) - (second.position ?? 0));
	items.forEach((item, index) => {
		const description = item.description ?? "";
		doc.font(font.regular).fontSize(9.5);
		const height = Math.max(doc.heightOfString(description, { width: columns.description.width }), 12) + 12;
		if (doc.y + height > page.bottom - 40) {
			doc.addPage();
			drawItemHeader(doc);
		}
		const posY = doc.y + 6;
		const cells: [keyof typeof columns, string][] = [
			["position", String(item.position ?? index + 1)],
			["description", description],
			["quantity", formatNumber(item.quantity, 3)],
			["unit", item.unit ?? ""],
			["unitPrice", money(item.unitPrice)],
			["taxRate", `${formatNumber(item.taxRate, 2)}%`],
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

function drawPageFooters(doc: PDFKit.PDFDocument, company: NonNullable<SalesInvoicePdfData["company"]>) {
	const blocks = [
		[company.companyName, company.ownerName, company.street, join(" ", company.postalCode, company.city)],
		[company.phone, company.email, company.website],
		[company.taxNumber && `Tax number ${company.taxNumber}`, company.vatId && `VAT ID ${company.vatId}`],
		[company.bankName, company.iban && `IBAN ${formatIban(company.iban)}`, company.bic && `BIC ${company.bic}`],
	].map((lines) => lines.filter(Boolean).join("\n"));
	const range = doc.bufferedPageRange();
	for (let index = range.start; index < range.start + range.count; index++) {
		doc.switchToPage(index);
		const posY = 782;
		doc
			.moveTo(page.left, posY - 8)
			.lineTo(page.right, posY - 8)
			.lineWidth(0.5)
			.strokeColor(color.border)
			.stroke();
		doc.font(font.regular).fontSize(7).fillColor(color.muted);
		blocks.forEach((text, column) => {
			const { posX, width } = footerColumns[column];
			doc.text(text, page.left + posX, posY, { height: 40, width });
		});
		if (range.count > 1) {
			doc.text(`Page ${index + 1} of ${range.count}`, page.left, posY - 22, { align: "right", width: page.width });
		}
	}
}

function drawPayment(
	doc: PDFKit.PDFDocument,
	company: NonNullable<SalesInvoicePdfData["company"]>,
	invoice: SalesInvoicePdfData["invoice"],
	money: (value: Value) => string,
) {
	ensureSpace(doc, 70);
	doc.font(font.bold).fontSize(10).fillColor(color.text).text("Payment", page.left, doc.y);
	doc.moveDown(0.3).font(font.regular).fontSize(10);
	if (invoice.status_code === "PAID") {
		doc.text(`Paid on ${formatDate(invoice.paymentDate)}. Thank you!`, { width: page.width });
		return;
	}
	const reference = invoice.invoiceNumber ? ` Please use ${invoice.invoiceNumber} as the payment reference.` : "";
	doc.text(`Please transfer ${money(invoice.grossAmount)} by ${formatDate(invoice.dueDate)}.${reference}`, {
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
	doc.font(font.regular).fontSize(7).fillColor(color.muted).text(sender, page.left, top, { width: 260 });

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
			.text(line, page.left, doc.y, { width: 260 });
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

function drawStatusBadge(doc: PDFKit.PDFDocument, invoice: SalesInvoicePdfData["invoice"]) {
	const badge =
		invoice.status_code === "PAID"
			? { color: "#067647", fill: "#ecfdf3", text: "PAID" }
			: invoice.status_code === "CANCELLED"
				? { color: "#b42318", fill: "#fef3f2", text: "CANCELLED" }
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

function drawTotals(doc: PDFKit.PDFDocument, invoice: SalesInvoicePdfData["invoice"], money: (value: Value) => string) {
	const taxes = invoice.taxes ?? [];
	ensureSpace(doc, 50 + taxes.length * 16);
	const posX = 330;
	const width = page.right - posX;
	let posY = doc.y + 14;
	const row = (label: string, value: string) => {
		doc
			.font(font.regular)
			.fontSize(10)
			.fillColor(color.muted)
			.text(label, posX, posY, { width: width / 2 });
		doc.fillColor(color.text).text(value, posX + width / 2, posY, { align: "right", width: width / 2 });
		posY += 16;
	};
	row("Net amount", money(invoice.netAmount));
	for (const tax of [...taxes].sort((first, second) => Number(second.taxRate) - Number(first.taxRate))) {
		row(`VAT ${formatNumber(tax.taxRate, 2)}% on ${money(tax.netAmount)}`, money(tax.taxAmount));
	}
	posY += 4;
	doc.roundedRect(posX - 10, posY, width + 10, 30, 6).fill(color.accent);
	doc
		.font(font.bold)
		.fontSize(12)
		.fillColor("#ffffff")
		.text("Total", posX, posY + 9, { width: width / 2 });
	doc
		.fontSize(13)
		.text(money(invoice.grossAmount), posX + width / 2 - 10, posY + 8, { align: "right", width: width / 2 });
	doc.fillColor(color.text);
	setTop(doc, posY + 44);
	setLeft(doc, page.left);
}

function ensureSpace(doc: PDFKit.PDFDocument, height: number) {
	if (doc.y + height > page.bottom) {
		doc.addPage();
	}
}

function formatDate(value: null | string | undefined): string {
	if (!value) {
		return "";
	}
	return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC", year: "numeric" }).format(
		new Date(value),
	);
}

function formatIban(iban: string): string {
	return iban
		.replace(/\s+/g, "")
		.replace(/(.{4})/g, "$1 ")
		.trim();
}

function formatNumber(value: Value, maximumFractionDigits: number): string {
	return new Intl.NumberFormat("en-US", { maximumFractionDigits }).format(Number(value ?? 0));
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
