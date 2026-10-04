// Loads the demo data from test/data into the bound database (e.g. HANA in hybrid mode), next to existing
// data: rows whose key already exists are skipped, never overwritten. The demo organization becomes the
// one the demo user alice works in; switch back to your own organization in Settings.
// Run: npx cds bind --exec --profile hybrid -- npx ts-node scripts/seed-hybrid.ts
import cds from "@sap/cds";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

interface Element {
	key?: boolean;
	type?: string;
}

const dataDirectory = join(__dirname, "../test/data");
const demoOrganization = "77777777-0000-4000-8000-000000000001";

async function freeSettingsId(id: number, assigned: Map<number, number>): Promise<number> {
	if (!assigned.has(id)) {
		const taken = await SELECT.one.from("swiver.CompanySettings").columns("organization_ID").where({ ID: id });
		const max = (await SELECT.one.from("swiver.CompanySettings").columns("max(ID) as maxID")) as { maxID?: number };
		assigned.set(id, taken && taken.organization_ID !== demoOrganization ? Number(max?.maxID ?? 0) + 1 : id);
	}
	return assigned.get(id) as number;
}

async function seed() {
	const model = cds.compile.for.nodejs(await cds.load("*"));
	cds.model = model;
	await cds.connect.to("db");
	const settingsIds = new Map<number, number>();
	for (const file of readdirSync(dataDirectory).filter((name) => name.endsWith(".csv"))) {
		const entity = file.replace(/\.csv$/, "").replaceAll("-", ".");
		const definition = model.definitions?.[entity] as unknown as undefined | { elements: Record<string, Element> };
		if (!definition) {
			console.log(`${entity}: not in the model, skipped`);
			continue;
		}
		const [header, ...lines] = (cds.parse as unknown as { csv: (text: string) => string[][] }).csv(
			readFileSync(join(dataDirectory, file), "utf8"),
		);
		let inserted = 0;
		let skipped = 0;
		for (const line of lines) {
			const row = toRow(definition.elements, header, line);
			// The demo files are single-company data; here they belong to the demo organization.
			if ("organization_ID" in definition.elements && !row.organization_ID) {
				row.organization_ID = demoOrganization;
			}
			if (entity === "swiver.NumberRanges" && !String(row.range).includes(":")) {
				row.range = `${demoOrganization}:${String(row.range)}`;
			}
			if (entity === "swiver.CompanySettings") {
				if (await SELECT.one.from(entity).columns("ID").where({ organization_ID: row.organization_ID })) {
					skipped++;
					continue;
				}
				// Settings keep an integer key that the existing organizations may already use.
				row.ID = await freeSettingsId(row.ID as number, settingsIds);
			}
			const keys = Object.fromEntries(
				Object.entries(definition.elements)
					.filter(([, element]) => element.key)
					.map(([name]) => [name, row[name]]),
			);
			if (await SELECT.one.from(entity).columns(Object.keys(keys)[0]).where(keys)) {
				skipped++;
				continue;
			}
			await INSERT.into(entity).entries(row);
			inserted++;
		}
		console.log(`${entity}: ${inserted} inserted, ${skipped} already there`);
	}
	await UPDATE("swiver.Memberships")
		.set({ lastUsedAt: new Date().toISOString() })
		.where({ organization_ID: demoOrganization, userId: "alice" });
}

function toRow(elements: Record<string, Element>, header: string[], line: string[]): Record<string, unknown> {
	const row: Record<string, unknown> = {};
	header.forEach((column, index) => {
		const value = line[index];
		const type = elements[column]?.type;
		if (value === undefined || value === "") {
			row[column] = null;
		} else if (type === "cds.Boolean") {
			row[column] = value === "true";
		} else if (type === "cds.Integer" || type === "cds.Int64") {
			row[column] = Number(value);
		} else {
			row[column] = value;
		}
	});
	return row;
}

seed().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : error);
	process.exitCode = 1;
});
