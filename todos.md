# TODOs

## Clean up the logical backup tooling

Production runs on SAP HANA Cloud, which has its own managed backups and recovery. The logical backup
added for #16 is therefore not needed for production and can be removed later:

- `scripts/backup.ts`, `scripts/restore.ts` (keep `scripts/business-tables.ts` only if still used by
  `scripts/wipe-business-data.ts`)
- `npm run backup` in `package.json`, `backups/` in `.gitignore`
- `docs/backup-restore.md`; adjust `RELEASE_READINESS.md` and `docs/data-retention-privacy.md` (backup
  retention section) to point to the HANA Cloud backups instead
- the test container `swiver-db-restore` in the CF space `swiver`
  (`cf delete-service-key swiver-db-restore swiver-db-restore-key -f && cf delete-service swiver-db-restore -f`)
- close GitHub issue #16 with a note that HANA Cloud backups cover it
