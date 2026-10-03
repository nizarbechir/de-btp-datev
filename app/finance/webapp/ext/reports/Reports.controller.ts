import PageController from "sap/fe/core/PageController";
import MessageBox from "sap/m/MessageBox";
import JSONModel from "sap/ui/model/json/JSONModel";
import ODataModel from "sap/ui/model/odata/v4/ODataModel";

/**
 * VAT overview and accountant export for a period. All figures and the ZIP come from the backend.
 * @namespace swiver.finance.ext.reports
 */
export default class Reports extends PageController {
	public onInit(): void {
		super.onInit();
		const today = new Date();
		this.getView()?.setModel(
			new JSONModel({ from: new Date(today.getFullYear(), today.getMonth(), 1), to: today }),
			"report",
		);
		this.getView()?.setModel(new JSONModel({}), "vat");
		void this.loadVat();
	}

	public onPeriodChange(): void {
		void this.loadVat();
	}

	public async onExport(): Promise<void> {
		const { fromDate, toDate } = this.period();
		const url = `${this.model().getServiceUrl()}accountantExport(fromDate=${fromDate},toDate=${toDate})`;
		const response = await window.fetch(url);
		if (!response.ok) {
			const error = (await response.json().catch(() => undefined)) as undefined | { error?: { message?: string } };
			MessageBox.error(error?.error?.message ?? response.statusText);
			return;
		}
		const link = document.createElement("a");
		link.href = window.URL.createObjectURL(await response.blob());
		link.download = `accountant-export_${fromDate}_${toDate}.zip`;
		document.body.appendChild(link);
		link.click();
		window.URL.revokeObjectURL(link.href);
		link.remove();
	}

	private async loadVat(): Promise<void> {
		const { fromDate, toDate } = this.period();
		const binding = this.model().bindContext(`/vatOverview(fromDate=${fromDate},toDate=${toDate})`);
		try {
			(this.getView()?.getModel("vat") as JSONModel).setData(await binding.requestObject());
		} catch (error) {
			MessageBox.error((error as Error).message);
		}
	}

	private model(): ODataModel {
		return this.getAppComponent().getModel() as ODataModel;
	}

	private period(): { fromDate: string; toDate: string } {
		const { from, to } = (this.getView()?.getModel("report") as JSONModel).getData() as { from: Date; to: Date };
		const iso = (date: Date) =>
			`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
		return { fromDate: iso(from ?? new Date()), toDate: iso(to ?? from ?? new Date()) };
	}
}
