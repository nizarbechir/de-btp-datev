import ResourceBundle from "sap/base/i18n/ResourceBundle";
import ExtensionAPI from "sap/fe/core/ExtensionAPI";
import Button from "sap/m/Button";
import Dialog from "sap/m/Dialog";
import MessageBox from "sap/m/MessageBox";
import HTML from "sap/ui/core/HTML";
import Device from "sap/ui/Device";
import Context from "sap/ui/model/odata/v4/Context";
import ODataModel from "sap/ui/model/odata/v4/ODataModel";
import ResourceModel from "sap/ui/model/resource/ResourceModel";

/**
 * Preview and download of the sales invoice PDF, which Fiori elements has no annotation for, and
 * Duplicate, which must open the new draft rather than stay on the copied invoice.
 */
async function pdfUrl(context: Context, download: boolean): Promise<string> {
	const model = context.getModel() as ODataModel;
	// While editing, send pending changes first so the PDF shows what the user sees.
	await model.submitBatch("$auto");
	const { ID, IsActiveEntity } = (await context.requestObject()) as { ID: string; IsActiveEntity: boolean };
	return `${model.getServiceUrl()}SalesInvoices(ID=${ID},IsActiveEntity=${IsActiveEntity})/FinanceService.pdf(download=${download})`;
}

function text(api: ExtensionAPI, key: string): string {
	const bundle = (api.getModel("i18n") as ResourceModel).getResourceBundle() as ResourceBundle;
	return bundle.getText(key) ?? key;
}

const SalesInvoiceActions = {
	async preview(this: ExtensionAPI, context: Context): Promise<void> {
		const response = await window.fetch(await pdfUrl(context, false));
		if (!response.ok) {
			MessageBox.error(text(this, "previewFailed"));
			return;
		}
		// The preview shows the PDF from memory, so it always matches the invoice as it is now.
		const source = window.URL.createObjectURL(await response.blob());
		const dialog = new Dialog({
			afterClose: () => {
				window.URL.revokeObjectURL(source);
				dialog.destroy();
			},
			beginButton: new Button({
				press: () => SalesInvoiceActions.downloadPdf.call(this, context),
				text: text(this, "downloadPdf"),
				type: "Emphasized",
			}),
			content: new HTML({
				content: `<iframe src="${source}" title="${text(this, "previewTitle")}" style="width:100%;height:78vh;border:0;display:block"></iframe>`,
			}),
			contentWidth: "60rem",
			endButton: new Button({ press: () => dialog.close(), text: text(this, "close") }),
			resizable: true,
			stretch: Device.system.phone,
			title: text(this, "previewTitle"),
		});
		dialog.addStyleClass("sapUiNoContentPadding");
		dialog.open();
	},

	/** Copies the invoice into a new draft and opens it, ready to edit. */
	async downloadPdf(this: ExtensionAPI, context: Context): Promise<void> {
		const link = document.createElement("a");
		link.href = await pdfUrl(context, true);
		link.download = "";
		document.body.appendChild(link);
		link.click();
		link.remove();
	},

	async duplicate(this: ExtensionAPI, context: Context): Promise<void> {
		const copy = (await this.editFlow.invokeAction("FinanceService.duplicate", {
			contexts: context,
			model: context.getModel(),
		})) as Context | undefined;
		const ID = (await copy?.requestObject("ID")) as string | undefined;
		if (ID) {
			this.routing.navigateToRoute("SalesInvoicesObjectPage", { key: `ID=${ID},IsActiveEntity=false` });
		}
	},
};

export default SalesInvoiceActions;
