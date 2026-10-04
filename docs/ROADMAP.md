# Product Scope

What the repository implements today, what is only partly there, and what is deliberately left out. Postponed work is marked in the code with `TODO(feature)` (`git grep "TODO(feature)"`).

## Implemented

See the feature overview in the [README](../README.md#features) and the test instructions in [FEATURES.md](FEATURES.md).

## Partially Implemented

- **Organization status**
  - Already exists: `Organizations.status` with ACTIVE / SUSPENDED.
  - Missing: SUSPENDED is not evaluated anywhere.
- **Several own organizations per user**
  - Already exists: joining further organizations by invitation and switching between them in the Swiver Hub.
  - Missing: creating a second organization is rejected (`ORGANIZATION_EXISTS`, `srv/organizations/onboarding.ts`).
- **Organization selection by header**
  - Already exists: the backend honours the `x-organization-id` header.
  - Missing: no app sends it (switching uses the remembered membership instead).
- **XSUAA role `InvoiceManager`**
  - Already exists: scope and role collection in `xs-security.json`, mocked users, Work Zone role.
  - Missing: services only require an authenticated user; the scope is not checked, and Work Zone has a single role for all apps (the Tax Advisor tile is shown to everyone; the backend blocks members).

## Existing TODO(feature)

### E-invoicing and tax

- XRechnung support (`srv/integrations/einvoice/zugferd.ts`)
- Full schema and Schematron validation, e.g. KoSIT (`zugferd.ts`)
- Reverse charge, intra-community and exempt VAT categories (`cii-writer.ts`)
- VAT per currency (`srv/finance/vat-overview.ts`)
- Complete German tax/accounting rules (`vat-overview.ts`)
- ELSTER / Umsatzsteuervoranmeldung (`vat-overview.ts`)
- Tax adviser review workflow (`vat-overview.ts`)

### Accounting and exports

- DATEV-compatible export (`srv/finance/accountant-export.ts`)
- DATEV cloud integration (`accountant-export.ts`)
- DATEV/account mappings (`db/schema.cds`, ExpenseCategories)
- Full bookkeeping chart of accounts (`db/schema.cds`)

### Banking and payments

- Additional bank-specific CSV adapters (`srv/integrations/bank/bank-csv.ts`)
- CAMT.053 import (`bank-csv.ts`)
- PSD2 / live bank connection (`db/finance.cds`)
- Automatic configurable dunning/reminder schedules (`db/finance.cds`)

### Documents

- AI/OCR extraction for scanned PDFs (`srv/purchases/extraction/index.ts`)
- PDF text: vertical writing, rotated pages, Type3 fonts (`srv/integrations/pdf/pdf-text.ts`)
- External document/object storage (`srv/purchases/inbox.ts`)

### SaaS, users and collaboration

- Subscription/billing system (`srv/organizations/onboarding.ts`)
- Multi-workspace switcher to create further organizations (`onboarding.ts`)
- Granular/custom permissions (`db/organizations.cds`)
- Dedicated accountant permission profiles (`db/organizations.cds`)
- Comment notifications, mentions, e-mail for unanswered accountant questions (`db/collaboration.cds`)
- Notification preferences per member (`srv/collaboration/comment-email.ts`)

### Integrations

- Secure organization-specific e-mail credentials (`srv/integrations/email/email-provider.ts`)
- Additional e-mail providers (`email-provider.ts`)

## Open Operations

- **Backup and restore (#16)**: the logical backup was verified on HANA and restored into SQLite; one restore into HANA (`docs/backup-restore.md`, steps 2–3) still has to be run by a person. The HANA free tier has no reliable platform backups.
- **Legal documents (#22)**: DPA, privacy policy and subprocessor list are a baseline only and need a legal review before external customers are onboarded.
- **Free HANA instance**: stops automatically and must be restarted.
- **SAP Build Work Zone**: not live yet; the UI runs through the app router with direct app URLs.
- **Load test on HANA**: concurrency safety relies on row locks and unique constraints, tested on SQLite only.
- **Logical backup tooling**: once production uses HANA Cloud managed backups, remove `scripts/backup.ts`, `scripts/restore.ts`, `npm run backup`, `docs/backup-restore.md` and the `swiver-db-restore` test container, and close #16.

## Other Existing TODO / FIXME

- No `TODO:`, `FIXME`, "not implemented" or stub methods were found in `srv`, `db` or `app`.
- From the previous roadmap: the ZUGFeRD output has not yet been checked with veraPDF / KoSIT.

## Explicitly Deferred / Not Implemented

Prerequisites and plug-in points for the `TODO(feature)` items above.

| Feature                                   | Prerequisites                                                                       | Where it plugs in                                                                       |
| ----------------------------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| XRechnung                                 | Leitweg-ID (buyer reference) and seller electronic address on customers/settings    | `srv/integrations/einvoice` (writer next to `cii-writer.ts`)                            |
| Full e-invoice validation                 | KoSIT validator or a Schematron service (Java, separate service or build step)      | `zugferd.ts` → `validate`                                                               |
| Reverse charge, intra-EU, exempt VAT      | VAT category and exemption reason per item; rules agreed with a tax adviser         | `cii-writer.ts`, invoice items, VAT overview                                            |
| Several currencies in VAT and dashboard   | Exchange rate source and reporting currency rule                                    | `finance/vat-overview.ts`, `finance/dashboard.ts`                                       |
| Complete German tax rules, ELSTER (UStVA) | Tax adviser sign-off; ELSTER certificate and ERiC library or a certified provider   | New `integrations/elster`, based on the VAT overview                                    |
| DATEV export (Buchungsstapel)             | Account mapping per expense category and revenue type, consultant and client number | `finance/accountant-export.ts`, `ExpenseCategories`                                     |
| DATEV cloud                               | DATEV developer account and OAuth app approval                                      | New `integrations/datev`                                                                |
| Chart of accounts, bookkeeping            | Decision whether Swiver becomes a bookkeeping tool; SKR03/SKR04                     | New domain module                                                                       |
| Bank-specific CSV formats, CAMT.053       | Sample exports of each bank / CAMT files                                            | New adapter in `integrations/bank`, registered in `bank-csv.ts`                         |
| Live bank connection (PSD2)               | Aggregator contract (e.g. finAPI, Tink) or a BaFin licence                          | New `integrations/bank` provider feeding `finance/bank-import.ts`                       |
| Automatic reminders (dunning levels)      | Reminder schedule and fees per organization; a scheduler                            | `sales/sales-invoices.ts`, `ReminderRecords`                                            |
| OCR for scanned invoices                  | OCR service and data-protection approval                                            | `purchases/extraction`                                                                  |
| External document storage                 | Object store once the database size requires it                                     | `IncomingDocuments.content`, `SupplierInvoices.documentContent`, `CompanySettings.logo` |
| Per-organization e-mail account           | Secret store (BTP Credential Store); never plain database fields                    | `integrations/email/email-provider.ts` → `getEmailProvider`                             |
| Other e-mail providers                    | Provider account                                                                    | New class implementing `EmailProvider`                                                  |
| Granular permissions, accountant profiles | Role model agreed (who may finalize, pay, export)                                   | `Memberships.role`, `authorization/authorization.cds`                                   |
| Subscriptions and billing                 | Payment provider, pricing, terms                                                    | New module; `Organizations.status` exists                                               |
