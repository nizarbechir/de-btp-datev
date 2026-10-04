import { defaultLocale, type Locale } from "../config/site";
import { type Content, de } from "./de";

/** Add a locale here (and in `config/site.ts`) with a file that satisfies `Content`. */
const dictionaries: Record<Locale, Content> = { de };

export function getContent(locale: Locale = defaultLocale): Content {
	return dictionaries[locale];
}

export function formatMoney(lang: string, value: number, fractionDigits = 2): string {
	return new Intl.NumberFormat(lang, {
		currency: "EUR",
		maximumFractionDigits: fractionDigits,
		minimumFractionDigits: fractionDigits,
		style: "currency",
	}).format(value);
}

export type { Content };
