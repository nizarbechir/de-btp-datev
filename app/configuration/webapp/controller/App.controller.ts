import NavigationListItem from "sap/tnt/NavigationListItem";
import { SideNavigation$ItemSelectEvent } from "sap/tnt/SideNavigation";
import ToolPage from "sap/tnt/ToolPage";
import Controller from "sap/ui/core/mvc/Controller";

/**
 * Shows the selected Swiver app in an iframe. Each navigation key is a child app id, optionally with a route (#SalesInvoices).
 * @namespace swiver.configuration.controller
 */
export default class App extends Controller {
	private key = "swiver.dashboard";

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
	private static url(key: string): string {
		const [id, route = ""] = key.split("#");
		const deployed = window.location.pathname.startsWith("/swiverservice.");
		const app = deployed ? `/swiverservice.${id.replace(/\./g, "")}` : `/${id}`;
		return `${app}/index.html${route && "#" + route}`;
	}
}
