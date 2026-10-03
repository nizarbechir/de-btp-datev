import { fromUnits, toUnits } from "../core/money";
import { getCompanySettings } from "../core/settings";
import { requireOrganization } from "../organizations/organization-context";
import { sumAmounts } from "../payments/payment-status";

/**
 * Estimated VAT of a period, taken from the invoice totals: VAT on issued sales invoices minus
 * VAT on recorded supplier invoices, by invoice date. Operational visibility only, not a tax return.
 */
// TODO(feature): complete German tax/accounting rules
// TODO(feature): ELSTER / Umsatzsteuervoranmeldung
// TODO(feature): tax adviser review workflow
export async function vatOverview(fromDate: string, toDate: string) {
	const organization_ID = requireOrganization();
	const sales = (await SELECT.from("swiver.SalesInvoices")
		.columns("netAmount", "taxAmount")
		.where({ organization_ID, status_code: { in: ["FINALIZED", "SENT"] } })
		.and("invoiceDate >=", fromDate)
		.and("invoiceDate <=", toDate)) as {
		netAmount: string;
		taxAmount: string;
	}[];
	const purchases = (await SELECT.from("swiver.SupplierInvoices")
		.columns("netAmount", "taxAmount")
		.where({ organization_ID })
		.and("invoiceDate >=", fromDate)
		.and("invoiceDate <=", toDate)) as { netAmount: string; taxAmount: string }[];
	const outputVat = sumAmounts(sales.map((invoice) => invoice.taxAmount));
	const inputVat = sumAmounts(purchases.map((invoice) => invoice.taxAmount));
	return {
		// TODO(feature): VAT per currency for organizations invoicing in several currencies
		currency: (await getCompanySettings()).defaultCurrency_code,
		estimatedVat: fromUnits(toUnits(outputVat, 2) - toUnits(inputVat, 2), 2),
		expenseCount: purchases.length,
		fromDate,
		inputVat,
		netExpenses: sumAmounts(purchases.map((invoice) => invoice.netAmount)),
		netSales: sumAmounts(sales.map((invoice) => invoice.netAmount)),
		outputVat,
		salesInvoiceCount: sales.length,
		toDate,
	};
}
