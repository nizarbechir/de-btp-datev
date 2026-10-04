# Data retention, privacy and offboarding

Minimum operating rules before companies other than Beytp store financial data in Swiver. This is an
operational baseline, **not legal advice**: the privacy policy, the data processing agreement (DPA) and the
retention periods must be reviewed by a lawyer or data protection officer before external beta onboarding.

## What Swiver stores

Per organization (tenant), all in one SAP HANA Cloud database:

| Data                                                    | Personal data it can contain                                                     |
| ------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Company settings (address, tax IDs, bank details, logo) | owner / managing director names                                                  |
| Members, invitations, audit log, change history         | user IDs (e-mail addresses), who did what and when                               |
| Customers and suppliers                                 | names, addresses, e-mail, phone, IBAN, VAT ID (sole traders are natural persons) |
| Quotes, sales and supplier invoices, payments           | the above, plus amounts and payment behaviour                                    |
| Bank transactions                                       | counterparty names, IBANs, payment references                                    |
| Uploaded documents (supplier invoices, inbox)           | whatever the documents contain                                                   |
| Comments                                                | free text between the company and its tax advisor                                |

Not stored: passwords (login via SAP identity services), bank credentials (statement upload only).

**Where:** SAP BTP Cloud Foundry and SAP HANA Cloud in region `eu22` (Microsoft Azure, Frankfurt,
Germany). E-mails (invoices, reminders, invitations, comment notifications) are sent through Microsoft
Graph from Beytp's Microsoft 365 tenant. Application logs (SAP BTP) contain operation names, record IDs and
error messages, but no document contents or bank data.

## Retention

- The customer is the controller of its financial records and responsible for statutory retention
  (Germany: §147 AO and §14b UStG — invoices and accounting vouchers 8 years, books and annual
  statements 10 years; periods start at the end of the calendar year).
- Swiver never deletes issued invoices: they are cancelled and corrected, and documents stay attached.
- While the contract runs, all data is kept.
- Backups follow docs/backup-restore.md (30 daily, 12 monthly, yearly). Yearly backups are meant for
  Beytp's own retention; for external organizations, deleted data must not survive in yearly backups
  (open point: organization-filtered yearly backups before external beta).

## Customer data export

Owners and admins download everything of their organization at any time:
`GET /odata/v4/organization/exportOrganizationData()` → zip with every record as JSON
(`data/<table>.json`) and every uploaded document and the logo as file (`documents/…`), plus a manifest.
The export is recorded in the audit log. The accountant export (Finance) remains the period-based export
for the tax advisor.

## Offboarding

1. The customer ends the contract; Beytp confirms the end date in writing.
2. The owner downloads the data export (or Beytp sends it). Confirm receipt.
3. **30 days after the end date** (grace period for questions), an operator deletes the organization:
   `npx cds bind --exec --profile hybrid -- npx ts-node scripts/delete-organization.ts <ID> "<exact name>"`.
   This removes all records, documents, change history, members, number ranges and the organization.
   It cannot be undone. Longer storage only on the customer's written request.
4. Remove the customer's users from the BTP subaccount (_Security → Users_) if they have no other access.
5. Deleted data disappears from daily and monthly backups by rotation (at most 12 months).

## Member and account deactivation

- An owner or admin removes the member (Settings → Members). Access ends with the member's next request;
  open invitations can be revoked the same way.
- Records the member created keep `createdBy`/`modifiedBy`, the audit log and the change history: they are
  part of the financial records under retention (GDPR Art. 17(3)(b)). They are not anonymized.
- Users who log in without membership and without the Swiver role collection can do nothing (no data,
  no organization sign-up). Their BTP shadow user can be removed by the subaccount administrator.

## Privacy, DPA and subprocessors (baseline for external beta)

For beta customers, Beytp processes personal data on their behalf (GDPR Art. 28). Before onboarding:

- **DPA** between Beytp and the customer (e.g. based on the Bitkom or GDD template), with the technical and
  organizational measures: organization isolation enforced in the backend, role-based access, encryption
  in transit (TLS) and at rest (SAP HANA Cloud), backups per docs/backup-restore.md, audit log and change
  history, EU data location.
- **Subprocessors:**

  | Subprocessor                                              | Purpose                       | Location             |
  | --------------------------------------------------------- | ----------------------------- | -------------------- |
  | SAP SE (SAP BTP, SAP HANA Cloud, identity services)       | hosting, database, login      | EU (eu22, Frankfurt) |
  | Microsoft (Azure, as SAP's infrastructure provider)       | infrastructure of region eu22 | Germany              |
  | Microsoft Ireland Operations Ltd. (Microsoft 365 / Graph) | sending e-mails               | EU                   |

- **Privacy policy** for the application: controller, purposes, legal bases, data categories above,
  recipients/subprocessors, retention, data subject rights, contact.

Status: the technical parts (export, deletion, deactivation) are implemented; the DPA, privacy policy and
subprocessor list still need legal review and signature.
