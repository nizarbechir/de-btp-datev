import PageController from "sap/fe/core/PageController";
import Event from "sap/ui/base/Event";
import Control from "sap/ui/core/Control";

/**
 * Entry page of the Reports app: one entry per report, each opening its own list report.
 * @namespace swiver.reports.ext
 */
export default class ReportsHome extends PageController {
	public onOpenReport(event: Event): void {
		const route = (event.getSource() as Control).data("route") as string;
		void this.getExtensionAPI().routing.navigateToRoute(route);
	}
}
