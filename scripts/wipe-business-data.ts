// Deletes all business data from the bound database and keeps the code lists from db/data.
// Run: npx cds bind --exec --profile hybrid -- npx ts-node scripts/wipe-business-data.ts
import cds from "@sap/cds";

import { businessTables, countRows } from "./business-tables";

async function wipe() {
	const tables = await businessTables();
	await cds.connect.to("db");
	let total = 0;
	for (const { name } of tables) {
		const count = await countRows(name);
		if (count) {
			await DELETE.from(name);
			console.log(`${name}: ${count}`);
			total += count;
		}
	}
	console.log(`deleted rows: ${total}`);
}

wipe().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : error);
	process.exitCode = 1;
});
