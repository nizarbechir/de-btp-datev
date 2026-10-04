# Backend

One CAP application (modular monolith). Service handlers stay thin: they read the request, call a domain module and return the result.

| Folder                   | Responsibility                                                                             |
| ------------------------ | ------------------------------------------------------------------------------------------ |
| `services/`              | Service definitions (`*.cds`), handler registration (`*.ts`), shared labels (`labels.cds`) |
| `authorization/`         | `@restrict` rules: every entity is filtered by the user's organization                     |
| `organizations/`         | Organization context, tenant guard, onboarding, invitations, tax firms, data export        |
| `collaboration/`         | Comments and questions, audit trail                                                        |
| `sales/`                 | Sales invoices (lifecycle, numbering), quotes, delivery notes, item totals, PDF, e-mails   |
| `purchases/`             | Document inbox, extraction, supplier matching, goods receipt                               |
| `inventory/`             | Stock ledger (bookings, stock levels) and manual bookings                                  |
| `payments/`              | Payment records, paid/open amount and payment status                                       |
| `support/`               | Support tickets: lifecycle, numbering, notification e-mails                                |
| `finance/`               | Bank import, matching, VAT overview, dashboard, accountant export                          |
| `integrations/einvoice/` | ZUGFeRD / Factur-X: `generate`, `extract`, `validate` (CII XML, PDF/A-3)                   |
| `integrations/email/`    | `EmailProvider` and the Microsoft Graph implementation                                     |
| `integrations/bank/`     | Bank CSV adapters                                                                          |
| `integrations/export/`   | CSV and ZIP writers                                                                        |
| `integrations/pdf/`      | PDF text extraction                                                                        |
| `core/`                  | Request helpers and `DomainError`, money, numbering, settings, PDF layout, dates           |

## Services

| Service               | Path                     | Content                                                   |
| --------------------- | ------------------------ | --------------------------------------------------------- |
| `SalesService`        | `/odata/v4/sales`        | Customers, products/services, quotes, sales invoices      |
| `PurchasingService`   | `/odata/v4/purchasing`   | Suppliers, supplier invoices, inbox, expense categories   |
| `FinanceService`      | `/odata/v4/finance`      | Bank transactions, payments, VAT, export, dashboard       |
| `ReportingService`    | `/odata/v4/reporting`    | Sales, purchase and open item reports (read-only)         |
| `OrganizationService` | `/odata/v4/organization` | Organization, members, company settings, onboarding       |
| `InventoryService`    | `/odata/v4/inventory`    | Stock levels and movements, adjustments, supplier returns |
| `ClientService`       | `/odata/v4/clients`      | Client cockpit, cross-client work lists, tax firms        |
| `TaxAdvisorService`   | `/odata/v4/tax-advisor`  | Read-only tax advisor workspace                           |
| `SupportService`      | `/odata/v4/support`      | Support tickets; agents (role SupportAgent) see all       |

## Organization isolation

- After authentication, `organizationMiddleware` resolves the user's membership and stores the organization on the user (`$user.organization`).
- Reads, updates, deletes and bound actions are filtered by `@restrict` (`authorization/authorization.cds`).
- `tenant-guard.ts` sets the organization on new records and rejects references to records of other organizations.
- Domain modules that query the database directly always filter by `requireOrganization()`.

## Conventions

- Amounts are calculated with integer cents (`core/money.ts`), never floating point.
- Business rule violations throw `DomainError` (`core/requests.ts`) with a message key from `i18n/messages.properties`; handlers wrap domain calls in `guarded` / `guardedSubject` and read the bound record with `boundID` / `boundKey`.
- Postponed work is marked `TODO(feature): ...` (`git grep "TODO(feature)"`).
