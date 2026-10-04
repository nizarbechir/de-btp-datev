import BaseComponent from "sap/fe/core/AppComponent";
import HashChanger from "sap/ui/core/routing/HashChanger";

/**
 * @namespace swiver.purchases
 */
export default class Component extends BaseComponent {
	public static metadata = {
		manifest: "json",
	};

	init(): void {
		// Opened through the Inbox tile (Inbox-manage) without an inner route: start on the inbox list.
		if (/^#Inbox-manage(?:[?&]|$)/.test(window.location.hash) && !HashChanger.getInstance().getHash()) {
			HashChanger.getInstance().replaceHash("IncomingDocuments");
		}
		super.init();
	}
}
