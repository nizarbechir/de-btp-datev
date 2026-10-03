import PageController from "sap/fe/core/PageController";
import ResourceModel from "sap/ui/model/resource/ResourceModel";

/**
 * @namespace swiver.app.ext.dashboard
 */
export default class Dashboard extends PageController {
	public onShowInvoices(): void {
		this.routing.navigateToRoute("SupplierInvoicesList");
	}

	public onShowSuppliers(): void {
		this.routing.navigateToRoute("SuppliersList");
	}

	public formatCount(count: null | number): string {
		const bundle = (this.getAppComponent().getModel("i18n") as ResourceModel).getResourceBundle() as {
			getText: (key: string, args: unknown[]) => string;
		};
		return bundle.getText("invoiceCount", [count ?? 0]);
	}
}
