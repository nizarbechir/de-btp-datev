import cds from "@sap/cds";

import { canChangeRecords } from "../organizations/organization-context";

/**
 * Fills the virtual readOnly element (see read-only.cds), which hides create, edit, delete and the
 * business actions in the UI for the tax advisor. The backend enforces this with `@restrict`.
 */
export function registerReadOnlyFlag(srv: cds.ApplicationService) {
	if (srv.entities.ReadOnlyUser) {
		srv.on("READ", srv.entities.ReadOnlyUser, () => ({ readOnly: !canChangeRecords() }));
	}
	srv.after("READ", "*", (result, req) => {
		if (!(req.target as cds.entity | undefined)?.elements?.readOnly) {
			return;
		}
		const readOnly = !canChangeRecords();
		for (const row of (Array.isArray(result) ? result : [result]) as (null | { readOnly?: boolean })[]) {
			if (row) {
				row.readOnly = readOnly;
			}
		}
	});
}
