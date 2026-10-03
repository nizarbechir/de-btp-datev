# Roadmap

Features deliberately left out of the MVP, what is needed before building them, and where they plug in. Each is marked in the code with `TODO(feature)` (`git grep "TODO(feature)"`).

## E-invoicing and tax

| Feature                                    | Prerequisites                                                                       | Where it plugs in                                                |
| ------------------------------------------ | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| XRechnung (UBL/CII for public authorities) | Leitweg-ID (buyer reference) and seller electronic address on customers/settings    | `srv/integrations/einvoice` (new writer next to `cii-writer.ts`) |
| Full e-invoice validation                  | KoSIT validator or a Schematron service (Java, so a separate service or build step) | `zugferd.ts` → `validate`                                        |
| Reverse charge, intra-EU, exempt VAT       | VAT category and exemption reason per item; rules agreed with a tax adviser         | `cii-writer.ts`, invoice items, VAT overview                     |
| Several currencies in VAT and dashboard    | Exchange rate source and the reporting currency rule                                | `finance/vat-overview.ts`, `finance/dashboard.ts`                |
| Complete German tax rules, ELSTER (UStVA)  | Tax adviser sign-off; ELSTER certificate and ERiC library or a certified provider   | New `integrations/elster`, based on the VAT overview             |
| Tax adviser review                         | Read-only accountant role (see below)                                               | Finance app                                                      |

## Accounting and exports

| Feature                                         | Prerequisites                                                                       | Where it plugs in                                   |
| ----------------------------------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------- |
| DATEV export (Buchungsstapel)                   | Account mapping per expense category and revenue type, consultant and client number | `finance/accountant-export.ts`, `ExpenseCategories` |
| DATEV cloud (DATEVconnect / Unternehmen online) | DATEV developer account and OAuth app approval                                      | New `integrations/datev`                            |
| Chart of accounts, bookkeeping                  | Decision whether Swiver becomes a bookkeeping tool; SKR03/SKR04 choice              | New domain module; out of MVP scope                 |

## Banking and payments

| Feature                              | Prerequisites                                                                            | Where it plugs in                                                 |
| ------------------------------------ | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Bank-specific CSV formats            | Anonymized sample exports of each bank                                                   | New adapter in `integrations/bank`, registered in `bank-csv.ts`   |
| CAMT.053 import                      | Sample CAMT files; XML parsing is already available                                      | New adapter in `integrations/bank`                                |
| Live bank connection (PSD2)          | Contract with an aggregator (e.g. finAPI, Tink) or a BaFin licence                       | New `integrations/bank` provider feeding `finance/bank-import.ts` |
| Automatic reminders (dunning levels) | Reminder schedule and fees per organization; a scheduler (CAP job or BTP Job Scheduling) | `sales/sales-invoices.ts` → `remind`, `ReminderRecords`           |

## Documents

| Feature                      | Prerequisites                                                                                                    | Where it plugs in                                                                       |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| OCR for scanned/PDF invoices | OCR service (e.g. SAP Document Information Extraction, Azure Document Intelligence) and data-protection approval | `purchases/inbox.ts` → `processDocument`                                                |
| External document storage    | Object store (BTP Object Store / S3) once the database size requires it                                          | `IncomingDocuments.content`, `SupplierInvoices.documentContent`, `CompanySettings.logo` |

## SaaS and users

| Feature                                          | Prerequisites                                                                                | Where it plugs in                                           |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Switching between several organizations          | UI for choosing the organization; the backend already honours the `x-organization-id` header | `organizations/organization-context.ts`, dashboard          |
| Granular permissions, accountant/read-only role  | Role model agreed (who may finalize, pay, export)                                            | `Memberships.role`, `authorization/authorization.cds`       |
| Per-organization e-mail account                  | Secret store (BTP Credential Store) for client secrets; never plain database fields          | `integrations/email/email-provider.ts` → `getEmailProvider` |
| Other e-mail providers (SMTP OAuth, SendGrid, …) | Provider account                                                                             | New class implementing `EmailProvider`                      |
| Subscriptions and billing                        | Payment provider (e.g. Stripe), pricing, terms                                               | New module; `Organizations.status` already exists           |

## Known gaps

- `test/integration/finance-service.test.ts` still targets the pre-split FinanceService and must be rewritten for the four services.
- The ZUGFeRD output has not yet been checked with veraPDF / KoSIT.
