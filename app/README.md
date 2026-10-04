# UI apps

Fiori elements apps share one backend. Pages are defined by annotations in each app's `annotations.cds`; labels common to all apps come from `srv/services/labels.cds`.

| App                 | Intent                   | Service      | Pages                                                                        |
| ------------------- | ------------------------ | ------------ | ---------------------------------------------------------------------------- |
| Dashboard           | `Dashboard-display`      | Finance      | Key figures, to do, cash flow chart, open invoices, onboarding (custom page) |
| Sales               | `Sales-manage`           | Sales        | Invoices, Quotes                                                             |
| Purchases           | `Purchases-manage`       | Purchasing   | Supplier Invoices, Document Inbox                                            |
| Customers           | `Customer-manage`        | Sales        | Customers                                                                    |
| Products & Services | `ProductService-manage`  | Sales        | Products & Services                                                          |
| Suppliers           | `Supplier-manage`        | Purchasing   | Suppliers                                                                    |
| Expense Categories  | `ExpenseCategory-manage` | Purchasing   | Expense Categories                                                           |
| Finance             | `Finance-manage`         | Finance      | Bank Transactions (matching), Payments, VAT & Accountant Export              |
| Reports             | `Reports-display`        | Reporting    | Sales, Purchases, Open Items (analytical tables, one tab per grouping)       |
| Settings            | `Settings-manage`        | Organization | Organization & members, Company Settings                                     |

## Navigation

Apps link to each other by intent plus inner route, e.g. `#Sales-manage&/Quotes`. Locally `launchpad.html` (FLP sandbox) provides the tiles; in production SAP Build Work Zone does (`workzone/cdm.json`).

## Custom code

Only where annotations are not enough, and without business logic:

- `dashboard/webapp/ext` – dashboard page and onboarding form
- `sales/webapp/ext/document` – PDF preview/download, ZUGFeRD download, actions that open the new draft invoice
- `sales/webapp/ext/salesInvoice` – totals section
- `finance/webapp/ext` – bank CSV upload, VAT & export page
- `reports/webapp/ext` – entry page listing the three reports
- `settings/webapp/ext` – link to company settings
