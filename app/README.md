# UI apps

Fiori elements apps share one backend. Pages are defined by annotations in each app's `annotations.cds`; labels common to all apps come from `srv/services/labels.cds`.

| App                 | Folder              | Intent                   | Service      | Pages                                                                        |
| ------------------- | ------------------- | ------------------------ | ------------ | ---------------------------------------------------------------------------- |
| Swiver Hub          | `configuration`     | `Configuration-display`  | Organization | Role-based navigation to all apps, client switcher (custom page)             |
| Dashboard           | `dashboard`         | `Dashboard-display`      | Finance      | Key figures, to do, cash flow chart, open invoices, onboarding (custom page) |
| Sales               | `sales`             | `Sales-manage`           | Sales        | Invoices, Quotes (`Quote-manage`), Delivery Notes                            |
| Purchases           | `purchases`         | `Purchases-manage`       | Purchasing   | Supplier Invoices, Document Inbox (`Inbox-manage`)                           |
| Customers           | `customers`         | `Customer-manage`        | Sales        | Customers                                                                    |
| Products & Services | `products`          | `ProductService-manage`  | Sales        | Products & Services                                                          |
| Inventory           | `inventory`         | `Inventory-manage`       | Inventory    | Stock levels, movements, adjustments, supplier returns                       |
| Suppliers           | `suppliers`         | `Supplier-manage`        | Purchasing   | Suppliers                                                                    |
| Expense Categories  | `expensecategories` | `ExpenseCategory-manage` | Purchasing   | Expense Categories                                                           |
| Finance             | `finance`           | `Finance-manage`         | Finance      | Bank Transactions (matching), Payments, VAT & Accountant Export              |
| Reports             | `reports`           | `Reports-display`        | Reporting    | Sales, Purchases, Open Items (analytical tables, one tab per grouping)       |
| Clients             | `clients`           | `Clients-manage`         | Client       | Client cockpit, tax firms (custom page)                                      |
| Tax Advisor         | `taxadvisor`        | `TaxAdvisor-display`     | TaxAdvisor   | Tax advisor workspace (custom page)                                          |
| Support             | `support`           | `Support-manage`         | Support      | Support tickets                                                              |
| Settings            | `settings`          | `Settings-manage`        | Organization | Organization & members, Company Settings                                     |

Every new app is also added to the Swiver Hub (`configuration/webapp/view/App.view.xml`) and to `launchpad.html`.

## Navigation

Apps link to each other by intent plus inner route, e.g. `#Sales-manage&/Quotes`. Locally `launchpad.html` (FLP sandbox) provides the tiles.

## Custom code

Only where annotations are not enough, and without business logic:

- `configuration/webapp` – the Swiver Hub shell
- `dashboard/webapp/ext` – dashboard page and onboarding form
- `sales/webapp/ext/document` – PDF preview/download, ZUGFeRD download, actions that open the new draft invoice
- `sales/webapp/ext/salesInvoice` – totals section
- `purchases/webapp/ext/inbox` – multi-file upload to the document inbox
- `finance/webapp/ext` – bank CSV upload, VAT & export page
- `reports/webapp/ext` – entry page listing the three reports
- `clients/webapp/ext` – client cockpit
- `taxadvisor/webapp/ext` – tax advisor workspace
- `settings/webapp/ext` – link to company settings
