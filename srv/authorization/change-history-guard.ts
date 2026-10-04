import cds from "@sap/cds";

/**
 * The change history (sap.changelog.ChangeView of `@cap-js/change-tracking`) has no organization of its
 * own, and navigating from a record to its `changes` does not apply the record's `@restrict`. So the
 * history is only readable through a record (e.g. SalesInvoices(…)/changes or $expand=changes), and
 * only after that record itself has been read with the user's authorizations.
 */
export function registerChangeHistoryGuard(srv: cds.ApplicationService) {
	const changeView = srv.entities.ChangeView;
	if (!changeView) {
		return;
	}
	srv.before("READ", changeView, async (req) => {
		const ref = (req.query as { SELECT?: { from?: { ref?: unknown[] } } }).SELECT?.from?.ref;
		if (!Array.isArray(ref) || ref.length < 2) {
			return req.reject(403, "CHANGE_HISTORY_ONLY_WITH_RECORD");
		}
		const record = await srv.run(SELECT.one.from({ ref: [ref[0]] } as never).columns("ID"));
		if (!record) {
			return req.reject(404);
		}
	});
}
