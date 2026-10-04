# End-to-end test case: from a new organization to the tax advisor export

Manual test of the complete business flow in hybrid mode (local app, HANA database). Every step has sample
data and the expected result. Write down the result (OK / bug + screenshot) next to each step.

## 0. Preparation

|        |                                                                                              |
| ------ | -------------------------------------------------------------------------------------------- |
| Start  | `export PATH="/opt/homebrew/opt/node@24/bin:$PATH"` then `npm run watch-hybrid`              |
| Open   | http://localhost:4004/launchpad.html                                                         |
| Log in | user `tester`, password `tester` (has the Swiver role, no organization yet)                  |
| Date   | Steps use October 2026; replace with the current month if you test later                     |
| Schema | The HANA schema must be up to date: `npx cds deploy --to hana:swiver-db --production` (once) |

**E-mail warning:** hybrid mode uses the Microsoft Graph credentials from your local `.env`. Every e-mail
action (send invoice, reminder, invitation) sends a **real** e-mail. Use only addresses you own.

Test files to prepare:

- `test-invoice.pdf` — any small PDF (e.g. a scanned bill)
- `logo.png` — any PNG image
- `not-a-pdf.pdf` — a text file renamed to `.pdf` (for the negative test)

---

## 1. Create the organization (Dashboard)

| Field               | Value                |
| ------------------- | -------------------- |
| Company name        | Testfirma Rhein GmbH |
| Country             | DE                   |
| Currency            | EUR                  |
| VAT ID              | DE298765432          |
| Default VAT rate    | 19                   |
| Payment term (days) | 14                   |
| Invoice prefix      | RE                   |

Expected: the dashboard switches from "Welcome to Swiver" to the key figures (all 0). Settings show
"Testfirma Rhein GmbH", role Owner. 11 default expense categories exist (Expense Categories app).

Negative: log in as a user without the Swiver role → creating an organization is refused (403).

## 2. Complete the company details (Settings)

| Field                     | Value                          |
| ------------------------- | ------------------------------ |
| Owner / managing director | Max Muster                     |
| Street                    | Rheinallee 12                  |
| Postal code / city        | 55116 Mainz                    |
| E-mail                    | buchhaltung@testfirma-rhein.de |
| Phone                     | +49 6131 123456                |
| Website                   | www.testfirma-rhein.de         |
| Tax number                | 26/123/45678                   |
| VAT ID                    | DE298765432                    |
| IBAN                      | DE89 3704 0044 0532 0130 00    |
| BIC                       | COBADEFFXXX                    |
| Bank                      | Commerzbank                    |
| Register court / number   | Amtsgericht Mainz / HRB 12345  |
| Logo                      | `logo.png`                     |

Expected: saved; the _Change History_ section lists the changed fields with user `tester` and a timestamp
(IBAN, BIC, website, …). The logo itself does not appear in the history.

Negative: upload `not-a-pdf.pdf` as logo → "Only PDF, PNG and JPEG …" error, nothing stored.

## 3. Create customers (Customers)

|                    | Customer A           | Customer B             |
| ------------------ | -------------------- | ---------------------- |
| Company            | Muster Software GmbH | Kaffeerösterei Lindner |
| Contact            | Anna Schmidt         | Jonas Lindner          |
| E-mail             | _your own address_   | _your own address_     |
| Street             | Hauptstraße 5        | Am Markt 3             |
| Postal code / city | 10115 Berlin         | 50667 Köln             |
| Country            | DE                   | DE                     |
| VAT ID             | DE123456789          | –                      |

Expected: customer numbers are assigned on save: CUS-1001, CUS-1002.

## 4. Create products and services (Products & Services)

| Code     | Name                 | Unit      | Price  | VAT |
| -------- | -------------------- | --------- | ------ | --- |
| BER-TAG  | SAP Beratung         | day       | 950.00 | 19  |
| SCHULUNG | Schulungsunterlagen  | piece     | 49.90  | 7   |
| PAUSCH   | Reisekostenpauschale | flat rate | 180.00 | 19  |

## 5. Quote → invoice (Sales → Quotes)

New quote for **Muster Software GmbH**, valid 30 days, one item: product _SAP Beratung_, quantity 3.

Expected: the item fills description, unit "day", price 950.00, VAT 19 % as soon as the product is picked;
net 2,850.00 · VAT 541.50 · total 3,391.50; number QUO-2026-0001 on save.

Then: _Mark as sent_ → _Accept_ → _Convert to invoice_.
Expected: a draft sales invoice with the same customer and item opens. **Discard this draft** (do not save),
otherwise it takes number RE-2026-0001 and the numbers below shift by one. Converting again asks for
confirmation ("Convert again").

## 6. Sales invoice with two VAT rates (Sales → Invoices)

New invoice for **Muster Software GmbH**, invoice date 2026-10-05, service period 2026-10-01 – 2026-10-03.

| Pos | Product              | Quantity |
| --- | -------------------- | -------- |
| 1   | SAP Beratung         | 3        |
| 2   | Schulungsunterlagen  | 10       |
| 3   | Reisekostenpauschale | 1        |

Expected while editing (no save needed):

|           | Value                                     |
| --------- | ----------------------------------------- |
| Net 19 %  | 2,850.00 + 180.00 = 3,030.00 → VAT 575.70 |
| Net 7 %   | 499.00 → VAT 34.93                        |
| Net total | 3,529.00                                  |
| VAT total | 610.63                                    |
| Gross     | **4,139.63**                              |
| Due date  | 2026-10-19 (14 days)                      |

Save → number **RE-2026-0001**, status Draft.

## 7. Finalize checks (negative first)

1. Settings: empty the _Website_ field, save. Invoice → _Finalize_.
   Expected: error "Complete your company details in Settings before finalizing: website". Status stays Draft.
2. Settings: enter the website again. Invoice → _Finalize_. Expected: status **Finalized**.
3. Try _Edit_ on the finalized invoice. Expected: not possible ("Finalized invoice financial data cannot be
   modified …").
4. _Finalize_ again (if the button is visible). Expected: refused, number unchanged.

## 8. PDF and e-invoice

1. _Download PDF_ → check layout: logo, address block, three items, VAT lines 19 % and 7 %, footer with
   address, tax IDs and bank.
2. _Download ZUGFeRD_ → save as `RE-2026-0001.pdf`. Validate:
   `./scripts/validate-zugferd.sh RE-2026-0001.pdf` → `valid:`.

## 9. Send (optional, sends a real e-mail)

_Send by e-mail_, recipient: your own address, subject "Rechnung RE-2026-0001".
Expected: status **Sent**; the e-mail arrives with the ZUGFeRD PDF attached.
Without e-mail configuration: use _Mark as sent_ instead.

## 10. Payments

| Step | Action         | Data                                | Expected                                         |
| ---- | -------------- | ----------------------------------- | ------------------------------------------------ |
| 1    | Record payment | 1,000.00, 2026-10-10, "Teilzahlung" | Payment status **Partially paid**, open 3,139.63 |
| 2    | Record payment | 5,000.00                            | Error: exceeds open amount 3,139.63              |
| 3    | Mark as paid   | –                                   | **Paid**, paid 4,139.63, two payments listed     |
| 4    | Reopen         | –                                   | Manual payments removed, **Open** again          |
| 5    | Mark as paid   | –                                   | **Paid**                                         |

## 11. Cancellation and correction

New invoice for **Kaffeerösterei Lindner**, invoice date 2026-10-06: 2 × Schulungsunterlagen.
Expected: net 99.80 · VAT 6.99 · gross 106.79, number RE-2026-0002. Finalize.

Then _Correct_. Expected:

- RE-2026-0002 becomes **Cancelled** and stays unchanged (same number, items, amounts, PDF).
- A new draft opens, linked to RE-2026-0002. Change quantity to 3 (net 149.70 · VAT 10.48 · gross 160.18),
  save → **RE-2026-0003**, finalize.
- _Correct_ on RE-2026-0002 again → refused ("already corrected").
- ZUGFeRD of RE-2026-0003 validates (type 384 = corrected invoice).

## 12. Supplier and supplier invoice (Suppliers, Purchases)

Supplier:

| Field           | Value                       |
| --------------- | --------------------------- |
| Name            | Büro Müller GmbH            |
| Supplier number | SUP-2001                    |
| VAT ID          | DE111222333                 |
| IBAN            | DE02 1001 0010 0000 0000 04 |
| City            | Mainz                       |

Supplier invoice:

| Field              | Value                         |
| ------------------ | ----------------------------- |
| Supplier           | Büro Müller GmbH              |
| Invoice number     | BM-2026-117                   |
| Invoice date / due | 2026-10-02 / 2026-10-16       |
| Net / VAT          | 250.00 / 47.50 (gross 297.50) |
| Expense category   | Office                        |
| Document           | `test-invoice.pdf`            |

Expected: saved as **Open**; document opens. Negative: upload `not-a-pdf.pdf` → refused.
Then _Mark as paid_ → **Paid**. Edit the invoice, change net to 300.00 / VAT 57.00 → status becomes
**Partially paid** (297.50 of 357.00 paid).

## 13. Inbox with an e-invoice (Purchases → Inbox)

Upload the ZUGFeRD file from step 8 (`RE-2026-0001.pdf`) as a new inbox document.
Expected: recognized as ZUGFeRD; invoice number RE-2026-0001, amounts 3,529.00 / 610.63 / 4,139.63 proposed.
_Create supplier invoice_ (pick or create a supplier) → supplier invoice created, document moved to it;
running _Create supplier invoice_ again is refused (already processed).
(Delete this test supplier invoice's payments afterwards or ignore it in the VAT check below.)

## 14. Bank statement (Finance → Bank)

Save as `bank-oktober.csv` (UTF-8):

```csv
Buchungstag;Valuta;Name Zahlungsbeteiligter;IBAN Zahlungsbeteiligter;Verwendungszweck;Betrag;Waehrung
07.10.2026;07.10.2026;Kaffeeroesterei Lindner;DE44500105175407324931;RE-2026-0003;160,18;EUR
08.10.2026;08.10.2026;Buero Mueller GmbH;DE02100100100000000004;BM-2026-117 Restbetrag;-59,50;EUR
09.10.2026;09.10.2026;Stadtwerke Mainz;DE12550500000000123456;Abschlag Oktober;-120,00;EUR
```

| Step                        | Expected                                                                            |
| --------------------------- | ----------------------------------------------------------------------------------- |
| Import                      | 3 imported, 0 duplicates; _Suggest matches_: RE-2026-0003 and BM-2026-117 suggested |
| Confirm RE-2026-0003        | Matched; RE-2026-0003 **Paid** (payment source Bank)                                |
| Confirm BM-2026-117         | Matched; supplier invoice **Paid**                                                  |
| Confirm the same line again | Refused (already matched), no second payment                                        |
| Import the same file again  | 0 imported, 3 duplicates                                                            |
| Stadtwerke line             | stays Unmatched → _Ignore_                                                          |
| Unmatch RE-2026-0003        | Payment removed, invoice open again; confirm again → Paid                           |

## 15. Finance figures (Finance)

VAT overview 2026-10-01 – 2026-10-31. Expected (if you skipped step 13, otherwise add its 610.63 to input VAT):

|            | Value                                                                                         |
| ---------- | --------------------------------------------------------------------------------------------- |
| Output VAT | 610.63 (RE-2026-0001) + 10.48 (RE-2026-0003) = **621.11**; cancelled RE-2026-0002 not counted |
| Input VAT  | 57.00 (BM-2026-117)                                                                           |

_Accountant export_ for October → zip with `sales-invoices.csv`, `supplier-invoices.csv`, `payments.csv`,
`bank-transactions.csv`, `summary.csv` and `purchases/B_ro_M_ller_GmbH-BM-2026-117.pdf` (umlauts are replaced in file names).

Dashboard: receivables/payables, overdue and "due this week" match the invoices above.

## 16. Comments and tax advisor (optional, needs a second user)

Add a comment on RE-2026-0001: "Bitte Leistungszeitraum prüfen". Expected: listed in the comments; the
owner gets a notification e-mail (real e-mail).
Tax advisor: _Settings → Members → Invite_, e-mail of a person you control, role Tax advisor. Accepting
needs that person's login; skip in hybrid mode if you have no second identity.

## 17. Organization data export and isolation

1. As `tester`: open http://localhost:4004/odata/v4/organization/exportOrganizationData()
   → zip with `manifest.json`, `data/*.json` and `documents/` (logo, supplier invoice PDF).
2. Log out, log in as `alice`: none of Testfirma Rhein's customers, invoices or bank lines are visible.
3. As `alice`, open http://localhost:4004/odata/v4/sales/SalesInvoices?$filter=invoiceNumber eq 'RE-2026-0001'
   → empty result.

## 18. Clean up

The test organization stays in the HANA database. To remove it later:
`npx cds bind --exec --profile hybrid -- npx ts-node scripts/delete-organization.ts <organization ID> "Testfirma Rhein GmbH"`
(organization ID: _Settings_ or `…/organization/myOrganization()` as `tester`).
