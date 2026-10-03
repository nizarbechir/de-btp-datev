import ResourceBundle from "sap/base/i18n/ResourceBundle";
import ExtensionAPI from "sap/fe/core/ExtensionAPI";
import Button from "sap/m/Button";
import Dialog from "sap/m/Dialog";
import MessageBox from "sap/m/MessageBox";
import MessageToast from "sap/m/MessageToast";
import ODataModel from "sap/ui/model/odata/v4/ODataModel";
import ResourceModel from "sap/ui/model/resource/ResourceModel";
import FileUploader from "sap/ui/unified/FileUploader";

async function runAction(api: ExtensionAPI, path: string, parameters: Record<string, unknown> = {}) {
	const action = (api.getModel() as ODataModel).bindContext(`${path}(...)`);
	for (const [name, value] of Object.entries(parameters)) {
		action.setParameter(name, value);
	}
	await action.invoke();
	return action.getBoundContext().getObject() as unknown;
}

/**
 * Bank statement upload on the bank transactions list: reads the CSV file in the browser and sends
 * its text to the backend, which parses it, skips duplicates and suggests matches.
 */
function text(api: ExtensionAPI, key: string, args: unknown[] = []): string {
	const bundle = (api.getModel("i18n") as ResourceModel).getResourceBundle() as ResourceBundle;
	return bundle.getText(key, args as string[]) ?? key;
}

const BankImport = {
	importCsv(this: ExtensionAPI): void {
		const uploader = new FileUploader({
			fileType: ["csv", "txt"],
			placeholder: text(this, "chooseCsv"),
			width: "100%",
		});
		const dialog = new Dialog({
			afterClose: () => dialog.destroy(),
			beginButton: new Button({
				press: async () => {
					const file = (uploader.getDomRef("fu") as HTMLInputElement | null)?.files?.[0];
					if (!file) {
						return;
					}
					dialog.close();
					try {
						const content = await file.text();
						const result = (await runAction(this, "/importBankStatement", { content, fileName: file.name })) as {
							duplicates: number;
							imported: number;
							suggested: number;
						};
						MessageToast.show(text(this, "importResult", [result.imported, result.duplicates, result.suggested]));
						this.refresh();
					} catch (error) {
						MessageBox.error((error as Error).message);
					}
				},
				text: text(this, "importCsv"),
				type: "Emphasized",
			}),
			content: [uploader],
			contentWidth: "28rem",
			endButton: new Button({ press: () => dialog.close(), text: text(this, "cancel") }),
			title: text(this, "importCsv"),
		});
		dialog.addStyleClass("sapUiContentPadding");
		dialog.open();
	},

	async suggestMatches(this: ExtensionAPI): Promise<void> {
		try {
			const count = (await runAction(this, "/suggestMatches")) as number | { value?: number };
			MessageToast.show(text(this, "suggestResult", [typeof count === "number" ? count : (count?.value ?? 0)]));
			this.refresh();
		} catch (error) {
			MessageBox.error((error as Error).message);
		}
	},
};

export default BankImport;
