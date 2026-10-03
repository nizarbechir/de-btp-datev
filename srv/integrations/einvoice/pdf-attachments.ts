import {
	decodePDFRawStream,
	PDFArray,
	PDFDict,
	PDFDocument,
	PDFHexString,
	PDFName,
	PDFRawStream,
	PDFString,
} from "pdf-lib";

/**
 * Reads the files embedded in a PDF (the EmbeddedFiles name tree), e.g. the XML of a ZUGFeRD invoice.
 */
export interface EmbeddedFile {
	content: Buffer;
	name: string;
}

export async function readEmbeddedFiles(pdf: Buffer): Promise<EmbeddedFile[]> {
	const document = await PDFDocument.load(pdf, {
		ignoreEncryption: true,
		throwOnInvalidObject: false,
		updateMetadata: false,
	});
	const names = document.catalog.lookupMaybe(PDFName.of("Names"), PDFDict);
	const tree = names?.lookupMaybe(PDFName.of("EmbeddedFiles"), PDFDict);
	const files: EmbeddedFile[] = [];
	if (tree) {
		collect(tree, files);
	}
	return files;
}

function collect(node: PDFDict, files: EmbeddedFile[]) {
	const entries = node.lookupMaybe(PDFName.of("Names"), PDFArray);
	for (let index = 0; entries && index + 1 < entries.size(); index += 2) {
		const name = entries.lookup(index);
		const spec = entries.lookupMaybe(index + 1, PDFDict);
		const file = spec && readFileSpec(spec, name);
		if (file) {
			files.push(file);
		}
	}
	const kids = node.lookupMaybe(PDFName.of("Kids"), PDFArray);
	for (let index = 0; kids && index < kids.size(); index++) {
		const kid = kids.lookupMaybe(index, PDFDict);
		if (kid) {
			collect(kid, files);
		}
	}
}

function readFileSpec(spec: PDFDict, treeName: unknown): EmbeddedFile | undefined {
	const stream = spec.lookupMaybe(PDFName.of("EF"), PDFDict)?.lookup(PDFName.of("F"));
	if (!(stream instanceof PDFRawStream)) {
		return undefined;
	}
	const fileName = spec.lookup(PDFName.of("UF")) ?? spec.lookup(PDFName.of("F")) ?? treeName;
	const name = fileName instanceof PDFString || fileName instanceof PDFHexString ? fileName.decodeText() : "";
	return { content: Buffer.from(decodePDFRawStream(stream).decode()), name };
}
