# Backup and restore

## What has to be backed up

All business data lives in one HDI container (`swiver-db`) on the SAP HANA Cloud instance `swiver-hana`:
organizations, members, settings, customers, suppliers, invoices, payments, bank transactions, comments,
audit log and change history. **Uploaded documents (supplier invoice PDFs/images, inbox documents) and the
company logo are stored in the same database** (`LargeBinary` columns). There is no separate file store,
so a database backup covers all financial documents. Code lists (`db/data`) come with every deployment
and are not part of the backup.

## Platform backups: not available on the free tier

The current deployment uses the SAP HANA Cloud **free tier** (`hana-free`) to avoid paid consumption.
Do not rely on SAP-managed backups or point-in-time recovery for it: check the _Backups_ section of the
instance in SAP HANA Cloud Central, and note that free tier instances are stopped automatically and must be
restarted. Paid HANA Cloud instances include continuous backups with point-in-time recovery; moving to one is
a cost decision, not part of this procedure.

Swiver therefore uses a **logical backup**: `scripts/backup.ts` exports every business table, including
documents (base64), into one zip file with a manifest (row count and SHA-256 per table).

## Backup

Prerequisites: `cf login` to the Swiver org/space and the hybrid binding (`npm run bind-to-services -- default`).

```sh
npm run backup # writes backups/swiver-backup-<timestamp>.zip
```

**Location and retention** (minimum for Beytp productive use):

| Backup  | When                       | Keep                                    |
| ------- | -------------------------- | --------------------------------------- |
| Daily   | every working day          | 30 days                                 |
| Monthly | first backup of each month | 12 months                               |
| Yearly  | first backup of each year  | 10 years (German retention of invoices) |

Store the zip files outside BTP, encrypted (e.g. an encrypted disk image or the company's access-restricted
OneDrive/SharePoint), never in this repository (`backups/` is git-ignored). The files contain personal
and financial data.

Automation: the backup needs a CF login. With SSO users the login expires, so the backup is run by an
administrator (or a scheduled job on an admin machine after `cf login`). An unattended job needs a
technical CF user, which is not set up yet.

## Restore

A restore always goes into an **empty** container and never merges into existing data. It verifies the
checksums before writing and the row counts afterwards.

1. Create an empty container on the same free HANA instance and deploy the schema (no paid service):

   ```sh
   cf create-service hana hdi-shared swiver-db-restore --wait
   npx cds deploy --to hana:swiver-db-restore --production
   # cds deploy re-points the hybrid profile to the new container; point it back to production:
   npx cds bind db --to swiver-db: service key hana-cloud --for hybrid < your > --kind
   ```

2. Bind it under a separate profile and restore:

   ```sh
   cf create-service-key swiver-db-restore restore-key --wait
   npx cds bind db --to swiver-db-restore:restore-key --kind hana-cloud --for restore
   npx cds bind --exec --profile restore -- npx ts-node scripts/restore.ts backups/swiver-backup- < timestamp > .zip
   ```

3. Verify: the script prints the restored row counts. Open a restored supplier invoice document and compare
   it with the original.

4. For a real disaster recovery, restore into a new `swiver-db` container (or point the `swiver-db` resource of
   the MTA to the restored container) and redeploy the application.

Remove a test container afterwards: `cf delete-service-key swiver-db-restore restore-key -f && cf delete-service swiver-db-restore -f`.
