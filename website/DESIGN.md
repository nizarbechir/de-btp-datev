# Swiver landing page: research and design brief

Starting point: the product already exists in `nizarbechir/de-btp-datev` ("Swiver", SAP CAP + Fiori elements on SAP BTP, region eu22 Frankfurt). Every claim on the page is taken from that repository's README, `docs/ROADMAP.md` and `docs/data-retention-privacy.md`. Anything listed there as TODO (XRechnung, DATEV format, live bank connection, OCR, ELSTER, billing) is not advertised.

## 1. References

| Reference | What we take from it |
| --- | --- |
| [Pennylane (DE)](https://www.pennylane.com/de) | Splits the audience into companies and tax firms. Swiver already has a real tax advisor role, client cockpit and Kanzlei model, so it gets its own section and nav entry. |
| [Stripe (DE)](https://stripe.com/de) | Calm German copy, precise stat formatting, a disciplined footer. We do not copy the gradient. |
| [Linear](https://linear.app) | The product UI is the hero: a large, cropped, realistic app frame, alternating text and product sections, very restrained motion. |
| [Mercury](https://mercury.com) | An honest regulatory disclosure placed near the claims. We apply the same idea: "Swiver ist kein Bankinstitut, keine Bankzugangsdaten". |
| [Qonto (DE)](https://qonto.com/de) and [Pleo (DE)](https://www.pleo.io/de) | Short German nav, a story that runs from payment to accounting close. We skip their badge walls because we have no real badges. |
| [sevDesk](https://sevdesk.de) and [Lexware](https://www.lexware.de) | Show what the German market expects: "Sie/du" decision, E-Rechnung messaging, FAQ about compliance, legal footer. They also show what to avoid: discount banners, stacked award badges. |
| [Ramp](https://ramp.com) | Workflow storytelling ("systems that never spoke"). We tell the story as numbered steps tied to real product states. |
| [AstroWind](https://github.com/onwidget/astrowind) (MIT, ~6k stars) | Proves Astro + static output reaches Lighthouse 100. We studied its widget structure but are not adopting it (see 4). |
| [nextjs/saas-starter](https://github.com/nextjs/saas-starter) (MIT, ~16k), [Magic UI](https://github.com/magicuidesign/magicui) (MIT, ~22k) | Both are reviewed and rejected for this page. They bring a database or Stripe stack and Framer Motion, which a marketing page does not need. |

## 2. Visual direction

- **Colors (CSS tokens).** Warm paper `#F6F4EF` and white surfaces. Near-black navy ink `#0B1724` for text and the primary button. Muted text `#556372`. Warm hairlines `#E2DED4`. One accent, a deep fir green `#0B6B58`, used sparingly for positive amounts, focus and the brand mark. Signal colors (amber, red) appear only inside the product UI. The security section turns dark (ink) to change the rhythm.
- **Typography.** Inter Variable, self-hosted, latin and latin-ext only, with the optical size axis. It is excellent with long German compounds and has tabular figures for amounts. One font family, no second dependency. Headlines are 560–600 weight with tight tracking. Body text is 17px/1.6. All amounts use `tabular-nums`.
- **Spacing and grid.** 4px base unit and a 1200px container on 12 columns. Gutters are 24px on desktop and 16px on mobile. Sections are 96–144px apart. Layouts alternate: hero left-aligned with the product frame bleeding right, a sticky narrative, a typographic feature index, a split tax-firm section, a dark security grid, a single pricing panel, and an FAQ in two columns.
- **Visual language.** Hairline borders before shadows. One soft, layered shadow, used only for the product frame. Radius is 6–10px; cards are not the default container. The product visual is built in HTML/CSS from the real dashboard model (`srv/finance/dashboard.ts`): receivables, overdue, revenue and expenses this month, estimated VAT, "Braucht Aufmerksamkeit", recent invoices. It stays crisp at any DPI, translates and costs no image weight.
- **Motion.** A 400ms fade/rise on reveal, a one-time count-up of the hero figures, and the active step highlighted while scrolling the story. Hover and focus transitions only. Everything is off under `prefers-reduced-motion`. Vanilla JS under 2 KB with no animation library.
- **Voice.** "Sie", factual, short sentences. No "revolutionieren", no superlatives, no unverifiable numbers.

## 3. Page architecture

1. **Header**: Funktionen · Steuerkanzleien · Sicherheit · Preise | Anmelden · Kostenlos testen. Becomes a sheet menu on mobile.
2. **Hero**: "Ordnung in Ihren Finanzen. Von der ersten Rechnung bis zur Steuerkanzlei." It has a supporting line, two CTAs, three verifiable facts (Frankfurt hosting, ZUGFeRD/EN 16931, export at any time) and the dashboard frame.
3. **Ablauf**: five steps from quote and invoice, through payment matched, receipts captured and the overview, to the handover to the tax firm. Each step has a UI fragment.
4. **E-Rechnung band**: the legal timeline stated precisely, and what Swiver does today.
5. **Funktionen**: a typographic index in four groups (Verkauf, Einkauf, Finanzen, Lager & Team), not a card grid.
6. **Für Steuerkanzleien**: read-only role, client cockpit, Kanzlei with staff assignments.
7. **Sicherheit & Datenschutz** (dark): hosting location, encryption, organization isolation, roles, audit trail, immutable invoices, export and deletion. It includes a disclosure line.
8. **Preise**: one plan with everything included, plus a note for tax firms. All values live in one content file.
9. **FAQ**: honest answers, including "Ist Swiver GoBD-zertifiziert?", which explains what exists and what does not.
10. **Final CTA and footer**: Produkt · Unternehmen · Ressourcen · Rechtliches (Impressum, Datenschutz, AGB, Kontakt, Status).

The social proof (logo row, testimonials, customer count) is built as components and switched off in the content file until real data exists.

## 4. Reuse decision

**Build it ourselves, borrowing patterns rather than code.** No existing template fits:

- The main app is SAP CAP/UI5, so there is no React or Next.js codebase to share. A Next.js runtime would bring React, hydration and a server for what is a static page.
- AstroWind is good, but it ships 30+ generic widgets, a blog, and Tailwind styling choices we would have to remove. That is more code to delete than to write.
- shadcn and Magic UI components assume React and, in Magic UI's case, Framer Motion.

**Stack:** Astro (static output, zero JS by default, built-in i18n routing and sitemap) with plain CSS custom-property tokens and scoped component styles. There are three dependencies: `astro`, `@astrojs/sitemap` and `@fontsource-variable/inter`. The site lives in `website/` in the app repository, is excluded from the app's lint and CI, and deploys as static files to any host (CF staticfile buildpack, an object store or a CDN).

## 5. Implementation plan

1. Scaffold `website/` with Astro, a token stylesheet, self-hosted Inter, and a base layout with SEO (title, description, canonical, OG/Twitter, favicon, robots.txt, sitemap, JSON-LD `SoftwareApplication`).
2. Put all German copy in `src/i18n/de.ts`, typed so that `en.ts` can be added later. Components only render content.
3. Build the sections as one component each, plus the product UI pieces (`AppFrame`, `Dashboard`, step vignettes) that are actually reused.
4. Add progressive JS: mobile nav, reveal, count-up and step tracking, all respecting reduced motion.
5. Verify: build, Playwright screenshots at 390, 768, 1280 and 1600px, keyboard pass, axe accessibility check and Lighthouse. Then fix what the review finds.
6. Open a PR and publish a preview.
