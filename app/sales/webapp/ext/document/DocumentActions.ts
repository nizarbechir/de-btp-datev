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

function download(url: string, fileName = "") {
	const link = document.createElement("a");
	link.href = url;
	link.download = fileName;
	document.body.appendChild(link);
	link.click();
	link.remove();
}

/**
 * Header actions of sales invoices and quotes that Fiori elements has no annotation for:
 * PDF preview and download, ZUGFeRD download, and actions that open the newly created draft invoice
 * (duplicate, correct, convert a quote).
 */
async function fileUrl(context: Context, operation: string, download: boolean): Promise<string> {
	const model = context.getModel() as ODataModel;
	// While editing, send pending changes first so the PDF shows what the user sees.
	await model.submitBatch("$auto");
	// e.g. /SalesInvoices(ID=...,IsActiveEntity=true) or /Quotes(...)
	return `${model.getServiceUrl()}${context.getPath().slice(1)}/SalesService.${operation}(download=${download})`;
}

/** Runs a bound action that returns a new draft invoice and opens that draft. */
async function openNewInvoice(api: ExtensionAPI, context: Context, action: string): Promise<void> {
	const result = (await api.editFlow.invokeAction(`SalesService.${action}`, {
		contexts: context,
		model: context.getModel(),
	})) as Context | undefined;
	const ID = (await result?.requestObject("ID")) as string | undefined;
	if (ID) {
		api.routing.navigateToRoute("SalesInvoicesObjectPage", { key: `ID=${ID},IsActiveEntity=false` });
	}
}

function text(api: ExtensionAPI, key: string): string {
	const bundle = (api.getModel("i18n") as ResourceModel).getResourceBundle() as ResourceBundle;
	return bundle.getText(key) ?? key;
}

const DocumentActions = {
	async downloadPdf(this: ExtensionAPI, context: Context): Promise<void> {
		download(await fileUrl(context, "pdf", true));
	},

	async preview(this: ExtensionAPI, context: Context): Promise<void> {
		const response = await window.fetch(await fileUrl(context, "pdf", false));
		if (!response.ok) {
			MessageBox.error(text(this, "previewFailed"));
			return;
		}
		// The preview shows the PDF from memory, so it always matches the document as it is now.
		const source = window.URL.createObjectURL(await response.blob());
		const dialog = new Dialog({
			afterClose: () => {
				window.URL.revokeObjectURL(source);
				dialog.destroy();
			},
			beginButton: new Button({
				press: () => DocumentActions.downloadPdf.call(this, context),
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

	/** The ZUGFeRD e-invoice; shows the backend's message if the invoice data is incomplete. */
	async downloadZugferd(this: ExtensionAPI, context: Context): Promise<void> {
		const response = await window.fetch(await fileUrl(context, "zugferd", true));
		if (!response.ok) {
			const error = (await response.json().catch(() => undefined)) as undefined | { error?: { message?: string } };
			MessageBox.error(error?.error?.message ?? text(this, "zugferdFailed"));
			return;
		}
		const fileName =
			/filename="?([^";]+)"?/.exec(response.headers.get("Content-Disposition") ?? "")?.[1] ?? "invoice.pdf";
		const url = window.URL.createObjectURL(await response.blob());
		download(url, fileName);
		window.URL.revokeObjectURL(url);
	},

	/** Copies the invoice into a new draft and opens it, ready to edit. */
	async duplicate(this: ExtensionAPI, context: Context): Promise<void> {
		await openNewInvoice(this, context, "duplicate");
	},

	/** Cancels the issued invoice and opens the corrected draft that replaces it. */
	async correct(this: ExtensionAPI, context: Context): Promise<void> {
		await openNewInvoice(this, context, "correct");
	},

	/** Switches from the invoice list to the quote list (both live in this app). */
	showQuotes(this: ExtensionAPI): void {
		this.routing.navigateToRoute("QuotesList");
	},

	/** Switches from the quote list back to the invoice list. */
	showInvoices(this: ExtensionAPI): void {
		this.routing.navigateToRoute("SalesInvoicesList");
	},

	/** Creates the draft invoice from the quote and opens it. */
	async convertToInvoice(this: ExtensionAPI, context: Context): Promise<void> {
		await openNewInvoice(this, context, "convertToInvoice");
	},
};

export default DocumentActions;
