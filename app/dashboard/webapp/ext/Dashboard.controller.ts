import PageController from "sap/fe/core/PageController";
import MessageBox from "sap/m/MessageBox";
import Event from "sap/ui/base/Event";
import NumberFormat from "sap/ui/core/format/NumberFormat";
import Context from "sap/ui/model/Context";
import JSONModel from "sap/ui/model/json/JSONModel";
import ODataModel from "sap/ui/model/odata/v4/ODataModel";
import ResourceModel from "sap/ui/model/resource/ResourceModel";

/**
 * The start page: onboarding for users without organization, otherwise key figures, what needs
 * attention, and the entry points into the other apps. Figures come from the backend; the
 * controller only navigates.
 */
interface ShellServices {
	toExternal(args: { target: { shellHash: string } }): void;
}

const attentionTargets: Record<string, string> = {
	BankTransaction: "Finance-manage&/BankTransactions",
	IncomingDocument: "Purchases-manage&/IncomingDocuments",
	SalesInvoice: "Sales-manage&/SalesInvoices",
	SupplierInvoice: "Purchases-manage&/SupplierInvoices",
};

/**
 * @namespace swiver.dashboard.ext
 */
export default class Dashboard extends PageController {
	public onInit(): void {
		super.onInit();
		const view = this.getView();
		view?.setModel(new JSONModel({ hasOrganization: false, loaded: false, organizationName: "" }), "view");
		view?.setModel(new JSONModel({}), "kpi");
		view?.setModel(
			new JSONModel({
				companyName: "",
				country: "DE",
				currency: "EUR",
				defaultPaymentTermDays: 14,
				defaultTaxRate: 19,
				invoicePrefix: "INV",
				vatId: "",
			}),
			"onboarding",
		);
		void this.loadOrganization();
	}

	public async onCreateOrganization(): Promise<void> {
		const input = (this.getView()?.getModel("onboarding") as JSONModel).getData() as Record<string, unknown>;
		const action = this.orgModel().bindContext("/createOrganization(...)");
		for (const [name, value] of Object.entries(input)) {
			action.setParameter(name, value);
		}
		try {
			await action.invoke();
			// The organization is resolved per request, so reload to start with fresh data everywhere.
			window.location.reload();
		} catch (error) {
			MessageBox.error((error as Error).message);
		}
	}

	public onAttention(event: Event): void {
		const context = (event.getSource() as { getBindingContext(model: string): Context }).getBindingContext("kpi");
		const target = attentionTargets[context.getProperty("target") as string];
		if (target) {
			this.navigate(target);
		}
	}

	public onNavigate(event: Event, shellHash: string): void {
		this.navigate(shellHash);
	}

	/** Creates a draft invoice and opens it in the Sales app. */
	public async onNewSalesInvoice(): Promise<void> {
		const sales = this.getAppComponent().getModel("sales") as ODataModel;
		const context = sales.bindList("/SalesInvoices").create({});
		try {
			await context.created();
			this.navigate(`Sales-manage&/SalesInvoices(ID=${context.getProperty("ID") as string},IsActiveEntity=false)`);
		} catch (error) {
			MessageBox.error((error as Error).message);
		}
	}

	public formatAmount(amount: null | number | string): string {
		return NumberFormat.getFloatInstance({ maxFractionDigits: 2, minFractionDigits: 2 }).format(Number(amount ?? 0));
	}

	public formatOverdue(amount: null | number, currency: string): string {
		return amount ? this.text("kpiOverdueHint", [this.money(amount, currency)]) : this.text("kpiNothingOverdue", []);
	}

	public formatDueSoon(amount: null | number, currency: string): string {
		return this.text("kpiDueSoonHint", [this.money(amount, currency)]);
	}

	public formatProfitHint(revenue: null | number, expenses: null | number, currency: string): string {
		return this.text("kpiProfitHint", [this.money(revenue, currency), this.money(expenses, currency)]);
	}

	private async loadOrganization(): Promise<void> {
		const binding = this.orgModel().bindContext("/myOrganization()");
		const result = (await binding.requestObject().catch(() => undefined)) as
			undefined | { name?: string; organizationID?: string };
		const model = this.getView()?.getModel("view") as JSONModel;
		model.setData({
			hasOrganization: Boolean(result?.organizationID),
			loaded: true,
			organizationName: result?.name ?? "",
		});
		if (result?.organizationID) {
			// The figures are one function result; loading it once avoids relative bindings to a function.
			const figures = await (this.getView()?.getModel() as ODataModel).bindContext("/dashboard()").requestObject();
			(this.getView()?.getModel("kpi") as JSONModel).setData(figures);
		}
	}

	private money(amount: null | number, currency: string): string {
		return NumberFormat.getCurrencyInstance().format(Number(amount ?? 0), currency);
	}

	private navigate(shellHash: string): void {
		(this.getAppComponent() as unknown as { getShellServices(): ShellServices })
			.getShellServices()
			.toExternal({ target: { shellHash } });
	}

	private orgModel(): ODataModel {
		return this.getAppComponent().getModel("org") as ODataModel;
	}

	private text(key: string, args: unknown[]): string {
		const bundle = (this.getAppComponent().getModel("i18n") as ResourceModel).getResourceBundle() as {
			getText: (key: string, args: unknown[]) => string;
		};
		return bundle.getText(key, args);
	}
}
