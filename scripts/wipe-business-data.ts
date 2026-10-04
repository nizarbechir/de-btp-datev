// Deletes all business data from the bound database and keeps the code lists from db/data.
// Run: npx cds bind --exec --profile hybrid -- npx ts-node scripts/wipe-business-data.ts
import cds from "@sap/cds";
import { readdirSync } from "node:fs";
import { join } from "node:path";

interface Definition {
	"@cds.persistence.exists"?: boolean;
	"@cds.persistence.skip"?: boolean;
	kind?: string;
	projection?: unknown;
	query?: unknown;
}

async function wipe() {
	const codeLists = new Set(
		readdirSync(join(__dirname, "../db/data")).map((file) => file.replace(/\.csv$/, "").replaceAll("-", ".")),
	);
	const model = cds.minify(await cds.load("*"));
	await cds.connect.to("db");
	const tables = Object.entries(model.definitions as Record<string, Definition>)
		.filter(
			([name, definition]) =>
				definition.kind === "entity" &&
				!definition.query &&
				!definition.projection &&
				!definition["@cds.persistence.skip"] &&
				!definition["@cds.persistence.exists"] &&
				!codeLists.has(name) &&
				name !== "sap.changelog.i18nKeys" &&
				!name.endsWith(".texts"),
		)
		.map(([name]) => name);
	let total = 0;
	for (const table of tables) {
		const row = (await SELECT.one`count(*) as n`.from(table)) as Record<string, number> | undefined;
		const count = Number(row?.n ?? row?.N ?? 0);
		if (count) {
			await DELETE.from(table);
			console.log(`${table}: ${count}`);
			total += count;
		}
	}
	console.log(`deleted rows: ${total}`);
}

wipe().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : error);
	process.exitCode = 1;
});
