// Logical backup of all business data, including uploaded documents and the company logo, which are
// stored in the database. Writes one zip file with a manifest (row counts and SHA-256 per table).
// Run: npx cds bind --exec --profile hybrid -- npx ts-node scripts/backup.ts [target directory]
// See docs/backup-restore.md.
import cds from "@sap/cds";
import { zipSync } from "fflate";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Readable } from "node:stream";

import { businessTables } from "./business-tables";

export interface Manifest {
	createdAt: string;
	format: 1;
	tables: Record<string, { rows: number; sha256: string }>;
}

export function sha256(content: Uint8Array): string {
	return createHash("sha256").update(content).digest("hex");
}

async function backup(directory: string) {
	const tables = await businessTables();
	await cds.connect.to("db");
	const files: Record<string, Uint8Array> = {};
	const manifest: Manifest = { createdAt: new Date().toISOString(), format: 1, tables: {} };
	for (const table of tables) {
		// LargeBinary columns are not part of "*" and must be selected explicitly
		const rows = (await SELECT.from(table.name).columns("*", ...table.binaryColumns)) as Record<string, unknown>[];
		for (const row of rows) {
			for (const column of table.binaryColumns) {
				row[column] = await encodeBinary(row[column]);
			}
		}
		const content = Buffer.from(JSON.stringify(rows));
		files[`data/${table.name}.json`] = content;
		manifest.tables[table.name] = { rows: rows.length, sha256: sha256(content) };
	}
	files["manifest.json"] = Buffer.from(JSON.stringify(manifest, null, 2));
	mkdirSync(directory, { recursive: true });
	const file = join(directory, `swiver-backup-${manifest.createdAt.replace(/[:.]/g, "-")}.zip`);
	writeFileSync(file, zipSync(files, { level: 9 }));
	const total = Object.values(manifest.tables).reduce((sum, entry) => sum + entry.rows, 0);
	console.log(`${file}: ${total} rows in ${tables.length} tables`);
}

/** LargeBinary columns arrive as stream, buffer or (SQLite) base64 string; the backup keeps base64. */
async function encodeBinary(value: unknown): Promise<null | { $binary: string }> {
	if (value === null || value === undefined) {
		return null;
	}
	if (typeof value === "string") {
		return { $binary: value };
	}
	if (value instanceof Readable) {
		const chunks: Buffer[] = [];
		for await (const chunk of value) {
			chunks.push(Buffer.from(chunk as Buffer));
		}
		return { $binary: Buffer.concat(chunks).toString("base64") };
	}
	return { $binary: Buffer.from(value as Uint8Array).toString("base64") };
}

if (require.main === module) {
	backup(process.argv[2] ?? "backups").catch((error: unknown) => {
		console.error(error instanceof Error ? error.message : error);
		process.exitCode = 1;
	});
}
