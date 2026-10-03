import { requireOrganization } from "../organizations/organization-context";

/**
 * Finds the supplier of a received invoice within the current organization, only by deterministic
 * identifiers: VAT ID, tax number, IBAN, or a unique exact name. Anything uncertain returns undefined,
 * so the user picks the supplier.
 */
export interface SupplierIdentity {
	iban?: null | string;
	name?: null | string;
	taxNumber?: null | string;
	vatId?: null | string;
}

export async function findSupplier(identity: SupplierIdentity): Promise<string | undefined> {
	const organization_ID = requireOrganization();
	const normalize = (value?: null | string) => value?.replace(/\s+/g, "").toUpperCase() || undefined;
	const candidates: [string, string | undefined][] = [
		["vatId", normalize(identity.vatId)],
		["taxNumber", normalize(identity.taxNumber)],
		["iban", normalize(identity.iban)],
	];
	for (const [field, value] of candidates) {
		if (!value) {
			continue;
		}
		// field is one of the fixed names above, value a bound parameter
		const matches = await SELECT.from("swiver.Suppliers")
			.columns("ID")
			.where({ organization_ID })
			.and(`upper(replace(${field}, ' ', '')) =`, value);
		if (matches.length === 1) {
			return matches[0].ID as string;
		}
	}
	const name = identity.name?.trim();
	if (name) {
		const matches = await SELECT.from("swiver.Suppliers")
			.columns("ID")
			.where({ organization_ID })
			.and("lower(name) =", name.toLowerCase());
		if (matches.length === 1) {
			return matches[0].ID as string;
		}
	}
	return undefined;
}
