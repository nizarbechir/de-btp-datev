import cds from "@sap/cds";
import { zipSync } from "fflate";
import { Readable } from "node:stream";

import { detectDocumentType } from "../core/document-upload";

interface Definition {
	"@cds.persistence.exists"?: boolean;
	"@cds.persistence.skip"?: boolean;
	elements?: Record<string, Element>;
	kind?: string;
	projection?: unknown;
	query?: unknown;
}

/**
 * All data of one organization, for the customer's data export and for deleting an organization at
 * offboarding (docs/data-retention-privacy.md). A table belongs to the organization either directly
 * (organization_ID) or through its parent record (e.g. invoice items through the invoice).
 */
interface Element {
	isAssociation?: boolean;
	keys?: unknown[];
	target?: string;
	type?: string;
	value?: unknown;
	virtual?: boolean;
}

interface OrganizationTable {
	binaryColumns: string[];
	name: string;
	/** Rows of the organization: own organization_ID, or the parent's. */
	parent?: { foreignKey: string; target: string };
}

const extensions = new Map([
	["application/pdf", "pdf"],
	["image/jpeg", "jpg"],
	["image/png", "png"],
]);

/**
 * Deletes all data of the organization, including its change history, number ranges, members and the
 * organization itself. Only for offboarding by an operator (scripts/delete-organization.ts).
 */
export async function deleteOrganizationData(organizationId: string): Promise<Record<string, number>> {
	const deleted: Record<string, number> = {};
	const tables = organizationTables();
	for (const table of tables) {
		const ids = SELECT("ID").from(table.name).where(rowsOf(table, organizationId));
		const changes = await DELETE.from("sap.changelog.Changes").where({ entity: table.name, entityKey: { in: ids } });
		if (changes) {
			deleted["sap.changelog.Changes"] = (deleted["sap.changelog.Changes"] ?? 0) + changes;
		}
	}
	for (const table of [...tables].reverse()) {
		const count = await DELETE.from(table.name).where(rowsOf(table, organizationId));
		if (count) {
			deleted[table.name] = count;
		}
	}
	deleted["swiver.NumberRanges"] = await DELETE.from("swiver.NumberRanges").where({
		range: { like: `${organizationId}:%` },
	});
	deleted["swiver.Organizations"] = await DELETE.from("swiver.Organizations").where({ ID: organizationId });
	return deleted;
}

/**
 * A zip with every record of the organization as JSON (data/&lt;table>.json) and every uploaded document
 * and the logo as file (documents/&lt;table>/&lt;ID>.&lt;ext>), plus a manifest with row counts.
 */
export async function exportOrganizationData(organizationId: string): Promise<Buffer> {
	const files: Record<string, Uint8Array> = {};
	const manifest: { createdAt: string; documents: number; organization: string; tables: Record<string, number> } = {
		createdAt: new Date().toISOString(),
		documents: 0,
		organization: organizationId,
		tables: {},
	};
	const organization = await SELECT.from("swiver.Organizations").where({ ID: organizationId });
	files["data/swiver.Organizations.json"] = json(organization);
	for (const table of organizationTables()) {
		// LargeBinary columns are not part of "*" and must be selected explicitly
		const rows = (await SELECT.from(table.name)
			.columns("*", ...table.binaryColumns)
			.where(rowsOf(table, organizationId))) as Record<string, unknown>[];
		for (const row of rows) {
			for (const column of table.binaryColumns) {
				const content = await toBuffer(row[column]);
				row[column] = null;
				if (content?.length) {
					const extension = extensions.get(detectDocumentType(content) ?? "") ?? "bin";
					const path = `documents/${table.name}/${String(row.ID)}-${column}.${extension}`;
					files[path] = content;
					row[column] = path;
					manifest.documents++;
				}
			}
		}
		files[`data/${table.name}.json`] = json(rows);
		manifest.tables[table.name] = rows.length;
	}
	files["manifest.json"] = json(manifest);
	return Buffer.from(zipSync(files, { level: 6 }));
}

/** The organization's tables, parents before children. */
export function organizationTables(): OrganizationTable[] {
	const definitions = cds.model?.definitions as unknown as Record<string, Definition>;
	const persisted = Object.entries(definitions).filter(
		([name, definition]) =>
			name.startsWith("swiver.") &&
			definition.kind === "entity" &&
			!definition.query &&
			!definition.projection &&
			!definition["@cds.persistence.skip"] &&
			!definition["@cds.persistence.exists"] &&
			!name.endsWith(".texts"),
	);
	const owned = (definition?: Definition) => Boolean(definition?.elements?.organization);
	const tables: OrganizationTable[] = [];
	for (const [name, definition] of persisted) {
		const binaryColumns = Object.entries(definition.elements ?? {})
			.filter(([, element]) => element.type === "cds.LargeBinary" && !element.value && !element.virtual)
			.map(([column]) => column);
		if (owned(definition)) {
			tables.push({ binaryColumns, name });
			continue;
		}
		const parent = Object.entries(definition.elements ?? {}).find(
			([column, element]) =>
				element.isAssociation &&
				element.keys &&
				element.target &&
				column !== "organization" &&
				owned(definitions[element.target]),
		);
		if (parent) {
			tables.push({
				binaryColumns,
				name,
				parent: { foreignKey: `${parent[0]}_ID`, target: parent[1].target as string },
			});
		}
	}
	return tables.sort((first, second) => Number(Boolean(first.parent)) - Number(Boolean(second.parent)));
}

function json(value: unknown): Uint8Array {
	return Buffer.from(JSON.stringify(value, null, 2));
}

function rowsOf(table: OrganizationTable, organizationId: string) {
	if (!table.parent) {
		return { organization_ID: organizationId };
	}
	return {
		[table.parent.foreignKey]: {
			in: SELECT("ID").from(table.parent.target).where({ organization_ID: organizationId }),
		},
	};
}

/** LargeBinary values arrive as stream, buffer or (SQLite) base64 string. */
async function toBuffer(value: unknown): Promise<Buffer | undefined> {
	if (value === null || value === undefined) {
		return undefined;
	}
	if (typeof value === "string") {
		return Buffer.from(value, "base64");
	}
	if (value instanceof Readable) {
		const chunks: Buffer[] = [];
		for await (const chunk of value) {
			chunks.push(Buffer.from(chunk as Buffer));
		}
		return Buffer.concat(chunks);
	}
	return Buffer.from(value as Uint8Array);
}
