import NavigationListItem from "sap/tnt/NavigationListItem";
import { SideNavigation$ItemSelectEvent } from "sap/tnt/SideNavigation";
import ToolPage from "sap/tnt/ToolPage";
import Controller from "sap/ui/core/mvc/Controller";

/**
 * Shows the selected Swiver app in an iframe. Each navigation key is a child app id.
 * @namespace swiver.configuration.controller
 */
export default class App extends Controller {
	private key = "swiver.settings";

	public onToggleSide(): void {
		const page = this.byId("toolPage") as ToolPage;
		page.setSideExpanded(!page.getSideExpanded());
	}

	public onItemSelect(event: SideNavigation$ItemSelectEvent): void {
		this.key = (event.getParameter("item") as NavigationListItem).getKey();
		this.onFrameRendered();
	}

	/** The HTML control re-renders its iframe, so the src is set after every rendering. */
	public onFrameRendered(): void {
		const frame = this.byId("frame")?.getDomRef() as HTMLIFrameElement | null;
		if (frame) {
			frame.src = App.url(this.key);
		}
	}

	/** Locally CAP serves an app at /swiver.x/, the BTP approuter at /swiverservice.swiverx/. */
	private static url(id: string): string {
		const deployed = window.location.pathname.startsWith("/swiverservice.");
		return deployed ? `/swiverservice.${id.replace(/\./g, "")}/index.html` : `/${id}/index.html`;
	}
}
