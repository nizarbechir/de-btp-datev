import { createRequire } from "node:module";
import path from "node:path";

/**
 * The fonts embedded in every invoice PDF. The standard PDF fonts cannot be embedded (PDF/A)
 * and pdfkit measures some of their characters, such as €, with the wrong width.
 */
const fontDirectory = path.join(
	path.dirname(createRequire(__filename).resolve("dejavu-fonts-ttf/package.json")),
	"ttf",
);

export const documentFonts = {
	bold: path.join(fontDirectory, "DejaVuSans-Bold.ttf"),
	regular: path.join(fontDirectory, "DejaVuSans.ttf"),
};
