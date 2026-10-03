import { formatMoney, renderSalesInvoicePdf } from "../core/invoice-pdf";
import { EInvoiceContext } from "../integrations/einvoice/einvoice-types";
import { generate } from "../integrations/einvoice/zugferd";
import { DocumentData } from "./sales-documents";

/**
 * Maps a sales invoice to the e-invoice data and renders it as ZUGFeRD PDF (PDF/A-3 + XML),
 * reusing the normal invoice layout.
 */
const unitCodes: Record<string, string> = {
	day: "DAY",
	// eslint-disable-next-line @typescript-eslint/naming-convention -- unit names as entered by users
	"flat rate": "LS",
	hour: "HUR",
	kg: "KGM",
	km: "KMT",
	license: "C62",
	month: "MON",
	piece: "C62",
};

export async function renderZugferdPdf(document: DocumentData, replacedInvoiceNumber?: null | string) {
	const { pdfOptions, xml } = generate(toEInvoice(document, replacedInvoiceNumber));
	return { pdf: await renderSalesInvoicePdf(document, pdfOptions), xml };
}

export function toEInvoice(document: DocumentData, replacedInvoiceNumber?: null | string): EInvoiceContext {
	const company = document.company ?? {};
	const invoice = document.invoice;
	const customer = invoice.customer ?? {};
	const decimal = (value: unknown, digits = 2) => Number(value ?? 0).toFixed(digits);
	const currency = invoice.currency_code || "EUR";
	return {
		buyer: {
			city: customer.city,
			countryCode: customer.country_code || "DE",
			name: customer.companyName || customer.name || "",
			postalCode: customer.postalCode,
			street: customer.street,
			vatId: customer.vatId,
		},
		currency,
		dueDate: invoice.dueDate,
		grossAmount: decimal(invoice.grossAmount),
		invoiceDate: invoice.invoiceDate ?? "",
		invoiceNumber: invoice.invoiceNumber ?? "",
		lines: (invoice.items ?? []).map((item) => ({
			description: item.description ?? "",
			netAmount: decimal(item.netAmount),
			quantity: decimal(item.quantity, 3),
			unitCode: unitCodes[(item.unit ?? "").toLowerCase()] ?? "C62",
			unitPrice: decimal(item.unitPrice),
			vatRate: decimal(item.taxRate),
		})),
		netAmount: decimal(invoice.netAmount),
		note: invoice.subject,
		payment: {
			bic: company.bic,
			iban: company.iban,
			reference: invoice.invoiceNumber,
			terms: invoice.dueDate ? `Please pay ${formatMoney(invoice.grossAmount, currency)} by ${invoice.dueDate}.` : null,
		},
		precedingInvoiceNumber: replacedInvoiceNumber,
		seller: {
			city: company.city,
			countryCode: company.country_code || "DE",
			email: company.email,
			name: company.companyName ?? "",
			postalCode: company.postalCode,
			street: company.street,
			taxNumber: company.taxNumber,
			vatId: company.vatId,
		},
		servicePeriod: { end: invoice.servicePeriodEnd, start: invoice.servicePeriodStart },
		taxAmount: decimal(invoice.taxAmount),
		taxes: (invoice.taxes ?? []).map((tax) => ({
			netAmount: decimal(tax.netAmount),
			taxAmount: decimal(tax.taxAmount),
			vatRate: decimal(tax.taxRate),
		})),
	};
}
