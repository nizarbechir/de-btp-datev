import PageController from "sap/fe/core/PageController";
import ResourceModel from "sap/ui/model/resource/ResourceModel";

/**
 * @namespace swiver.app.ext.dashboard
 */
export default class Dashboard extends PageController {
	public async onNewSalesInvoice(): Promise<void> {
		await this.editFlow.createDocument("/SalesInvoices", { creationMode: "NewPage" });
	}

	public onShowSalesInvoices(): void {
		this.routing.navigateToRoute("SalesInvoicesList");
	}

	public onShowCustomers(): void {
		this.routing.navigateToRoute("CustomersList");
	}

	public onShowInvoices(): void {
		this.routing.navigateToRoute("SupplierInvoicesList");
	}

	public onShowSuppliers(): void {
		this.routing.navigateToRoute("SuppliersList");
	}

	public onShowSettings(): void {
		this.routing.navigateToRoute("CompanySettingsObjectPage", { key: "ID=1,IsActiveEntity=true" });
	}

	public formatCount(count: null | number): string {
		const bundle = (this.getAppComponent().getModel("i18n") as ResourceModel).getResourceBundle() as {
			getText: (key: string, args: unknown[]) => string;
		};
		return count === 1 ? bundle.getText("invoiceCountOne", []) : bundle.getText("invoiceCount", [count ?? 0]);
	}
}
