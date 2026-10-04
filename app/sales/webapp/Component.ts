import BaseComponent from "sap/fe/core/AppComponent";
import HashChanger from "sap/ui/core/routing/HashChanger";

/**
 * @namespace swiver.sales
 */
export default class Component extends BaseComponent {
	public static metadata = {
		manifest: "json",
	};

	init(): void {
		// Opened through the Quotes tile (Quote-manage) without an inner route: start on the quotes list.
		if (/^#Quote-manage(?:[?&]|$)/.test(window.location.hash) && !HashChanger.getInstance().getHash()) {
			HashChanger.getInstance().replaceHash("Quotes");
		}
		super.init();
	}
}
