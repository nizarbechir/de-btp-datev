import ExtensionAPI from "sap/fe/core/ExtensionAPI";
import Context from "sap/ui/model/odata/v4/Context";
import ODataModel from "sap/ui/model/odata/v4/ODataModel";

/**
 * Opens the company settings of the organization, which have their own page.
 */
const SettingsActions = {
	async openCompanySettings(this: ExtensionAPI, context: Context): Promise<void> {
		const model = context.getModel() as ODataModel;
		const current = (await model.bindContext("/myOrganization()").requestObject()) as { settingsID?: number };
		if (current.settingsID !== undefined && current.settingsID !== null) {
			this.routing.navigateToRoute("CompanySettingsObjectPage", {
				key: `ID=${current.settingsID},IsActiveEntity=true`,
			});
		}
	},
};

export default SettingsActions;
