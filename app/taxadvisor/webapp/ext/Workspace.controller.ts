import PageController from "sap/fe/core/PageController";
import MessageBox from "sap/m/MessageBox";
import Event from "sap/ui/base/Event";
import JSONModel from "sap/ui/model/json/JSONModel";
import Context from "sap/ui/model/odata/v4/Context";
import ODataModel from "sap/ui/model/odata/v4/ODataModel";

/**
 * The tax advisor's workspace: VAT and accountant export of a period, what needs attention, and
 * filterable lists of all financial records. Figures come from the backend; the controller only
 * loads them and navigates to the records in the Sales, Purchases and Finance apps.
 * @namespace swiver.taxadvisor.ext
 */
interface FilterBar {
	setFilterValues(property: string, values: unknown[]): Promise<void>;
	triggerSearch(): Promise<unknown>;
}

interface ShellServices {
	toExternal(args: { target: { shellHash: string } }): void;
}

/** Where a record opens, by the ID properties of a row. */
const recordTargets: [property: string, hash: (id: string) => string][] = [
	["salesInvoice_ID", (id) => `Sales-manage&/SalesInvoices(ID=${id},IsActiveEntity=true)`],
	["supplierInvoice_ID", (id) => `Purchases-manage&/SupplierInvoices(ID=${id},IsActiveEntity=true)`],
	["linkedSupplierInvoice_ID", (id) => `Purchases-manage&/SupplierInvoices(ID=${id},IsActiveEntity=true)`],
	["incomingDocument_ID", (id) => `Purchases-manage&/IncomingDocuments(ID=${id},IsActiveEntity=true)`],
	["bankTransaction_ID", (id) => `Finance-manage&/BankTransactions(${id})`],
];

/** Rows that are records themselves open directly. */
const entityTargets: Record<string, (id: string) => string> = {
	BankTransactions: (id) => `Finance-manage&/BankTransactions(${id})`,
	Receipts: (id) => `Purchases-manage&/IncomingDocuments(ID=${id},IsActiveEntity=true)`,
	SalesInvoices: (id) => `Sales-manage&/SalesInvoices(ID=${id},IsActiveEntity=true)`,
	SupplierInvoices: (id) => `Purchases-manage&/SupplierInvoices(ID=${id},IsActiveEntity=true)`,
};

const tabs = ["questions", "supplierInvoices", "salesInvoices", "receipts", "bankTransactions", "payments"];

const attentionCounts: Record<string, string> = {
	missingDocuments: "SupplierInvoices/$count?$filter=missingDocument eq true",
	openQuestions: "Questions/$count?$filter=resolved eq false",
	uncategorized: "SupplierInvoices/$count?$filter=uncategorized eq true",
	unmatchedTransactions: "BankTransactions/$count?$filter=matchStatus_code eq 'UNMATCHED'",
	unprocessedReceipts: "Receipts/$count?$filter=processingStatus_code eq 'NEW' or processingStatus_code eq 'ERROR'",
};

export default class Workspace extends PageController {
	public onInit(): void {
		super.onInit();
		const today = new Date();
		const view = this.getView();
		view?.setModel(new JSONModel({ from: new Date(today.getFullYear(), today.getMonth(), 1), to: today }), "period");
		view?.setModel(new JSONModel({}), "vat");
		view?.setModel(new JSONModel({}), "counts");
		view?.setModel(new JSONModel({ tab: "questions" }), "view");
		void this.loadVat();
		void this.loadCounts();
	}

	/** The lists load right away, with the default filters (e.g. open questions). */
	public onAfterRendering(): void {
		for (const tab of tabs) {
			void (this.byId(`${tab}Filter`) as FilterBar | undefined)?.triggerSearch();
		}
	}

	public onPeriodChange(): void {
		void this.loadVat();
	}

	/** Opens the list of an attention item, filtered to the records that need attention. */
	public async onAttention(_event: Event, tab: string, property?: string, value?: boolean | string): Promise<void> {
		(this.getView()?.getModel("view") as JSONModel).setProperty("/tab", tab);
		const filterBar = this.byId(`${tab}Filter`) as FilterBar | undefined;
		if (filterBar && property) {
			await filterBar.setFilterValues(property, [value]);
			await filterBar.triggerSearch();
		}
	}

	public onRowPress(event: Event): void {
		const context = event.getParameter("bindingContext" as never) as Context | undefined;
		const row = context?.getObject() as Record<string, string> | undefined;
		if (!context || !row) {
			return;
		}
		const entitySet = context.getPath().split("(")[0].replace("/", "");
		const target = recordTargets.find(([property]) => row[property]);
		const hash = target ? target[1](row[target[0]]) : entityTargets[entitySet]?.(row.ID);
		if (hash) {
			(this.getAppComponent() as unknown as { getShellServices(): ShellServices })
				.getShellServices()
				.toExternal({ target: { shellHash: hash } });
		}
	}

	public async onExport(): Promise<void> {
		const { fromDate, toDate } = this.period();
		const response = await window.fetch(
			`${this.model().getServiceUrl()}accountantExport(fromDate=${fromDate},toDate=${toDate})`,
		);
		if (!response.ok) {
			const error = (await response.json().catch(() => undefined)) as undefined | { error?: { message?: string } };
			MessageBox.error(error?.error?.message ?? response.statusText);
			return;
		}
		const link = document.createElement("a");
		link.href = window.URL.createObjectURL(await response.blob());
		link.download = `accountant-export_${fromDate}_${toDate}.zip`;
		document.body.appendChild(link);
		link.click();
		window.URL.revokeObjectURL(link.href);
		link.remove();
	}

	private async loadCounts(): Promise<void> {
		const counts = this.getView()?.getModel("counts") as JSONModel;
		await Promise.all(
			Object.entries(attentionCounts).map(async ([name, path]) => {
				const response = await window.fetch(`${this.model().getServiceUrl()}${path}`);
				counts.setProperty(`/${name}`, response.ok ? Number(await response.text()) : 0);
			}),
		);
	}

	private async loadVat(): Promise<void> {
		const { fromDate, toDate } = this.period();
		const binding = this.model().bindContext(`/vatOverview(fromDate=${fromDate},toDate=${toDate})`);
		try {
			(this.getView()?.getModel("vat") as JSONModel).setData(await binding.requestObject());
		} catch (error) {
			MessageBox.error((error as Error).message);
		}
	}

	private model(): ODataModel {
		return this.getAppComponent().getModel() as ODataModel;
	}

	private period(): { fromDate: string; toDate: string } {
		const { from, to } = (this.getView()?.getModel("period") as JSONModel).getData() as { from: Date; to: Date };
		const iso = (date: Date) =>
			`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
		return { fromDate: iso(from ?? new Date()), toDate: iso(to ?? from ?? new Date()) };
	}
}
