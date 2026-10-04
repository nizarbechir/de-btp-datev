import cds, { Request } from "@sap/cds";
import { Readable } from "node:stream";

/**
 * Checks uploaded documents (supplier invoices, inbox documents, company logo) before they are stored:
 * - size limit, configurable as `swiver.documents.maxSizeMB` in the CDS environment (default 10),
 * - the real file type is detected from the content (magic bytes), not from the file name or the
 *   declared media type, and must be one of the allowed types,
 * - file names are reduced to a plain file name (no path, no control or quote characters), so a
 *   user-controlled name can never act as a path or break a Content-Disposition header.
 * TODO(feature): malware scanning of uploaded documents (e.g. SAP Malware Scanning Service) — hook in here.
 */
export type DocumentType = "application/pdf" | "image/jpeg" | "image/png";

export const invoiceDocumentTypes: DocumentType[] = ["application/pdf", "image/png", "image/jpeg"];
export const logoTypes: DocumentType[] = ["image/png", "image/jpeg"];

const defaultMaxSizeMB = 10;

interface UploadFields {
	allowed: DocumentType[];
	content: string;
	fileName?: string;
	mediaType: string;
}

/** The file type from the first bytes of the content, or undefined if it is not a supported type. */
export function detectDocumentType(content: Buffer): DocumentType | undefined {
	if (content.subarray(0, 5).toString("latin1") === "%PDF-") {
		return "application/pdf";
	}
	if (content.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
		return "image/png";
	}
	if (content[0] === 0xff && content[1] === 0xd8 && content[2] === 0xff) {
		return "image/jpeg";
	}
	return undefined;
}

export function maxDocumentBytes(): number {
	const configured = Number(
		(cds.env as { swiver?: { documents?: { maxSizeMB?: number } } }).swiver?.documents?.maxSizeMB,
	);
	return (configured > 0 ? configured : defaultMaxSizeMB) * 1024 * 1024;
}

/** A plain file name for storing and for download headers; undefined if nothing usable is left. */
export function sanitizeFileName(name: unknown): string | undefined {
	if (typeof name !== "string") {
		return undefined;
	}
	const plain = (name.split(/[/\\]/).pop() ?? "")
		// eslint-disable-next-line no-control-regex -- control characters are exactly what is removed
		.replace(/[\u0000-\u001f\u007f"<>|*?:]/g, "")
		.replace(/^\.+/, "")
		.trim()
		.slice(0, 255);
	return plain || undefined;
}

/**
 * Validates the uploaded content of the request (if any) and replaces it by the checked buffer.
 * Rejects with 413 (too large) or 415 (type not allowed, or content does not match the declared type).
 */
export async function validateUpload(req: Request, fields: UploadFields): Promise<void> {
	const data = req.data as Record<string, unknown>;
	if (fields.fileName && fields.fileName in data && data[fields.fileName] !== null) {
		data[fields.fileName] = sanitizeFileName(data[fields.fileName]) ?? null;
	}
	if (!(fields.content in data) || data[fields.content] === null) {
		return;
	}
	const content = await readLimited(data[fields.content], maxDocumentBytes());
	if (!content) {
		return req.reject(413, "DOCUMENT_TOO_LARGE", fields.content, [maxDocumentBytes() / 1024 / 1024]);
	}
	const detected = detectDocumentType(content);
	const declared = data[fields.mediaType] as string | undefined;
	if (!detected || !fields.allowed.includes(detected) || (declared && declared !== detected)) {
		return req.reject(415, "UNSUPPORTED_DOCUMENT_TYPE", fields.content, [declared ?? detected ?? "unknown"]);
	}
	data[fields.content] = content;
	data[fields.mediaType] = detected;
}

/** The content as buffer, or undefined if it is larger than the limit. */
async function readLimited(value: unknown, limit: number): Promise<Buffer | undefined> {
	if (typeof value === "string") {
		const content = Buffer.from(value, "base64");
		return content.length > limit ? undefined : content;
	}
	if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
		return value.length > limit ? undefined : Buffer.from(value);
	}
	const chunks: Buffer[] = [];
	let size = 0;
	for await (const chunk of value as Readable) {
		size += (chunk as Buffer).length;
		if (size > limit) {
			// Discard the rest without buffering it, so the client still receives the 413 response
			(value as Readable).resume();
			return undefined;
		}
		chunks.push(Buffer.from(chunk as Buffer));
	}
	return Buffer.concat(chunks);
}
