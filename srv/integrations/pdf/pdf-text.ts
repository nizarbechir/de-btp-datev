import {
	decodePDFRawStream,
	PDFArray,
	PDFDict,
	PDFDocument,
	PDFName,
	PDFNumber,
	PDFObject,
	PDFRawStream,
} from "pdf-lib";

interface Font {
	/** Bytes per character code: 2 for composite (Type0) fonts, otherwise 1. */
	codeLength: number;
	toUnicode?: Map<number, string>;
}

type Matrix = [number, number, number, number, number, number];
type Operand = Buffer | number | Operand[] | string;

interface TextRun {
	left: number;
	text: string;
	/** The baseline; larger is higher on the page. */
	top: number;
}

/**
 * Reads the machine-readable text of a digital PDF, line by line in reading order (top to bottom,
 * left to right). Text in fonts without a Unicode mapping, and scanned pages, give no usable text.
 * Good enough to find invoice fields; not a layout-faithful text export.
 */
// TODO(feature): vertical writing, rotated pages and Type3 fonts
export async function readPdfText(pdf: Buffer, maxPages = 5): Promise<string[]> {
	const document = await PDFDocument.load(pdf, {
		ignoreEncryption: true,
		throwOnInvalidObject: false,
		updateMetadata: false,
	});
	const lines: string[] = [];
	for (const page of document.getPages().slice(0, maxPages)) {
		const runs: TextRun[] = [];
		const contents = page.node.Contents();
		const streams = contents instanceof PDFArray ? contents.asArray() : contents ? [contents] : [];
		const data = Buffer.concat(
			streams.flatMap((entry) => {
				const stream = document.context.lookup(entry);
				return stream instanceof PDFRawStream
					? [Buffer.from(decodePDFRawStream(stream).decode()), Buffer.from("\n")]
					: [];
			}),
		);
		readContent(document, data, page.node.Resources(), identity, runs, 0);
		lines.push(...toLines(runs));
	}
	return lines;
}

const identity: Matrix = [1, 0, 0, 1, 0, 0];
const maxFormDepth = 5;

function decodeText(value: Operand, font: Font): string {
	if (Array.isArray(value)) {
		// TJ: strings with kerning; a large gap is a word space
		return value
			.map((entry) => (typeof entry === "number" ? (entry < -200 ? " " : "") : decodeText(entry, font)))
			.join("");
	}
	if (!Buffer.isBuffer(value)) {
		return "";
	}
	let text = "";
	for (let index = 0; index + font.codeLength <= value.length; index += font.codeLength) {
		const code = font.codeLength === 2 ? value.readUInt16BE(index) : value[index];
		const mapped = font.toUnicode?.get(code);
		if (mapped !== undefined) {
			text += mapped;
		} else if (font.codeLength === 1) {
			text += winAnsi.get(code) ?? String.fromCharCode(code);
		}
	}
	return text;
}

function multiply(left: Matrix, right: Matrix): Matrix {
	return [
		left[0] * right[0] + left[1] * right[2],
		left[0] * right[1] + left[1] * right[3],
		left[2] * right[0] + left[3] * right[2],
		left[2] * right[1] + left[3] * right[3],
		left[4] * right[0] + left[5] * right[2] + right[4],
		left[4] * right[1] + left[5] * right[3] + right[5],
	];
}

function readContent(
	document: PDFDocument,
	data: Buffer,
	resources: PDFDict | undefined,
	baseMatrix: Matrix,
	runs: TextRun[],
	depth: number,
) {
	const fonts = new Map<string, Font>();
	const fontDict = resources?.lookupMaybe(PDFName.of("Font"), PDFDict);
	const xObjects = resources?.lookupMaybe(PDFName.of("XObject"), PDFDict);
	let ctm = baseMatrix;
	const stack: Matrix[] = [];
	let lineMatrix: Matrix = identity;
	let textMatrix: Matrix = identity;
	let font: Font = { codeLength: 1 };
	const operands: Operand[] = [];

	const show = (value: Operand) => {
		const text = decodeText(value, font);
		if (text.trim()) {
			const position = multiply(textMatrix, ctm);
			runs.push({ left: position[4], text, top: position[5] });
		}
	};
	const moveLine = (tx: number, ty: number) => {
		lineMatrix = multiply([1, 0, 0, 1, tx, ty], lineMatrix);
		textMatrix = lineMatrix;
	};

	for (const token of tokenize(data)) {
		if (typeof token === "string" && token.startsWith("op:")) {
			const operator = token.slice(3);
			const numbers = operands.map((operand) => (typeof operand === "number" ? operand : 0));
			switch (operator) {
				case '"':
				case "'":
					moveLine(0, -12);
					show(operands.at(-1) ?? "");
					break;
				case "BT":
					lineMatrix = identity;
					textMatrix = identity;
					break;
				case "cm":
					ctm = multiply(numbers.slice(-6) as Matrix, ctm);
					break;
				case "Do": {
					const name = operands.at(-1);
					const form = typeof name === "string" ? xObjects?.lookup(PDFName.of(name.slice(1))) : undefined;
					if (form instanceof PDFRawStream && depth < maxFormDepth) {
						const subtype = form.dict.lookup(PDFName.of("Subtype"));
						if (subtype === PDFName.of("Form")) {
							const matrix = form.dict.lookupMaybe(PDFName.of("Matrix"), PDFArray);
							const formMatrix = matrix
								? (matrix.asArray().map((entry) => (entry instanceof PDFNumber ? entry.asNumber() : 0)) as Matrix)
								: identity;
							readContent(
								document,
								Buffer.from(decodePDFRawStream(form).decode()),
								form.dict.lookupMaybe(PDFName.of("Resources"), PDFDict) ?? resources,
								multiply(formMatrix, ctm),
								runs,
								depth + 1,
							);
						}
					}
					break;
				}
				case "q":
					stack.push(ctm);
					break;
				case "Q":
					ctm = stack.pop() ?? ctm;
					break;
				case "T*":
					moveLine(0, -12);
					break;
				case "Td":
				case "TD":
					moveLine(numbers.at(-2) ?? 0, numbers.at(-1) ?? 0);
					break;
				case "Tf": {
					const name = operands.at(-2);
					if (typeof name === "string" && fontDict) {
						const key = name.slice(1);
						if (!fonts.has(key)) {
							fonts.set(key, readFont(fontDict.lookup(PDFName.of(key))));
						}
						font = fonts.get(key) ?? font;
					}
					break;
				}
				case "Tj":
				case "TJ":
					show(operands.at(-1) ?? "");
					break;
				case "Tm":
					lineMatrix = numbers.slice(-6) as Matrix;
					textMatrix = lineMatrix;
					break;
			}
			operands.length = 0;
			continue;
		}
		operands.push(token);
	}
}

/** Text runs grouped into lines (same baseline), top to bottom and left to right. */
function toLines(runs: TextRun[]): string[] {
	const sorted = runs
		.map((run, order) => ({ ...run, order }))
		.sort((first, second) => second.top - first.top || first.order - second.order);
	const lines: (TextRun & { order: number })[][] = [];
	for (const run of sorted) {
		const line = lines.at(-1);
		if (line && Math.abs(line[0].top - run.top) <= 2) {
			line.push(run);
		} else {
			lines.push([run]);
		}
	}
	return lines
		.map((line) =>
			line
				.sort((first, second) => first.left - second.left || first.order - second.order)
				.map((run) => run.text.trim())
				.join(" ")
				.replace(/\s+/g, " "),
		)
		.filter(Boolean);
}

/** The differences of WinAnsiEncoding to Latin-1 that matter for invoices. */
const winAnsi = new Map<number, string>([
	[0x80, "€"],
	[0x84, "„"],
	[0x93, "“"],
	[0x94, "”"],
	[0x96, "–"],
	[0x97, "—"],
]);

/** Parses the bfchar and bfrange sections of a ToUnicode CMap. */
function parseToUnicode(cmap: string): Map<number, string> {
	const map = new Map<number, string>();
	const utf16 = (hex: string) =>
		Buffer.from(hex.length % 4 ? `00${hex}` : hex, "hex")
			.swap16()
			.toString("utf16le");
	for (const section of cmap.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
		for (const [, source, target] of section[1].matchAll(/<([\da-f]+)>\s*<([\da-f]*)>/gi)) {
			map.set(Number.parseInt(source, 16), utf16(target));
		}
	}
	for (const section of cmap.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
		for (const [, low, high, target, list] of section[1].matchAll(
			/<([\da-f]+)>\s*<([\da-f]+)>\s*(?:<([\da-f]+)>|\[([^\]]*)\])/gi,
		)) {
			const start = Number.parseInt(low, 16);
			const end = Math.min(Number.parseInt(high, 16), start + 0xffff);
			if (target !== undefined) {
				const base = Number.parseInt(target.slice(-4), 16);
				const prefix = target.length > 4 ? utf16(target.slice(0, -4)) : "";
				for (let code = start; code <= end; code++) {
					map.set(code, prefix + String.fromCharCode(base + code - start));
				}
			} else {
				[...list.matchAll(/<([\da-f]*)>/gi)].forEach(([, hex], offset) => map.set(start + offset, utf16(hex)));
			}
		}
	}
	return map;
}

function readFont(object: PDFObject | undefined): Font {
	if (!(object instanceof PDFDict)) {
		return { codeLength: 1 };
	}
	const composite = object.lookup(PDFName.of("Subtype")) === PDFName.of("Type0");
	const cmap = object.lookup(PDFName.of("ToUnicode"));
	return {
		codeLength: composite ? 2 : 1,
		toUnicode:
			cmap instanceof PDFRawStream
				? parseToUnicode(Buffer.from(decodePDFRawStream(cmap).decode()).toString("latin1"))
				: undefined,
	};
}

function readLiteral(data: Buffer, start: number): [Buffer, number] {
	const bytes: number[] = [];
	let depth = 1;
	let index = start;
	const escapes = new Map<string, number>([
		["b", 8],
		["f", 12],
		["n", 10],
		["r", 13],
		["t", 9],
	]);
	while (index < data.length) {
		const byte = data[index++];
		if (byte === 0x5c) {
			const next = String.fromCharCode(data[index]);
			if (/[0-7]/.test(next)) {
				let octal = "";
				while (octal.length < 3 && /[0-7]/.test(String.fromCharCode(data[index]))) {
					octal += String.fromCharCode(data[index++]);
				}
				bytes.push(Number.parseInt(octal, 8) & 0xff);
			} else if (next === "\r" || next === "\n") {
				index += next === "\r" && data[index + 1] === 0x0a ? 2 : 1;
			} else {
				bytes.push(escapes.get(next) ?? data[index]);
				index++;
			}
		} else if (byte === 0x28) {
			depth++;
			bytes.push(byte);
		} else if (byte === 0x29) {
			if (--depth === 0) {
				break;
			}
			bytes.push(byte);
		} else {
			bytes.push(byte);
		}
	}
	return [Buffer.from(bytes), index];
}

function skipDictionary(data: Buffer, start: number): number {
	let depth = 0;
	let index = start;
	while (index < data.length) {
		if (data[index] === 0x3c && data[index + 1] === 0x3c) {
			depth++;
			index += 2;
		} else if (data[index] === 0x3e && data[index + 1] === 0x3e) {
			index += 2;
			if (--depth === 0) {
				break;
			}
		} else {
			index++;
		}
	}
	return index;
}

/**
 * Tokens of a content stream: numbers, strings (as bytes), names ("/Name"), arrays and
 * operators ("op:Tj"). Dictionaries and inline images are skipped.
 */
function* tokenize(data: Buffer): Generator<Operand> {
	const stack: Operand[][] = [];
	let index = 0;
	const emit = function* (token: Operand): Generator<Operand> {
		if (stack.length) {
			stack.at(-1)?.push(token);
		} else {
			yield token;
		}
	};
	while (index < data.length) {
		const char = String.fromCharCode(data[index]);
		if (/\s/.test(char)) {
			index++;
		} else if (char === "%") {
			while (index < data.length && data[index] !== 0x0a && data[index] !== 0x0d) {
				index++;
			}
		} else if (char === "(") {
			const [bytes, next] = readLiteral(data, index + 1);
			index = next;
			yield* emit(bytes);
		} else if (char === "<" && data[index + 1] === 0x3c) {
			index = skipDictionary(data, index);
		} else if (char === "<") {
			const end = data.indexOf(0x3e, index);
			const hex = data.toString("latin1", index + 1, end < 0 ? data.length : end).replace(/[^\da-f]/gi, "");
			index = end < 0 ? data.length : end + 1;
			yield* emit(Buffer.from(hex.length % 2 ? `${hex}0` : hex, "hex"));
		} else if (char === "[") {
			stack.push([]);
			index++;
		} else if (char === "]") {
			const array = stack.pop() ?? [];
			index++;
			yield* emit(array);
		} else {
			let end = index + 1;
			while (end < data.length && !/[\s()<>[\]{}/%]/.test(String.fromCharCode(data[end]))) {
				end++;
			}
			const word = data.toString("latin1", index, end);
			index = end;
			if (char === "/") {
				yield* emit(word);
			} else if (/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(word)) {
				yield* emit(Number(word));
			} else if (word === "BI") {
				// inline image: skip to EI
				const end = data.indexOf("EI", index, "latin1");
				index = end < 0 ? data.length : end + 2;
			} else if (!stack.length) {
				yield `op:${word}`;
			}
		}
	}
}
