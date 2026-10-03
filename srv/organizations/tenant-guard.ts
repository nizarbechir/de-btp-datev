import cds from "@sap/cds";

import { requireOrganization } from "./organization-context";

/**
 * Writes are checked here, reads by the `@restrict` annotations:
 * - new records always get the user's organization, whatever the request says,
 * - the organization of a record can never be changed,
 * - a record can only point to records of the same organization (e.g. an invoice to a customer),
 *   so IDs from the client are never trusted just because they exist.
 */
type Data = Record<string, unknown>;
type Definition = cds.entity & { elements: Record<string, Element> };
interface Element {
	isAssociation?: boolean;
	isComposition?: boolean;
	keys?: unknown[];
	name: string;
	target?: string;
	type?: string;
}

/** Fails with 404 unless the record exists in the current organization. Use for IDs passed to actions. */
export async function assertOwned(req: cds.Request, entity: string, id: unknown, message = "RECORD_NOT_FOUND") {
	if (!id) {
		return;
	}
	const organizationId = requireOrganization(req);
	const found = await SELECT.one.from(entity).columns("ID").where({ ID: id, organization_ID: organizationId });
	if (!found) {
		req.reject(404, message);
	}
}

export function isOrganizationOwned(entity?: unknown): boolean {
	return Boolean((entity as Definition | undefined)?.elements?.organization);
}

export function registerTenantGuard(srv: cds.ApplicationService) {
	srv.before(["NEW", "CREATE"], "*", (req) => {
		if (isOrganizationOwned(req.target)) {
			assignOrganization(req.data as Data, requireOrganization(req));
		}
	});
	srv.before("UPDATE", "*", (req) => {
		if (isOrganizationOwned(req.target)) {
			delete (req.data as Data).organization_ID;
			delete (req.data as Data).organization;
		}
	});
	srv.before(["NEW", "CREATE", "UPDATE"], "*", async (req) => {
		if (req.target && req.data && typeof req.data === "object") {
			await checkReferences(req, req.target as unknown as Definition, req.data as Data);
		}
	});
}

function assignOrganization(data: Data | Data[], organizationId: string) {
	for (const entry of Array.isArray(data) ? data : [data]) {
		delete entry.organization;
		entry.organization_ID = organizationId;
	}
}

/** Checks the managed to-one associations of the data, including deep compositions such as items. */
async function checkReferences(req: cds.Request, entity: Definition, data: Data | Data[], parent?: string) {
	for (const entry of Array.isArray(data) ? data : [data]) {
		for (const element of Object.values(entity.elements ?? {})) {
			// The organization is set by the guard; the back link of an item points to the document being saved.
			if (!element.isAssociation || !element.target || element.name === "organization" || element.target === parent) {
				continue;
			}
			const target = cds.model?.definitions[element.target] as Definition | undefined;
			const value = entry[element.name];
			if (element.isComposition) {
				if (value && typeof value === "object" && target) {
					await checkReferences(req, target, value as Data | Data[], entity.name);
				}
				continue;
			}
			if (!element.keys || !isOrganizationOwned(target)) {
				continue;
			}
			const ID = entry[`${element.name}_ID`] ?? (value as Data | undefined)?.ID;
			if (ID) {
				await assertOwned(req, element.target, ID, "REFERENCE_OTHER_ORGANIZATION");
			}
		}
	}
}
