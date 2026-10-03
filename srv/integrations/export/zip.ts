import { zipSync } from "fflate";

/** Packs files (path → content) into a ZIP archive. */
export function createZip(files: Record<string, Buffer | string>): Buffer {
	const entries: Record<string, Uint8Array> = {};
	for (const [path, content] of Object.entries(files)) {
		entries[path] = typeof content === "string" ? new TextEncoder().encode(content) : new Uint8Array(content);
	}
	return Buffer.from(zipSync(entries, { level: 6 }));
}
