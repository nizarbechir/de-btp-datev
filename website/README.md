# Swiver website

Public landing page for Swiver. It is a static site built with [Astro](https://astro.build) and is independent of the CAP application in the repository root: it has its own `package.json`, lint setup and build.

```bash
cd website
npm ci
npm run dev      # http://localhost:4321
npm run check    # type check
npm run build    # static output in dist/
```

Requires Node.js 22.12 or newer.

## Structure

```
src/
  config/site.ts         URLs, e-mail addresses, operator (not translated)
  config/socialProof.ts  Customer logos, testimonials, customer count (off until real data exists)
  i18n/de.ts             All visible copy, including the sample data in the product visuals
  i18n/index.ts          Locale lookup and money formatting
  styles/tokens.css      Design tokens (color, type, spacing, shadow, motion)
  layouts/Base.astro     <head>: SEO, OpenGraph, Twitter, canonical, font loading, JSON-LD
  components/            Header, Footer, ui/ (Button, Logo, SectionHeader)
  components/product/    The product UI rendered in HTML/CSS (AppFrame, Dashboard, StepVisual)
  components/sections/   One component per page section
  scripts/enhance.ts     Mobile menu, reveal, count-up, active workflow step (progressive)
  pages/                 index, legal placeholders (Impressum, Datenschutz, AGB), 404, robots.txt
public/                  favicon, touch icon, OpenGraph image, web manifest
```

## Editing content

- **Copy** lives only in `src/i18n/de.ts`. Every product statement there is backed by the repository (`README.md`, `docs/ROADMAP.md`, `docs/data-retention-privacy.md`). Before you add a claim, check that the feature is implemented and not listed as `TODO(feature)`.
- **Pricing** (`pricing.plan` in `de.ts`) uses placeholder values: price, trial length and terms must be confirmed.
- **Links** to the app, contact addresses and the status page are in `src/config/site.ts`; values marked `TODO` are placeholders.
- **Social proof** is switched off in `src/config/socialProof.ts`. Only add customers who agreed in writing and quotes they approved verbatim.
- **Legal pages** render a placeholder and are excluded from the sitemap and from indexing until the reviewed texts are added in `src/pages/[legal].astro`.

## Adding a language

1. Create `src/i18n/en.ts` exporting an object typed as `Content`.
2. Register it in `src/i18n/index.ts` and in `locales` in `src/config/site.ts`.
3. Add the locale to `i18n.locales` in `astro.config.mjs` and add `src/pages/en/` pages that call `getContent("en")`.

## Deployment

`npm run build` produces plain static files in `dist/` (HTML, a small amount of CSS, about 2 KB of JS and the self-hosted Inter font). Serve them from any static host or CDN, or on SAP BTP Cloud Foundry with the `staticfile_buildpack`. Set `SITE_URL` at build time to the production origin; it is used for canonical links, the sitemap and OpenGraph URLs.
