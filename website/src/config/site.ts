/**
 * Facts and links that are not translated. Everything a visitor reads lives in `src/i18n`.
 * Placeholder values are marked TODO and must be confirmed before going live.
 */
export const site = {
	name: "Swiver",
	operator: "Beytp",
	// TODO: production URLs of the Swiver app (approuter) for sign-up and login.
	appUrl: "https://app.swiver.beytp.com",
	signupUrl: "https://app.swiver.beytp.com",
	loginUrl: "https://app.swiver.beytp.com",
	// TODO: public status page, once one exists.
	statusUrl: "#",
	contactEmail: "kontakt@beytp.com",
	supportEmail: "support@beytp.com",
} as const;

export const locales = ["de"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "de";
