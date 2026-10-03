import cds, { Request } from "@sap/cds";

import { SupplierInvoices } from "#cds-models/FinanceService";

import { addDays, firstDayOfMonth, isoDate } from "../core/dates";

const paid = "PAID";
const open = "OPEN";
const defaultCurrency = "EUR";
const documentMediaTypes = ["application/pdf", "image/png", "image/jpeg"];

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
		this.before("UPDATE", [SupplierInvoices, SupplierInvoices.drafts], (req) => this.checkDocumentType(req));

		return super.init();
	}

	private checkDocumentType(req: Request) {
		const mediaType = req.data.documentMediaType;
		if (mediaType && !documentMediaTypes.includes(mediaType)) {
			req.reject(415, "UNSUPPORTED_DOCUMENT_TYPE", "documentContent", [mediaType]);
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
		const unpaid = ["paymentStatus_code !=", paid];

		return {
			currency: defaultCurrency,
			dueNext7Days: await this.kpi(...unpaid, "and dueDate between", today, "and", isoDate(addDays(now, 7))),
			open: await this.kpi(...unpaid),
			overdue: await this.kpi(...unpaid, "and dueDate <", today),
			paidThisMonth: await this.kpi("paymentStatus_code =", paid, "and paymentDate >=", isoDate(firstDayOfMonth(now))),
		};
	}

	/** Number and gross total of the invoices matching the given condition, written as CQL fragments and values. */
	private async kpi(...where: string[]) {
		const result = (await SELECT.one
			.from(SupplierInvoices)
			.columns("count(1) as count", "sum(netAmount + taxAmount) as amount")
			.where(...where)) as null | { amount: null | number | string; count: number };
		return { amount: Math.round(Number(result?.amount ?? 0) * 100) / 100, count: Number(result?.count ?? 0) };
	}
}
