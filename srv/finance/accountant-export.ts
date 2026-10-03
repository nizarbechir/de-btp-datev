import cds from "@sap/cds";

import { renderSalesInvoicePdf } from "../core/invoice-pdf";
import { ZugferdValidationError } from "../integrations/einvoice/zugferd";
import { toCsv } from "../integrations/export/csv";
import { createZip } from "../integrations/export/zip";
import { requireOrganization } from "../organizations/organization-context";
import { renderZugferdPdf } from "../sales/einvoice-context";
import { loadInvoiceDocument, toBuffer } from "../sales/sales-documents";
import { vatOverview } from "./vat-overview";

/**
 * ZIP for the tax adviser with the documents and lists of a period, only of the current organization:
 * /sales (invoice PDFs, ZUGFeRD where possible), /purchases (supplier documents), CSV lists and a summary.
 */
// TODO(feature): DATEV-compatible export
// TODO(feature): DATEV cloud integration
export async function accountantExport(
	fromDate: string,
	toDate: string,
): Promise<{ content: Buffer; fileName: string }> {
	const organization_ID = requireOrganization();
	const files: Record<string, Buffer | string> = {};

	const sales = (await SELECT.from("swiver.SalesInvoices")
		.columns(
			"ID",
			"invoiceNumber",
			"invoiceDate",
			"dueDate",
			"customer.displayName as customer",
			"currency_code as currency",
			"netAmount",
			"taxAmount",
			"grossAmount",
			"paidAmount",
			"status_code as status",
			"paymentStatus_code as paymentStatus",
		)
		.where({ organization_ID, status_code: { in: ["FINALIZED", "SENT", "CANCELLED"] } })
		.and("invoiceDate >=", fromDate)
		.and("invoiceDate <=", toDate)
		.orderBy("invoiceNumber")) as Record<string, unknown>[];
	for (const invoice of sales) {
		const document = await loadInvoiceDocument(invoice.ID as string);
		if (document) {
			files[`sales/${safe(invoice.invoiceNumber)}.pdf`] = await invoicePdf(document);
		}
	}

	const purchases = (await SELECT.from("swiver.SupplierInvoices")
		.columns(
			"ID",
			"invoiceNumber",
			"invoiceDate",
			"dueDate",
			"supplier.name as supplier",
			"expenseCategory.name as expenseCategory",
			"currency_code as currency",
			"netAmount",
			"taxAmount",
			"paidAmount",
			"paymentStatus_code as paymentStatus",
			"documentFileName",
		)
		.where({ organization_ID })
		.and("invoiceDate >=", fromDate)
		.and("invoiceDate <=", toDate)
		.orderBy("invoiceDate")) as Record<string, unknown>[];
	for (const invoice of purchases) {
		const row = await SELECT.one.from("swiver.SupplierInvoices").columns("documentContent").where({ ID: invoice.ID });
		const content = await toBuffer(row?.documentContent);
		if (content) {
			const extension =
				String(invoice.documentFileName ?? "")
					.split(".")
					.pop() || "pdf";
			files[`purchases/${safe(invoice.supplier)}-${safe(invoice.invoiceNumber)}.${extension}`] = content;
		}
		invoice.grossAmount = (Number(invoice.netAmount) + Number(invoice.taxAmount)).toFixed(2);
	}

	const payments = (await SELECT.from("swiver.Payments")
		.columns(
			"paymentDate",
			"direction",
			"amount",
			"currency_code as currency",
			"reference",
			"source",
			"salesInvoice.invoiceNumber as salesInvoice",
			"supplierInvoice.invoiceNumber as supplierInvoice",
		)
		.where({ organization_ID })
		.and("paymentDate >=", fromDate)
		.and("paymentDate <=", toDate)
		.orderBy("paymentDate")) as Record<string, unknown>[];
	const transactions = (await SELECT.from("swiver.BankTransactions")
		.columns(
			"bookingDate",
			"valueDate",
			"amount",
			"currency_code as currency",
			"counterpartyName",
			"counterpartyIBAN",
			"reference",
			"matchStatus_code as matchStatus",
		)
		.where({ organization_ID })
		.and("bookingDate >=", fromDate)
		.and("bookingDate <=", toDate)
		.orderBy("bookingDate")) as Record<string, unknown>[];
	const vat = await vatOverview(fromDate, toDate);

	files["sales-invoices.csv"] = toCsv(sales, [
		"invoiceNumber",
		"invoiceDate",
		"dueDate",
		"customer",
		"currency",
		"netAmount",
		"taxAmount",
		"grossAmount",
		"paidAmount",
		"status",
		"paymentStatus",
	]);
	files["supplier-invoices.csv"] = toCsv(purchases, [
		"invoiceNumber",
		"invoiceDate",
		"dueDate",
		"supplier",
		"expenseCategory",
		"currency",
		"netAmount",
		"taxAmount",
		"grossAmount",
		"paidAmount",
		"paymentStatus",
	]);
	files["payments.csv"] = toCsv(payments, [
		"paymentDate",
		"direction",
		"amount",
		"currency",
		"reference",
		"source",
		"salesInvoice",
		"supplierInvoice",
	]);
	files["bank-transactions.csv"] = toCsv(transactions, [
		"bookingDate",
		"valueDate",
		"amount",
		"currency",
		"counterpartyName",
		"counterpartyIBAN",
		"reference",
		"matchStatus",
	]);
	files["summary.csv"] = toCsv(
		[
			{ figure: "Period", value: `${fromDate} – ${toDate}` },
			{ figure: "Sales invoices", value: vat.salesInvoiceCount },
			{ figure: "Net sales", value: vat.netSales },
			{ figure: "Output VAT", value: vat.outputVat },
			{ figure: "Supplier invoices", value: vat.expenseCount },
			{ figure: "Net expenses", value: vat.netExpenses },
			{ figure: "Input VAT", value: vat.inputVat },
			{ figure: "Estimated VAT (not a tax return)", value: vat.estimatedVat },
			{ figure: "Currency", value: vat.currency },
		],
		["figure", "value"],
	);
	cds
		.log("export")
		.info(`Accountant export ${fromDate}–${toDate}: ${sales.length} sales, ${purchases.length} supplier invoices.`);
	return { content: createZip(files), fileName: `accountant-export_${fromDate}_${toDate}.zip` };
}

async function invoicePdf(document: NonNullable<Awaited<ReturnType<typeof loadInvoiceDocument>>>): Promise<Buffer> {
	if (document.invoice.status_code !== "CANCELLED") {
		try {
			return (await renderZugferdPdf(document)).pdf;
		} catch (error) {
			if (!(error instanceof ZugferdValidationError)) {
				throw error;
			}
		}
	}
	return renderSalesInvoicePdf(document);
}

function safe(value: unknown): string {
	return String(value ?? "unknown")
		.replace(/[^\w.-]+/g, "_")
		.slice(0, 80);
}
