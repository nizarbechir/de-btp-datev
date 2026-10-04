import ResourceBundle from "sap/base/i18n/ResourceBundle";
import PageController from "sap/fe/core/PageController";
import Event from "sap/ui/base/Event";
import JSONModel from "sap/ui/model/json/JSONModel";
import Context from "sap/ui/model/odata/v4/Context";
import ODataModel from "sap/ui/model/odata/v4/ODataModel";
import ResourceModel from "sap/ui/model/resource/ResourceModel";

/**
 * The client cockpit: all clients with what needs work, and the open items across them. Opening a
 * row makes its client the one the user works in and shows the client (or the record) in the hub,
 * or in the launchpad when the app runs there.
 * @namespace swiver.clients.ext
 */
interface ShellServices {
	toExternal(args: { target: { shellHash: string } }): void;
}

/** Where a row opens: an app of the hub and its route; no target opens the client's start page. */
const recordTargets: [property: string, app: string, route: (id: string) => string][] = [
	["salesInvoice_ID", "sales", (id) => `SalesInvoices(ID=${id},IsActiveEntity=true)`],
	["supplierInvoice_ID", "purchases", (id) => `SupplierInvoices(ID=${id},IsActiveEntity=true)`],
	["incomingDocument_ID", "purchases", (id) => `IncomingDocuments(ID=${id},IsActiveEntity=true)`],
	["bankTransaction_ID", "finance", (id) => `BankTransactions(${id})`],
];

const entityTargets: Record<string, [app: string, route: (id: string) => string]> = {
	NewReceipts: ["purchases", (id) => `IncomingDocuments(ID=${id},IsActiveEntity=true)`],
	SupplierInvoicesToReview: ["purchases", (id) => `SupplierInvoices(ID=${id},IsActiveEntity=true)`],
	UnmatchedTransactions: ["finance", (id) => `BankTransactions(${id})`],
};

/** The launchpad intents of the hub apps. */
const intents: Record<string, string> = {
	dashboard: "Dashboard-display",
	finance: "Finance-manage",
	purchases: "Purchases-manage",
	sales: "Sales-manage",
	taxadvisor: "TaxAdvisor-display",
};

export default class Cockpit extends PageController {
	public onInit(): void {
		super.onInit();
		this.getView()?.setModel(new JSONModel({}), "firm");
		void this.loadFirm();
	}

	/** The lists load right away. */
	public onAfterRendering(): void {
		for (const tab of ["clients", "questions", "invoices", "receipts", "transactions"]) {
			void (this.byId(`${tab}Filter`) as undefined | { triggerSearch(): Promise<unknown> })?.triggerSearch();
		}
	}

	public async onRowPress(event: Event): Promise<void> {
		const context = event.getParameter("bindingContext" as never) as Context | undefined;
		const row = context?.getObject() as Record<string, string> | undefined;
		if (!context || !row) {
			return;
		}
		const entitySet = context.getPath().split("(")[0].replace("/", "");
		const clientId = entitySet === "Clients" ? row.ID : row.organization_ID;
		await this.model().bindContext(`/Clients(${clientId})/ClientService.open(...)`).invoke();
		const record = recordTargets.find(([property]) => row[property]);
		const entity = entityTargets[entitySet];
		const target: [string, string] | undefined = record
			? [record[1], record[2](row[record[0]])]
			: entity && [entity[0], entity[1](row.ID)];
		this.openInHub(target);
	}

	public onTaxFirm(): void {
		const ID = (this.getView()?.getModel("firm") as JSONModel).getProperty("/ID") as string;
		void this.getExtensionAPI()
			.getRouting()
			.navigateToRoute("TaxFirmsObjectPage", { key: `ID=${ID},IsActiveEntity=true` });
	}

	public async onCreateTaxFirm(): Promise<void> {
		await this.getExtensionAPI()
			.getEditFlow()
			.invokeAction("ClientService.EntityContainer/createTaxFirm", {
				label: this.text("createTaxFirm"),
				model: this.model(),
			});
		await this.loadFirm();
		if ((this.getView()?.getModel("firm") as JSONModel).getProperty("/ID")) {
			this.onTaxFirm();
		}
	}

	/**
	 * In the hub (the app runs in its frame), the hub switches to the client and opens the target;
	 * in the launchpad, the target app opens directly.
	 */
	private openInHub(target?: [app: string, route: string]): void {
		if (window.parent !== window) {
			const key = target ? `swiver.${target[0]}#${target[1]}` : undefined;
			window.parent.postMessage({ key, type: "swiver.clientOpened" }, window.location.origin);
			return;
		}
		const shellHash = target ? `${intents[target[0]]}&/${target[1]}` : intents.taxadvisor;
		(this.getAppComponent() as unknown as { getShellServices(): ShellServices })
			.getShellServices()
			.toExternal({ target: { shellHash } });
	}

	private async loadFirm(): Promise<void> {
		const firms = (await this.model()
			.bindList("/TaxFirms", undefined, undefined, undefined, { $select: "ID,name" })
			.requestContexts(0, 1)) as Context[];
		const firm = (firms[0]?.getObject() ?? {}) as { ID?: string; name?: string };
		(this.getView()?.getModel("firm") as JSONModel).setData({ ...firm, loaded: true });
	}

	private model(): ODataModel {
		return this.getAppComponent().getModel() as ODataModel;
	}

	private text(key: string): string {
		const bundle = (this.getAppComponent().getModel("i18n") as ResourceModel).getResourceBundle() as ResourceBundle;
		return bundle.getText(key) ?? key;
	}
}
