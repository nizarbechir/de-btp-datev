import ComboBox from "sap/m/ComboBox";
import NavigationListItem from "sap/tnt/NavigationListItem";
import SideNavigation, { SideNavigation$ItemSelectEvent } from "sap/tnt/SideNavigation";
import ToolPage from "sap/tnt/ToolPage";
import Controller from "sap/ui/core/mvc/Controller";
import Context from "sap/ui/model/odata/v4/Context";
import ODataContextBinding from "sap/ui/model/odata/v4/ODataContextBinding";
import ODataModel from "sap/ui/model/odata/v4/ODataModel";

interface CurrentOrganization {
	clients?: number;
	firmRole?: string;
	organizationID?: string;
	role?: string;
}

/**
 * Shows the selected Swiver app in an iframe. Each navigation key is a child app id, optionally with a route (#SalesInvoices).
 * Users with several organizations switch the one they work in with the client switcher or the client cockpit;
 * the backend keeps it per user, so the hub reloads the app when it changes, also in another tab.
 * @namespace swiver.configuration.controller
 */
export default class App extends Controller {
	private key = "swiver.dashboard";
	private organizationID?: string;

	public onInit(): void {
		window.addEventListener("message", (event: MessageEvent<{ key?: string; type?: string }>) => {
			if (event.origin === window.location.origin && event.data?.type === "swiver.clientOpened") {
				void this.onClientChanged(event.data.key);
			}
		});
		document.addEventListener("visibilitychange", () => {
			if (document.visibilityState === "visible") {
				void this.onClientChanged(this.key, true);
			}
		});
		// Tax firm staff start in the client cockpit.
		void this.organization().then((organization) => {
			this.organizationID = organization.organizationID;
			if (organization.firmRole) {
				this.show("swiver.clients");
			}
		});
	}

	public onToggleSide(): void {
		const page = this.byId("toolPage") as ToolPage;
		page.setSideExpanded(!page.getSideExpanded());
	}

	public onItemSelect(event: SideNavigation$ItemSelectEvent): void {
		this.key = (event.getParameter("item") as NavigationListItem).getKey();
		this.onFrameRendered();
	}

	public async onClientSwitch(): Promise<void> {
		const ID = (this.byId("clientSwitcher") as ComboBox).getSelectedKey();
		if (!ID || ID === this.organizationID) {
			return;
		}
		const model = this.getView()?.getModel("clients") as ODataModel;
		await model.bindContext(`/Clients(${ID})/ClientService.open(...)`).invoke();
		await this.onClientChanged(this.key);
	}

	/** The HTML control re-renders its iframe, so the src is set after every rendering. */
	public onFrameRendered(): void {
		const frame = this.byId("frame")?.getDomRef() as HTMLIFrameElement | null;
		if (frame) {
			frame.src = App.url(this.key);
		}
	}

	/**
	 * Reloads the organization and shows the given app, or the start page of the new organization.
	 * With onlyIfChanged, nothing happens unless the organization was switched elsewhere.
	 */
	private async onClientChanged(key?: string, onlyIfChanged = false): Promise<void> {
		(this.byId("toolPage") as ToolPage).getElementBinding("org")?.refresh();
		const organization = await this.organization();
		if (onlyIfChanged && organization.organizationID === this.organizationID) {
			return;
		}
		this.organizationID = organization.organizationID;
		this.show(key ?? (organization.role === "TAX_ADVISOR" ? "swiver.taxadvisor" : "swiver.dashboard"));
	}

	private show(key: string): void {
		this.key = key;
		(this.byId("sideNavigation") as SideNavigation).setSelectedKey(key);
		this.onFrameRendered();
	}

	private async organization(): Promise<CurrentOrganization> {
		const binding = (this.byId("toolPage") as ToolPage).getElementBinding("org") as ODataContextBinding | undefined;
		return ((await (binding?.getBoundContext() as Context | null)?.requestObject()) ?? {}) as CurrentOrganization;
	}

	/** Locally CAP serves an app at /swiver.x/, the approuter at /swiverx-{version}/ (the version of this app). */
	private static url(key: string): string {
		const [id, route = ""] = key.split("#");
		const version = /^\/swiverconfiguration-(\d+\.\d+\.\d+)\//.exec(window.location.pathname)?.[1];
		const app = version ? `/${id.replace(/\./g, "")}-${version}` : `/${id}`;
		return `${app}/index.html${route && "#" + route}`;
	}
}
