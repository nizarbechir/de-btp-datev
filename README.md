# Swiver

Finance administration for freelancers and small companies: customers, quotes, invoices with ZUGFeRD e-invoices, supplier invoices, document inbox, payments, bank matching, stock of goods, estimated VAT, reports and collaboration with the tax advisor. One deployment serves many organizations, each with strictly separated data.

Built with SAP Cloud Application Programming Model (CAP, Node.js, TypeScript) and SAP Fiori elements, deployed to SAP BTP Cloud Foundry with SAP HANA Cloud.

## Contents

- [Features](#features)
- [Architecture](#architecture)
- [Roles and access](#roles-and-access)
- [Getting started](#getting-started)
- [Configuration](#configuration)
- [Development](#development)
- [Deployment](#deployment)
- [Documentation](#documentation)

## Features

Every feature works per organization. Step-by-step test instructions for each one are in [docs/FEATURES.md](docs/FEATURES.md).

### Sales (money in)

| Feature             | What it does                                                                                                                                                                  |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Customers           | Customer master with number, contact, tax and bank data; invoice count and open balance per customer                                                                          |
| Products & services | Catalogue of services and physical goods (unit, sales and purchase price, VAT rate, default supplier); items are prefilled from it                                            |
| Quotes              | Draft, send by e-mail, accept, reject, expiry; PDF; convert to an invoice or a delivery note                                                                                  |
| Sales invoices      | Draft, finalize with gap-free numbers per organization and year, send, cancel, correct (replacement invoice), reopen, duplicate; issued invoices are immutable in the backend |
| Invoice PDF         | German or English layout with logo, legal and bank details, delivery or service date                                                                                          |
| ZUGFeRD / Factur-X  | PDF/A-3 with embedded EN 16931 CII XML, checked for required fields; validated externally with veraPDF and Mustang ([docs/zugferd-validation.md](docs/zugferd-validation.md)) |
| Delivery notes      | Created from a quote, confirmed delivery books the stock out; customer returns book it back                                                                                   |
| Payment reminders   | Reminder e-mail for overdue invoices, recorded with level and text                                                                                                            |

### Purchases (money out)

| Feature              | What it does                                                                                                                         |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Suppliers            | Supplier master, deactivation, invoice count and open amount per supplier                                                            |
| Supplier invoices    | Items or totals, attached original document (PDF, PNG, JPEG), expense category, derived status (open, partially paid, paid, overdue) |
| Document inbox       | Multi-file upload of receipts before the invoice exists; convert to a supplier invoice or ignore                                     |
| Automatic extraction | Reads embedded ZUGFeRD XML and PDF text, proposes the invoice data and matches the supplier by VAT ID, tax number, IBAN or name      |
| Goods receipt        | Books purchased goods into stock, completely or per item and quantity                                                                |
| Expense categories   | Per organization, with a default set created at onboarding                                                                           |

### Finance

| Feature           | What it does                                                                                                                        |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Payments          | Full and partial payments per invoice; paid amount, open amount and payment status are always derived from the payments             |
| Bank import       | CSV statement import with duplicate detection                                                                                       |
| Bank matching     | Suggestions by invoice number, amount, direction, IBAN and name; confirm, manual match, unmatch, ignore                             |
| VAT overview      | Estimated output and input VAT of a period (an estimate, not a tax return)                                                          |
| Accountant export | ZIP of a period with invoice PDFs (ZUGFeRD where possible), supplier documents and CSV lists                                        |
| Dashboard         | Receivables, payables, overdue and due soon, revenue and expenses this month, cash flow, estimated VAT and a "Needs Attention" list |
| Reports           | Analytical sales, purchase and open item reports (aging buckets), grouped and totalled in the backend, with Excel export            |

### Inventory

| Feature       | What it does                                                                                                                       |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Stock ledger  | Append-only stock movements for goods with stock tracking; stock is the sum of movements and can never become negative             |
| Inventory app | Stock levels with reorder level warnings, movement history, stock adjustments (first one is the opening balance), supplier returns |

### Organizations and collaboration

| Feature                  | What it does                                                                                                                                      |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Onboarding               | Creates the organization, owner membership, company settings and default expense categories                                                       |
| Members and invitations  | Roles Owner, Admin, Member, Tax Advisor; e-mail invitations with hashed, expiring, single-use tokens; at least one owner is kept                  |
| Company settings         | Company, legal and bank data, invoice defaults, number prefixes, document language, logo                                                          |
| Comments and questions   | On sales and supplier invoices, inbox documents and bank transactions; owners and admins are e-mailed about tax advisor questions                 |
| Audit trail              | Who did what and when for business-critical actions (finalize, cancel, payments, matches, exports, member changes)                                |
| Change history           | Field-level history for settings, invoices, payments and bank matches (`@cap-js/change-tracking`), readable only with the record                  |
| Data export and deletion | Full organization export as ZIP for owners and admins; deletion at offboarding ([docs/data-retention-privacy.md](docs/data-retention-privacy.md)) |
| Support tickets          | Customers open tickets with attachments and reply; support agents work all tickets; e-mail notifications on every step                            |

### Tax advisors

| Feature               | What it does                                                                                                                |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Tax advisor role      | Read-only access to the financial data of an organization, document downloads, VAT overview, accountant export and comments |
| Tax advisor workspace | One page per client with the period's VAT and export, attention counters and filterable lists of open work                  |
| Client cockpit        | All clients of an advisor with their open work, cross-client work lists, one click to switch client                         |
| Tax firms (Kanzlei)   | Firm with staff and client assignments; each assignment is a normal tax advisor membership the client can see and revoke    |

### Platform

- **Swiver Hub**: one entry point with role-based navigation to every app and a client switcher; locally also the FLP sandbox `launchpad.html`.
- **Organization isolation**: every read, write and action is restricted to the user's organization in the backend; cross-organization references are rejected.
- **E-mail**: Microsoft Graph behind an `EmailProvider` abstraction (invoices, quotes, reminders, invitations, questions, support).
- **Observability**: `/health/ready` with a database check, JSON logs in production, failure logs without payloads.
- **Internationalization**: UI and messages in German and English.

## Architecture

```
app/            Fiori elements apps (one folder per app), Swiver Hub, local launchpad
srv/            CAP services and domain modules (modular monolith)
db/             CDS data model, code lists, reporting views
test/           Jest unit and integration tests, demo data (test/data)
scripts/        Operations scripts (DB deploy, backup/restore, organization deletion, seeding)
docs/           Feature, roadmap and operations documentation
```

- Backend structure, services and conventions: [srv/README.md](srv/README.md)
- UI apps, intents and navigation: [app/README.md](app/README.md)

| Layer          | Technology                                                                            |
| -------------- | ------------------------------------------------------------------------------------- |
| UI             | SAP Fiori elements (OData V4), annotations first; custom extensions only where needed |
| Services       | SAP CAP Node.js with TypeScript, typed models from `cds-typer`                        |
| Persistence    | SQLite in memory locally, SAP HANA Cloud (HDI) on BTP                                 |
| Authentication | Mocked users locally, XSUAA on BTP                                                    |
| Deployment     | MTA on SAP BTP Cloud Foundry, GitHub Actions                                          |

## Roles and access

Access is decided by the user's **membership** in an organization, not by BTP role collections:

| Membership role | Can do                                                                                   |
| --------------- | ---------------------------------------------------------------------------------------- |
| Owner, Admin    | Everything, including members, invitations, company settings and the organization export |
| Member          | Daily work: sales, purchases, finance, inventory, support                                |
| Tax Advisor     | Read financial data, download documents and exports, ask and resolve questions           |

At least one owner is always kept. Two BTP role collections exist in `xs-security.json`: `Swiver_InvoiceManager` (may create an organization) and `Swiver_SupportAgent` (works on all support tickets).

## Getting started

Requires Node.js 24 and npm 11.

```bash
npm ci
npm run watch-swiver # or: npm run watch
```

Open http://localhost:4004/launchpad.html.

| User                       | Password        | Purpose                                       |
| -------------------------- | --------------- | --------------------------------------------- |
| `alice`                    | `alice`         | Owner of the demo organization with data      |
| `bob`                      | `bob`           | No organization yet: shows the onboarding     |
| `tester`                   | `tester`        | Additional user for invitations and tax firms |
| `steuerberater@example.de` | `steuerberater` | Demo tax advisor                              |
| `support`                  | `support`       | Support agent                                 |

Data is in-memory SQLite, reloaded from `db/data` and `test/data` on every start. Demo dates are shifted to today so overdue and due-soon items always exist. API examples are in [`_requests/_service_get_requests.http`](_requests/_service_get_requests.http).

### Hybrid mode

`npm run hybrid` runs locally against the HANA Cloud database on BTP (after `npm run bind-to-services`). When the data model changed, deploy it first with `npm run deploy:db`.

## Configuration

| Variable                                                                                      | Needed for                                                                              |
| --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `MS_GRAPH_TENANT_ID`, `MS_GRAPH_CLIENT_ID`, `MS_GRAPH_CLIENT_SECRET`, `MS_GRAPH_SENDER_EMAIL` | Sending e-mails (Entra ID app with the `Mail.Send` application permission)              |
| `SUPPORT_EMAIL`                                                                               | Mailbox that receives notifications about new support tickets                           |
| `SWIVER_DEFAULT_ORG_OWNER`                                                                    | User ID that becomes owner of organization #1 when an existing installation is migrated |

Without the Graph variables the app runs normally; e-mail actions answer "Email provider is not configured." Locally, invitation links are always printed to the console. Never commit real values (`.env` is ignored).

## Development

| Command                    | Purpose                                             |
| -------------------------- | --------------------------------------------------- |
| `npm run watch`            | Start with live reload                              |
| `npm run lint`             | ESLint for TypeScript, CDS, JSON, YAML and Markdown |
| `npx tsc --noEmit`         | Type check                                          |
| `npm run test:ci`          | Unit tests                                          |
| `npm run test:integration` | Integration tests against the CAP server            |
| `npm run validate:zugferd` | Generate sample e-invoices and validate them        |
| `npm run build:models`     | Regenerate the typed CDS models (`@cds-models`)     |
| `npm run install:safe`     | Install with the supply chain cooldown check        |

Conventions:

- Fiori elements and annotations first; custom UI code only where annotations cannot do it.
- Service handlers stay thin and call domain modules; business rule violations throw `DomainError` with a message key from `i18n/messages.properties`.
- Amounts are calculated in integer cents, never floating point.
- Postponed work is marked `TODO(feature)` (`git grep "TODO(feature)"`).
- Commit messages and PR titles follow Conventional Commits.

## Deployment

SAP BTP Cloud Foundry via MTA (`mta.yaml`, one `*.mtaext` per landscape) and the GitHub Actions workflows in `.github/workflows`.

```bash
npm run build:dev # or build:qas / build:rse / build:prd
npm run deploy
```

Production uses XSUAA and SAP HANA Cloud. The UI apps are published to the HTML5 application repository; SAP Build Work Zone content is in `app/workzone/cdm.json`.

## Documentation

| Document                                                         | Content                                             |
| ---------------------------------------------------------------- | --------------------------------------------------- |
| [docs/FEATURES.md](docs/FEATURES.md)                             | Every feature and how to test it                    |
| [docs/test-case-e2e.md](docs/test-case-e2e.md)                   | End-to-end test case                                |
| [docs/ROADMAP.md](docs/ROADMAP.md)                               | Missing features, prerequisites and open operations |
| [docs/zugferd-validation.md](docs/zugferd-validation.md)         | External e-invoice validation                       |
| [docs/backup-restore.md](docs/backup-restore.md)                 | Logical backup and restore                          |
| [docs/data-retention-privacy.md](docs/data-retention-privacy.md) | Retention, privacy and offboarding                  |
| [docs/npm-cooldown-guide.md](docs/npm-cooldown-guide.md)         | Supply chain protection for npm installs            |

## License

MIT
