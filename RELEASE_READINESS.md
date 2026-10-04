# Swiver Release Readiness

State of branch `claude/project-thread-5fcb7l` (PR #25), 2026-10-04.

## Completed tonight

| Issue                                    | Key change                                                                                                                                                                                                                                                                                  | Verification                                                                                                                                                              |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #14 ZUGFeRD validation                   | Repeatable `npm run validate:zugferd` (Mustang 2.17 = veraPDF + XSD + Factur-X EN 16931 Schematron); fixed the item table's unit column wrapping; `docs/zugferd-validation.md`                                                                                                              | 19 % invoice, 19 % + 7 % with three items, correction (384) and 0 % + special characters: PDF/A-3b valid, XML 0 failed rules; PDF inspected visually; 3 integration tests |
| #15 Finalization, numbering, idempotency | Issued invoices locked against direct OData (PATCH, item/tax changes); conditional status changes and row locks; one correction per invoice; payment row lock; DB unique constraints for invoice, quote and customer numbers and bank fingerprints; footer details required before finalize | 14 integration tests (parallel numbering, immutability, repeated actions, parallel payments, double bank match, correction, footer)                                       |
| #17 Organization isolation               | No production gap found; attack suite added                                                                                                                                                                                                                                                 | 54 tests: lists, keys, downloads, $expand/$filter, aggregates, export, header spoofing, mutations, 15 custom actions, references, change history                          |
| #18 Authorization                        | `createOrganization` requires the Swiver role collection (closes open sign-up by any SAP ID account); membership roles unchanged                                                                                                                                                            | 21 tests: tax advisor read-only (13 denied mutations), member limits, owner rights, users without organization                                                            |
| #19 Document security                    | Content-based type detection, configurable size limit (`swiver.documents.maxSizeMB`), safe file names, fixed zip path traversal in the accountant export, malware-scan TODO hook                                                                                                            | 14 tests                                                                                                                                                                  |
| #20 Change tracking                      | Field history for settings (incl. bank details), invoices, payments, bank matches; **fixed a leak** where any user could read any record's history via `…/changes`                                                                                                                          | 5 tests + cross-organization test; HANA triggers deployed successfully to a test container                                                                                |
| #21 Observability                        | `/health/ready` (DB check), CF HTTP health check, JSON logs in production, failure logs for bank, export, e-mail without payloads                                                                                                                                                           | 3 tests                                                                                                                                                                   |
| Review                                   | Supplier invoice payment status now follows corrected amounts; inbox conversion locked; tests no longer use real Graph credentials from `.env`                                                                                                                                              | regression test                                                                                                                                                           |

## Still open

| Issue                 | Exact blocker                                                                                                                                                                                                                                                                                                                                   | Blocks Beytp productive use?                                                            |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| #16 Backup/restore    | Backup verified on production HANA and full backup → restore verified into SQLite; the restore **into HANA** (`swiver-db-restore`, prepared) was blocked by my session's safety rules and must be run by a person (docs/backup-restore.md, steps 2–3). Free tier has no reliable platform backups; unattended backups need a technical CF user. | No, if the manual daily backup is run and one HANA restore is done before relying on it |
| #22 Retention/privacy | Export, offboarding deletion and deactivation implemented and tested; DPA, privacy policy and subprocessor list are a baseline only (legal review/signature); yearly backups are not organization-filtered                                                                                                                                      | No (blocks external beta)                                                               |

## Test results

- Test suite: 136 passed (3 unit, 133 integration in 10 files).
- Lint (`npm run lint`): clean. TypeScript (`tsc --noEmit`): clean.
- Compile (`cds compile srv app --to edmx-v4 --service all`): OK. `cds build --production`: OK; HDI deployment of the new schema (triggers, unique indexes) to a free test container: OK.
- Start: all five services serve `$metadata`, `/health/ready` UP. Startup warnings are pre-existing (fiori-tools-proxy configuration, `resolve()` action name).
- External validators: Mustang/veraPDF all valid (see #14).
- Spell check (`lint:spelling`) reports many pre-existing findings (German terms) and is not a gate.

## Remaining production risks

1. **No platform backup on the HANA free tier**: data loss risk if backups are not run daily (manual today); the HANA restore path is not yet proven.
2. **The free HANA instance stops automatically** and must be restarted; the app is unavailable until then.
3. **The deployed app does not have tonight's changes yet**: redeploy with `free.mtaext` (new tables, triggers, unique indexes).
4. **Work Zone is not live** (Cloud Identity Services subscription failed); the UI runs via the dev app router with direct app URLs, without launchpad navigation.
5. Concurrency safety on HANA relies on row locks and unique constraints; tests ran on SQLite, no load test against HANA.
6. Legal documents for external customers are not finalized (#22).

## Recommendation

**READY WITH KNOWN LIMITATIONS**

For Beytp's own use the financial core is protected in the backend: issued invoices cannot change, numbers are
unique, repeated actions do not duplicate payments, organizations are isolated, and e-invoices validate
externally. The limits are operational: backups are manual and the HANA restore still has to be performed once,
the free HANA instance needs restarts, the latest code must be redeployed, and the UI runs without Work Zone.
Run one backup and one HANA restore before entering real invoices. External customers need #22's legal
documents first.
