import cds, { Request } from "@sap/cds";

import { CompanySettings, SalesInvoices, SupplierInvoices } from "#cds-models/FinanceService";

import { addDays, firstDayOfMonth, isoDate } from "../core/dates";
import { registerSales } from "./sales";

const paid = "PAID";
const open = "OPEN";
const sent = "SENT";
const defaultCurrency = "EUR";
const documentMediaTypes = ["application/pdf", "image/png", "image/jpeg"];
const logoMediaTypes = ["image/png", "image/jpeg"];

interface Payment {
	paymentDate: null | string;
	paymentStatus_code: string;
}

export default class FinanceService extends cds.ApplicationService {
	async init() {
		this.on("markInvoicePaid", SupplierInvoices, (req) =>
			this.setPayment(req, { paymentDate: isoDate(new Date()), paymentStatus_code: paid }),
		);
		this.on("markInvoiceOpen", SupplierInvoices, (req) =>
			this.setPayment(req, { paymentDate: null, paymentStatus_code: open }),
		);
		this.on("dashboard", () => this.dashboard());
		this.before("UPDATE", [SupplierInvoices, SupplierInvoices.drafts], (req) =>
			this.checkMediaType(req, "documentMediaType", "documentContent", documentMediaTypes),
		);
		this.before("UPDATE", [CompanySettings, CompanySettings.drafts], (req) =>
			this.checkMediaType(req, "logoMediaType", "logo", logoMediaTypes),
		);
		registerSales(this);

		return super.init();
	}

	private checkMediaType(req: Request, mediaTypeField: string, contentField: string, allowed: string[]) {
		const mediaType = req.data[mediaTypeField];
		if (mediaType && !allowed.includes(mediaType)) {
			req.reject(415, "UNSUPPORTED_DOCUMENT_TYPE", contentField, [mediaType]);
		}
	}

	private async setPayment(req: Request, payment: Payment) {
		const updated = await UPDATE(req.subject).with(payment);
		if (!updated) {
			return req.reject(404, "INVOICE_NOT_FOUND");
		}
		return SELECT.one.from(req.subject);
	}

	private async dashboard() {
		const now = new Date();
		const today = isoDate(now);
		const monthStart = isoDate(firstDayOfMonth(now));
		const unpaid = ["paymentStatus_code !=", paid];
		const supplierKpi = (...where: string[]) => this.kpi(SupplierInvoices, "netAmount + taxAmount", where);
		const salesKpi = (...where: string[]) => this.kpi(SalesInvoices, "grossAmount", where);

		return {
			currency: defaultCurrency,
			payables: {
				dueNext7Days: await supplierKpi(...unpaid, "and dueDate between", today, "and", isoDate(addDays(now, 7))),
				open: await supplierKpi(...unpaid),
				overdue: await supplierKpi(...unpaid, "and dueDate <", today),
				paidThisMonth: await supplierKpi("paymentStatus_code =", paid, "and paymentDate >=", monthStart),
			},
			receivables: {
				outstanding: await salesKpi("status_code =", sent),
				overdue: await salesKpi("status_code =", sent, "and dueDate <", today),
				paidThisMonth: await salesKpi("status_code =", paid, "and paymentDate >=", monthStart),
			},
		};
	}

	/** Number and total of the invoices matching the given condition, written as CQL fragments and values. */
	private async kpi(entity: typeof SalesInvoices | typeof SupplierInvoices, amount: string, where: string[]) {
		const result = (await SELECT.one
			.from(entity)
			.columns("count(1) as count", `sum(${amount}) as amount`)
			.where(...where)) as null | { amount: null | number | string; count: number };
		return { amount: Math.round(Number(result?.amount ?? 0) * 100) / 100, count: Number(result?.count ?? 0) };
	}
}
