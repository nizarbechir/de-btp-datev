# Swiver

Finance administration for freelancers and small companies: quotes and invoices, supplier invoices, payments, bank matching, estimated VAT and an export for the tax adviser. One deployment serves many organizations, each with strictly separated data.

Built with SAP CAP (Node.js, TypeScript) and SAP Fiori elements.

- What the app does and how to try every feature: [docs/FEATURES.md](docs/FEATURES.md)
- Backend structure: [srv/README.md](srv/README.md)
- UI apps and navigation: [app/README.md](app/README.md)

## Run locally

Requires Node.js 24.

```bash
npm ci
npm run watch
```

Open http://localhost:4004/launchpad.html.

| User    | Password | Purpose                                   |
| ------- | -------- | ----------------------------------------- |
| `alice` | `alice`  | Owner of the demo organization with data  |
| `bob`   | `bob`    | No organization yet: shows the onboarding |

Data is in-memory SQLite, reloaded from `db/data` and `test/data` on every start. Demo dates are shifted to today so overdue and due-soon items always exist.

## Configuration

| Variable                                                                                      | Needed for                                                                                    |
| --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `MS_GRAPH_TENANT_ID`, `MS_GRAPH_CLIENT_ID`, `MS_GRAPH_CLIENT_SECRET`, `MS_GRAPH_SENDER_EMAIL` | Sending invoices, quotes and reminders (Entra ID app with `Mail.Send` application permission) |
| `SWIVER_DEFAULT_ORG_OWNER`                                                                    | User ID that becomes owner of organization #1 when an existing installation is migrated       |

Without the Graph variables the app runs normally; e-mail actions answer "Email provider is not configured." Never commit real values (`.env` is ignored).

## Quality checks

```bash
npm run lint
npm run test:ci
npx cds compile srv app --to edmx-v4 --service all > /dev/null
```

## Deploy

Cloud Foundry via MTA (`mta.yaml`, one `*.mtaext` per stage) and the GitHub Actions workflows in `.github/workflows`.

```bash
npm run build:dev # or build:qas / build:rse / build:prd
npm run deploy
```

Production uses XSUAA and SAP HANA Cloud. Any signed-in user can use the app; their organization membership decides what they see. The five UI apps are published to the HTML5 repository and appear in SAP Build Work Zone through `app/workzone/cdm.json`.

## License

MIT
