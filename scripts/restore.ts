// Restores a backup written by scripts/backup.ts into the bound database. The schema must be deployed
// and the business tables empty (a restore never merges into existing data). Verifies row counts and
// checksums before writing and the row counts afterwards.
// Run: npx cds bind --exec --profile <restore profile> -- npx ts-node scripts/restore.ts <backup.zip>
// See docs/backup-restore.md.
import cds from "@sap/cds";
import { unzipSync } from "fflate";
import { readFileSync } from "node:fs";

import { Manifest, sha256 } from "./backup";
import { businessTables, countRows } from "./business-tables";

async function restore(file: string) {
	const files = unzipSync(readFileSync(file));
	const manifest = JSON.parse(Buffer.from(files["manifest.json"]).toString("utf8")) as Manifest;
	const tables = await businessTables();
	const known = new Map(tables.map((table) => [table.name, table]));
	for (const [name, entry] of Object.entries(manifest.tables)) {
		const content = files[`data/${name}.json`];
		if (!known.has(name)) {
			throw new Error(`The backup contains table ${name}, which the current model does not have.`);
		}
		if (!content || sha256(content) !== entry.sha256) {
			throw new Error(`Checksum mismatch for ${name}: the backup is damaged.`);
		}
	}
	await cds.connect.to("db");
	for (const { name } of tables) {
		if (await countRows(name)) {
			throw new Error(`Table ${name} is not empty. Restore only into an empty database.`);
		}
	}
	await cds.tx(async () => {
		for (const [name, entry] of Object.entries(manifest.tables)) {
			const rows = JSON.parse(Buffer.from(files[`data/${name}.json`]).toString("utf8")) as Record<string, unknown>[];
			for (const row of rows) {
				for (const column of known.get(name)?.binaryColumns ?? []) {
					const value = row[column] as null | { $binary: string };
					row[column] = value ? Buffer.from(value.$binary, "base64") : null;
				}
			}
			for (let start = 0; start < rows.length; start += 500) {
				await INSERT.into(name).entries(rows.slice(start, start + 500));
			}
			if (rows.length !== entry.rows) {
				throw new Error(`Row count mismatch for ${name}.`);
			}
		}
	});
	let total = 0;
	for (const [name, entry] of Object.entries(manifest.tables)) {
		const count = await countRows(name);
		if (count !== entry.rows) {
			throw new Error(`${name}: ${count} rows restored, ${entry.rows} expected.`);
		}
		total += count;
	}
	console.log(
		`Restored ${total} rows in ${Object.keys(manifest.tables).length} tables from ${file} (${manifest.createdAt}).`,
	);
}

restore(process.argv[2] ?? "").catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : error);
	process.exitCode = 1;
});
