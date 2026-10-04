import cds from "@sap/cds";
import { readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * The database tables with business data: every persisted entity except the code lists delivered in
 * db/data (and their texts). Used by the backup, restore and wipe scripts.
 */
export interface Table {
	/** Columns of type LargeBinary (documents, logo), stored base64-encoded in a backup. */
	binaryColumns: string[];
	name: string;
}

interface Definition {
	"@cds.persistence.exists"?: boolean;
	"@cds.persistence.skip"?: boolean;
	elements?: Record<string, { type?: string; value?: unknown; virtual?: boolean }>;
	kind?: string;
	projection?: unknown;
	query?: unknown;
}

export async function businessTables(): Promise<Table[]> {
	const codeLists = new Set(
		readdirSync(join(__dirname, "../db/data")).map((file) => file.replace(/\.csv$/, "").replaceAll("-", ".")),
	);
	const model = cds.minify(await cds.load("*"));
	return Object.entries(model.definitions as Record<string, Definition>)
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
		.map(([name, definition]) => ({
			binaryColumns: Object.entries(definition.elements ?? {})
				.filter(([, element]) => element.type === "cds.LargeBinary" && !element.value && !element.virtual)
				.map(([column]) => column),
			name,
		}));
}

export async function countRows(table: string): Promise<number> {
	const row = (await SELECT.one`count(*) as n`.from(table)) as Record<string, number> | undefined;
	return Number(row?.n ?? row?.N ?? 0);
}
