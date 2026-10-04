# Product Scope

What the repository implements today, what is only partly there, and what is deliberately left out. Postponed work is marked in the code with `TODO(feature)` (`git grep "TODO(feature)"`).

## Implemented

### Sales

- **Customers**: maintain customers with customer number, contact, tax and bank data; invoice and open-amount balances.
- **Products / Services**: catalogue used on invoice and quote items.
- **Quotes**: draft, send, accept, reject, convert to invoice, PDF, send by e-mail.
- **Sales invoices**: draft, finalize with number range, mark as sent, send by e-mail, cancel, correct (replacement invoice), reopen, duplicate, create customer from the invoice, record payments.
- **Invoice PDF**: generated invoice and quote PDFs with company logo and legal details.
- **ZUGFeRD**: PDF/A-3 with embedded EN 16931 CII XML for finalized invoices, with a built-in check of the required fields.
- **Payment reminders**: send a reminder e-mail for an overdue invoice; reminders are recorded.

### Purchases

- **Suppliers**: maintain and deactivate suppliers; invoice count and open amount per supplier.
- **Supplier invoices**: create, edit, attach the original document (PDF, PNG, JPEG), derived status (open, partially paid, paid, overdue).
- **Incoming documents (inbox)**: upload, process, create a supplier invoice from a document, ignore.
- **Automatic extraction**: invoice data read from embedded ZUGFeRD XML and from PDF text, proposed in the draft; supplier matching.
- **Expense categories**: per organization, with a default list created on onboarding.

### Finance

- **Payments / partial payments**: payments per invoice; payment status and open amount derived from them; mark as paid / open.
- **Bank transactions / matching**: CSV statement import (generic adapter, duplicate detection), match suggestions, confirm, manual match, unmatch, ignore.
- **VAT overview**: estimated VAT of a period from sales and supplier invoices (an estimate, not a tax return).
- **Accountant export**: ZIP of a period with invoices, documents and CSV lists.
- **Dashboard**: receivables, payables, due soon, paid this month, estimated VAT, "Needs Attention" (including missing documents, uncategorized supplier invoices, open comments), onboarding for new users.
- **Tax Advisor workspace** (separate tile, read-only `TaxAdvisorService`): VAT and export of a period, attention counters, and filterable lists of questions, supplier invoices, sales invoices, receipts, bank transactions and payments.

### SaaS / Collaboration

- **Organizations**: onboarding creates the organization, the owner membership, company settings and default expense categories; single-company data is migrated to organization #1 on start.
- **Memberships / invitations**: roles OWNER, ADMIN, MEMBER, TAX_ADVISOR; invitations by e-mail with hashed, expiring, single-use tokens; resend, revoke; acceptance checks the signed-in e-mail; at least one owner is kept.
- **Tax advisor role**: read access to financial data, document downloads, accountant export, VAT overview and comments; no changes.
- **Switching organizations**: users with several memberships switch in Settings; the choice is remembered per membership.
- **Comments / questions**: on sales invoices, supplier invoices, incoming documents and bank transactions; add and resolve; owners and admins are e-mailed when the tax advisor asks a question.
- **Audit trail**: invitations, member removal and role changes, invoice finalize/cancel, payments, bank matches, accountant export, comments; shown in Settings → Activity Log.
- **Settings**: company data, legal and bank details, invoice defaults and number prefixes, logo, members and invitations.
- **Authentication / authorization**: mocked users locally, XSUAA in production; membership roles mapped to CAP roles and enforced with `@restrict` / `@requires`.
- **Tenant / organization isolation**: every query restricted to the user's organization; new records get the user's organization; cross-organization references are rejected.

### Integrations

- **Microsoft Graph e-mail**: invoices, quotes, reminders, invitations and tax advisor questions sent through the `EmailProvider` abstraction; missing configuration gives a clear message.

## Partially Implemented

- **Change history (`@cap-js/change-tracking`)**
  - Already exists: plugin dependency and `change-tracking` configuration in `.cdsrc.json`.
  - Missing: no entity is annotated with `@changelog`, so no change history is recorded or shown.
- **Organization status**
  - Already exists: `Organizations.status` with ACTIVE / SUSPENDED.
  - Missing: SUSPENDED is not evaluated anywhere.
- **Several own organizations per user**
  - Already exists: joining further organizations by invitation and switching between them.
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
- Dedicated Steuerberater client cockpit (`organization-context.ts`, `tax-advisor-service.cds`)
- Comment notifications, mentions, e-mail for unanswered accountant questions (`db/collaboration.cds`)
- Notification preferences per member (`srv/collaboration/comment-email.ts`)

### Integrations

- Secure organization-specific e-mail credentials (`srv/integrations/email/email-provider.ts`)
- Additional e-mail providers (`email-provider.ts`)

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
