import ResourceBundle from "sap/base/i18n/ResourceBundle";
import ExtensionAPI from "sap/fe/templates/ListReport/ExtensionAPI";
import MessageBox from "sap/m/MessageBox";
import MessageToast from "sap/m/MessageToast";
import BusyIndicator from "sap/ui/core/BusyIndicator";
import ODataModel from "sap/ui/model/odata/v4/ODataModel";
import ResourceModel from "sap/ui/model/resource/ResourceModel";

type PickedFile = NonNullable<HTMLInputElement["files"]>[number];

/** Lets the user pick several PDF or image files at once. */
function chooseFiles(): Promise<PickedFile[]> {
	return new Promise((resolve) => {
		const input = document.createElement("input");
		input.type = "file";
		input.multiple = true;
		input.accept = "application/pdf,image/png,image/jpeg";
		input.onchange = () => resolve(Array.from(input.files ?? []));
		input.click();
	});
}

function text(api: ExtensionAPI, key: string, args?: unknown[]): string {
	const bundle = (api.getModel("i18n") as ResourceModel).getResourceBundle() as ResourceBundle;
	return bundle.getText(key, args) ?? key;
}

/** The file content as base64url, the format of Edm.Binary in OData V4 JSON. */
function toBase64Url(file: PickedFile): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () =>
			resolve(
				String(reader.result)
					.replace(/^data:[^,]*,/, "")
					.replace(/\+/g, "-")
					.replace(/\//g, "_")
					.replace(/=+$/, ""),
			);
		reader.onerror = () => reject(reader.error ?? new Error("read failed"));
		reader.readAsDataURL(file);
	});
}

/**
 * Inbox list: uploads any number of documents in one go. Each file becomes an inbox document right
 * away (no create, upload, save per file) and its invoice data is read immediately.
 */
const InboxActions = {
	async upload(this: ExtensionAPI): Promise<void> {
		const files = await chooseFiles();
		if (!files.length) {
			return;
		}
		const model = this.getModel() as ODataModel;
		const failed: string[] = [];
		BusyIndicator.show(0);
		try {
			for (const file of files) {
				const action = model.bindContext("/uploadDocument(...)");
				action.setParameter("fileName", file.name);
				action.setParameter("mediaType", file.type);
				action.setParameter("content", await toBase64Url(file));
				try {
					await action.invoke();
				} catch (error) {
					failed.push(`${file.name}: ${(error as Error).message}`);
				}
			}
		} finally {
			BusyIndicator.hide();
		}
		await this.refresh();
		const uploaded = files.length - failed.length;
		if (failed.length) {
			MessageBox.error(text(this, "uploadFailed", [uploaded, files.length]), { details: failed.join("\n") });
		} else {
			MessageToast.show(text(this, "documentsUploaded", [uploaded]));
		}
	},
};

export default InboxActions;
