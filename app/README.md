# UI apps

Five Fiori elements apps share one backend. Pages are defined by annotations in each app's `annotations.cds`; labels common to all apps come from `srv/services/labels.cds`.

| App       | Intent              | Service      | Pages                                                            |
| --------- | ------------------- | ------------ | ---------------------------------------------------------------- |
| Dashboard | `Dashboard-display` | Finance      | Key figures, needs attention, onboarding (custom page)           |
| Sales     | `Sales-manage`      | Sales        | Invoices, Quotes, Customers, Products & Services                 |
| Purchases | `Purchases-manage`  | Purchasing   | Supplier Invoices, Document Inbox, Suppliers, Expense Categories |
| Finance   | `Finance-manage`    | Finance      | Bank Transactions (matching), Payments, VAT & Accountant Export  |
| Settings  | `Settings-manage`   | Organization | Organization & members, Company Settings                         |

## Navigation

Apps link to each other by intent plus inner route, e.g. `#Sales-manage&/Quotes`. Locally `launchpad.html` (FLP sandbox) provides the tiles; in production SAP Build Work Zone does (`workzone/cdm.json`).

## Custom code

Only where annotations are not enough, and without business logic:

- `dashboard/webapp/ext` – dashboard page and onboarding form
- `sales/webapp/ext/document` – PDF preview/download, ZUGFeRD download, actions that open the new draft invoice
- `sales/webapp/ext/salesInvoice` – totals section
- `finance/webapp/ext` – bank CSV upload, VAT & export page
- `settings/webapp/ext` – link to company settings
