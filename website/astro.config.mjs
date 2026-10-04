// @ts-check
import sitemap from "@astrojs/sitemap";
import { defineConfig } from "astro/config";

// The public URL is used for canonical links, OpenGraph images and the sitemap.
// Set SITE_URL in the build environment once the production domain is decided.
const site = process.env.SITE_URL ?? "https://swiver.beytp.com";

export default defineConfig({
	site,
	trailingSlash: "never",
	build: { format: "file", inlineStylesheets: "auto" },
	i18n: {
		locales: ["de"],
		defaultLocale: "de",
		routing: { prefixDefaultLocale: false },
	},
	integrations: [
		sitemap({
			filter: (page) => !/\/(impressum|datenschutz|agb|404)$/.test(page),
		}),
	],
});
