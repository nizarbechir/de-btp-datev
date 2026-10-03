# Swiver

Swiver helps a small business answer one question: **what do we owe our suppliers, what is paid, what is still open, and what has to be paid soon?**

You record suppliers and their invoices, attach the original PDF or image, and mark invoices as paid. A dashboard shows open, overdue and soon-due amounts at a glance.

## MVP scope

Included:

- **Suppliers**: create, edit, view, search and deactivate (suppliers are deactivated, not deleted, so their invoices stay intact).
- **Supplier invoices**: create, edit, search and filter, with supplier, dates, net, tax and gross amounts (gross = net + tax).
- **Invoice document**: one PDF, PNG or JPEG per invoice, stored in the database, viewable and downloadable.
- **Payment status**: Open or Paid, with "Mark as Paid" (sets today's payment date) and "Mark as Open" (clears it). An unpaid invoice whose due date has passed is shown as **Overdue**.
- **Dashboard**: open invoices, overdue, due in the next 7 days, paid this month, and a "Payments coming up" list.

Explicitly **not** included (future features): customer invoices, quotes, orders, inventory, bookkeeping, DATEV export, bank integration or reconciliation, payment execution, tax filing, OCR or AI extraction, e-invoicing (XRechnung, ZUGFeRD, Peppol), approval workflows, notifications, multi-company and multi-tenancy, external document storage.

One deployed instance serves one company.

## Architecture

A single SAP CAP (Node.js, TypeScript) application with one Fiori Elements app.

```plaintext
├── db/
│   ├── schema.cds              # Suppliers, SupplierInvoices, PaymentStatuses, SupplierBalances view
│   └── data/                   # Code lists: payment statuses, currencies, countries
├── srv/
│   ├── services/
│   │   ├── finance-service.cds              # FinanceService (OData V4 at /odata/v4/finance)
│   │   ├── finance-service-annotations.cds  # Labels, search, read-only payment fields
│   │   └── finance-service.ts               # Mark as Paid/Open, dashboard key figures, document type check
│   ├── authorization/          # One role: InvoiceManager
│   ├── core/                   # Date helpers and demo date shifting
│   └── server.ts               # Development only: moves demo invoice dates to today
├── app/
│   ├── swiver/                 # Fiori Elements app: dashboard (custom page), invoices, suppliers
│   │   └── annotations.cds     # All list, detail, filter and quick view UI annotations
│   └── workzone/cdm.json       # SAP Build Work Zone launchpad content
├── test/
│   ├── data/                   # Demo data: 5 suppliers, 15 invoices
│   ├── unit/                   # Jest unit tests
│   └── integration/            # Jest + cds.test against in-memory SQLite
├── mta.yaml, *.mtaext          # Cloud Foundry deployment per stage
└── xs-security.json            # XSUAA role InvoiceManager
```

Key design choices:

- **Annotations first.** The UI is defined by CDS annotations. The only custom UI code is the dashboard page (`app/swiver/webapp/ext/dashboard`).
- **Overdue is derived, not stored.** `status` (Open / Overdue / Paid) and `grossAmount` are calculated elements, so they are always correct and can be filtered.
- **Validation is declarative.** Required fields use `@mandatory`, and "amounts cannot be negative" and "due date not before invoice date" use `@assert`.
- **Payment fields are read-only** in the UI and API. They change only through the Mark as Paid and Mark as Open actions.
- **Ready for tenants later.** All data lives in one service and model, so a company or tenant key can be added later without restructuring.

## Run locally

Requirements: Node.js 24 (see `engines` in `package.json`).

```bash
npm ci
npm run watch
```

Open http://localhost:4004/swiver.app/index.html and log in as `alice` / `alice` (a mocked user with the `InvoiceManager` role).

Data is kept in memory (SQLite) and reloaded from `db/data` and `test/data` on every restart. In development, demo invoice dates are moved relative to today, so the dashboard always shows overdue and soon-due invoices.

Example API calls are in `_requests/_service_get_requests.http`.

## Test

```bash
npm run build:models     # generate cds-typer types (once, and after model changes)
npm run test:ci          # unit tests
npm run test:integration # service tests against in-memory SQLite
npm run lint
```

## Deploy

Deployment uses the MTA and the GitHub Actions workflows in `.github/workflows` (dev, qas, rse, prd stages via `*.mtaext`).

```bash
npm run build:dev # or build:qas / build:rse / build:prd
npm run deploy    # cf deploy mta_archives/archive.mtar
```

Production uses XSUAA (assign the `Swiver_InvoiceManager` role collection) and SAP HANA Cloud (HDI container `swiver-db`). Only SQLite is used locally for now. The workflows expect these repository variables and secrets: `BTP_API`, `BTP_ORIGIN`, `BTP_SUBACCOUNT`, `BTP_SPACE`, `GH_ACTION_NODEJS_VERSION`, `SAP_BTP_DEPLOYMENT_USER`, `SAP_BTP_DEPLOYMENT_PASSWORD`.

If you use SAP Build Work Zone, add the subaccount's launchpad runtime destination to the destination service in `mta.yaml`.

## License

This project is licensed under the MIT License.
