# Features and how to test them

Swiver covers the daily finance work of a small company:

- **Money in:** customer → quote → invoice → ZUGFeRD → e-mail → payment → bank match → reminder
- **Money out:** supplier document → inbox → supplier invoice → expense category → payment → bank match
- **Overview:** dashboard, estimated VAT, export for the tax adviser

Every record belongs to one organization; users only ever see their own organization's data.

Start the app with `npm run watch`, open http://localhost:4004/launchpad.html and sign in as `alice` / `alice` unless stated otherwise. API examples use the same user and are collected in [`_requests/_service_get_requests.http`](../_requests/_service_get_requests.http).

## Organizations and onboarding

A user without organization sees a short onboarding form on the dashboard. Creating the organization also creates the owner membership, company settings and default expense categories. Existing single-company data is migrated to organization #1 on startup.

Test:

1. Sign in as `bob` / `bob` (use a private window), fill in company name, VAT rate, payment term, prefix and choose **Create Organization**.
2. Bob's dashboard is empty: Alice's invoices, customers and PDFs are not visible or reachable.
3. Settings → organization → **Members**: owners and admins add users by user ID and role.

```bash
# Bob cannot open Alice's invoice PDF (403)
curl -u bob:bob "localhost:4004/odata/v4/sales/SalesInvoices(ID=44444444-0000-4000-8000-000000000004,IsActiveEntity=true)/SalesService.pdf(download=false)"
```

## Products and services

Reusable lines for invoices and quotes (code, name, unit, price, VAT rate). Choosing one in an item fills description, unit, price and VAT; all values stay editable.

Test: Sales → Products & Services shows _SAP BTP Consulting_, _SAP CAP Development_ and _Architecture Workshop_. In an invoice item, pick _SAP CAP Development_: price 125 per hour and 19 % are filled in, totals update.

## Quotes

Statuses Draft, Sent, Accepted, Rejected; _Expired_ is shown when the validity date has passed. Numbers per organization and year (`QUO-2026-0001`).

Test:

1. Sales → Quotes → **Create**, choose customer _ACME GmbH_, add items, **Save**.
2. **Preview** / **Download PDF**, **Send by E-Mail** (needs e-mail configuration), **Accept** or **Reject**.
3. **Convert to Invoice** opens a new draft invoice with customer, items and texts, dated today with the company payment term. Converting again is refused unless _Convert again_ is ticked.

## Sales invoices

- **Document status:** Draft → Finalized → Sent, or Cancelled. Only drafts can be edited.
- **Payment status:** Open, Partially Paid, Paid; _Overdue_ when the due date has passed and money is still open.
- **Correction:** **Correct** cancels the issued invoice and opens a replacement draft that references it. Issued invoices are never deleted.
- Numbers are given by the backend per organization and year (`INV-2026-0001`).

Test:

1. Sales → Invoices → **Create**, add items, **Save**, then **Finalize**. The invoice can no longer be edited.
2. **Record Payment** with half of the total: status _Partially Paid_, open amount halves. **Mark as Paid** records the rest.
3. **Remove Manual Payments** reopens it; **Correct** creates the replacement draft.
4. Finalizing an invoice without items fails with _Cannot finalize an invoice without items._

## ZUGFeRD

Finalized invoices can be downloaded as ZUGFeRD 2.x (profile EN 16931): a PDF/A-3 with the invoice XML (`factur-x.xml`) embedded. The same module reads ZUGFeRD PDFs received from suppliers.

Test: open a sent invoice, e.g. `INV-2026-0004`, and choose **Download ZUGFeRD**. Missing seller data (e.g. VAT ID) is reported instead of producing an invalid file.

```bash
curl -u alice:alice -o invoice.pdf "localhost:4004/odata/v4/sales/SalesInvoices(ID=44444444-0000-4000-8000-000000000004,IsActiveEntity=true)/SalesService.zugferd(download=true)"
```

Upload `invoice.pdf` to the document inbox (below) to see the data being read back.

## E-mail and reminders

Invoices (with the ZUGFeRD PDF), quotes and payment reminders are sent through Microsoft Graph. The customer's e-mail is the default recipient and can be changed. Sent time, recipient and message ID are stored; reminders are kept with their level and text.

Test: configure the `MS_GRAPH_*` variables (see README), open an overdue invoice and choose **Send Reminder**. Without configuration the action answers _Email provider is not configured._

## Document inbox and expense categories

Upload a PDF, PNG or JPEG before the supplier invoice exists. A ZUGFeRD PDF is read automatically and the supplier is recognized by VAT ID, tax number, IBAN or exact name; otherwise the user enters the data. **Create Supplier Invoice** moves the file to the new invoice and marks the document as processed.

Test:

1. Purchases → Document Inbox → **Upload Document**, attach the `invoice.pdf` from the ZUGFeRD test, **Save**. Invoice number, dates and amounts appear under _Invoice Data_.
2. **Create Supplier Invoice**: values are proposed, choose an expense category, confirm.
3. Purchases → Expense Categories lists the defaults (Software, Office, Travel, …); supplier invoices can be filtered by category.

## Payments, bank import and matching

Payments are records per invoice (manual or from the bank). Bank statements are imported as CSV; identical bookings are never imported twice. Suggestions use, in this order: invoice number in the reference, exact open amount, direction, IBAN, name. A suggestion becomes a payment only after **Confirm Match**.

Test:

1. Finance → Bank Transactions → **Import Bank CSV**, choose [`_requests/sample-bank-statement.csv`](../_requests/sample-bank-statement.csv).
2. Tab **To Confirm**: the ACME payment is suggested for `INV-2026-0004` (invoice number and amount). **Confirm Match**: the invoice becomes _Paid_, the payment appears under Finance → Payments.
3. Import the same file again: 0 imported, 2 duplicates skipped. Confirming a matched transaction again is refused.
4. **Match Manually** links a transaction to any open invoice of the right direction.

## VAT overview and accountant export

Finance → VAT & Accountant Export shows, for a chosen period, net sales and VAT collected, net expenses and input VAT, and the **estimated** VAT position (not a tax return). **Export for Accountant** downloads a ZIP:

```
sales/                  invoice PDFs (ZUGFeRD where possible)
purchases/              supplier documents
sales-invoices.csv  supplier-invoices.csv  payments.csv  bank-transactions.csv  summary.csv
```

```bash
curl -u alice:alice "localhost:4004/odata/v4/finance/vatOverview(fromDate=2026-10-01,toDate=2026-10-31)"
curl -u alice:alice -o export.zip "localhost:4004/odata/v4/finance/accountantExport(fromDate=2026-01-01,toDate=2026-12-31)"
```

## Reports

Reports (one app, also in the Swiver Hub) has three reports, each a list report with analytical tables that group and total in the backend; expanding a group lists its invoices. Excel export is the standard table export.

- **Sales:** revenue of issued invoices (cancelled and drafts left out) by month, customer or product/service; filter by invoice date, customer and product.
- **Purchases:** supplier invoices by month, supplier or expense category; filter by invoice date, supplier and category.
- **Open Items:** receivables and payables in separate tabs, with total open and overdue amounts and the aging buckets not due, 1-30, 31-60 and more than 60 days overdue.

The tax advisor sees the same reports for the organization they advise.

```bash
curl -u alice:alice "localhost:4004/odata/v4/reporting/SalesReport?\$apply=groupby((customerName),aggregate(netAmount))"
```

## Dashboard

Answers who owes you, what you owe, what is overdue or due within 7 days, revenue and expenses this month, estimated VAT, open inbox documents and unmatched bank transactions. **Needs Attention** lists the open to-dos with a link to the right page.

```bash
curl -u alice:alice "localhost:4004/odata/v4/finance/dashboard()"
```

## Not included yet

See [ROADMAP.md](ROADMAP.md) for the missing features and what they need.
