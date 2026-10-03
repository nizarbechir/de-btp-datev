# Backend

One CAP application (modular monolith). Service handlers stay thin: they read the request, call a domain module and return the result.

| Folder                   | Responsibility                                                                             |
| ------------------------ | ------------------------------------------------------------------------------------------ |
| `services/`              | Service definitions (`*.cds`), handler registration (`*.ts`), shared labels (`labels.cds`) |
| `authorization/`         | `@restrict` rules: every entity is filtered by the user's organization                     |
| `organizations/`         | Organization context, tenant guard, onboarding, migration of single-company data           |
| `sales/`                 | Sales invoices (lifecycle, numbering), quotes, item totals, PDF data, e-mail texts         |
| `purchases/`             | Document inbox, supplier matching                                                          |
| `payments/`              | Payment records, paid/open amount and payment status                                       |
| `finance/`               | Bank import, matching, VAT overview, dashboard, accountant export                          |
| `integrations/einvoice/` | ZUGFeRD / Factur-X: `generate`, `extract`, `validate` (CII XML, PDF/A-3)                   |
| `integrations/email/`    | `EmailProvider` and the Microsoft Graph implementation                                     |
| `integrations/bank/`     | Bank CSV adapters                                                                          |
| `integrations/export/`   | CSV and ZIP writers                                                                        |
| `core/`                  | Money calculation, numbering, company settings, PDF layout, dates                          |

## Services

| Service               | Path                     | Content                                                 |
| --------------------- | ------------------------ | ------------------------------------------------------- |
| `SalesService`        | `/odata/v4/sales`        | Customers, products/services, quotes, sales invoices    |
| `PurchasingService`   | `/odata/v4/purchasing`   | Suppliers, supplier invoices, inbox, expense categories |
| `FinanceService`      | `/odata/v4/finance`      | Bank transactions, payments, VAT, export, dashboard     |
| `OrganizationService` | `/odata/v4/organization` | Organization, members, company settings, onboarding     |

## Organization isolation

- After authentication, `organizationMiddleware` resolves the user's membership and stores the organization on the user (`$user.organization`).
- Reads, updates, deletes and bound actions are filtered by `@restrict` (`authorization/authorization.cds`).
- `tenant-guard.ts` sets the organization on new records and rejects references to records of other organizations.
- Domain modules that query the database directly always filter by `requireOrganization()`.

## Conventions

- Amounts are calculated with integer cents (`core/money.ts`), never floating point.
- Business rule violations throw `DomainError` with a message key from `i18n/messages.properties`.
- Postponed work is marked `TODO(feature): ...` (`git grep "TODO(feature)"`).
