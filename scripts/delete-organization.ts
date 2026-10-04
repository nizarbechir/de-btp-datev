// Offboarding: deletes all data of one organization (records, documents, change history, members,
// number ranges, the organization itself). Run only after the customer received the data export and the
// retention period agreed in docs/data-retention-privacy.md has passed. Cannot be undone.
// Run: npx cds bind --exec --profile hybrid -- npx ts-node scripts/delete-organization.ts <organization ID> "<exact organization name>"
import cds from "@sap/cds";

import { deleteOrganizationData } from "../srv/organizations/organization-data";

async function deleteOrganization(organizationId?: string, confirmedName?: string) {
	if (!organizationId || !confirmedName) {
		throw new Error('Usage: delete-organization.ts <organization ID> "<exact organization name>"');
	}
	await cds.connect.to("db");
	cds.model = cds.compile.for.nodejs(await cds.load("*"));
	const organization = (await SELECT.one.from("swiver.Organizations").columns("name").where({ ID: organizationId })) as
		undefined | { name: string };
	if (!organization) {
		throw new Error(`Organization ${organizationId} not found.`);
	}
	if (organization.name !== confirmedName) {
		throw new Error(`The name does not match the organization (${organization.name}). Nothing was deleted.`);
	}
	const deleted = await cds.tx(() => deleteOrganizationData(organizationId));
	for (const [table, count] of Object.entries(deleted)) {
		console.log(`${table}: ${count}`);
	}
}

deleteOrganization(process.argv[2], process.argv[3]).catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : error);
	process.exitCode = 1;
});
