import BaseComponent from "sap/fe/core/AppComponent";
import MessageBox from "sap/m/MessageBox";
import ODataModel from "sap/ui/model/odata/v4/ODataModel";
import ResourceModel from "sap/ui/model/resource/ResourceModel";

/**
 * @namespace swiver.settings
 */
export default class Component extends BaseComponent {
	public static metadata = {
		manifest: "json",
	};

	/** The link in an invitation e-mail opens Settings with the parameter invitation=TOKEN. */
	public init(): void {
		super.init();
		const parameters = (this.getComponentData() as undefined | { startupParameters?: Record<string, string[]> })
			?.startupParameters;
		const token = parameters?.invitation?.[0];
		if (token) {
			void this.acceptInvitation(token);
		}
	}

	private async acceptInvitation(token: string): Promise<void> {
		const model = this.getModel() as ODataModel;
		const i18n = (this.getModel("i18n") as ResourceModel).getResourceBundle() as { getText(key: string): string };
		const action = model.bindContext("/acceptInvitation(...)");
		action.setParameter("token", token);
		try {
			await action.invoke();
			// Reload without the token, so the new organization is used everywhere.
			MessageBox.success(i18n.getText("invitationAccepted"), {
				onClose: () => window.location.assign(window.location.pathname),
			});
		} catch (error) {
			MessageBox.error((error as Error).message);
		}
	}
}
