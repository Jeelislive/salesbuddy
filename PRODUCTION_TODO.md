# Production TODO

## Cron Job 1 - Sequence Processor (cron-job.org)
Sends scheduled emails for active sequence enrollments.

```
POST https://<your-api-domain>/api/v1/cron/process-sequences?secret=49dfbc43ce53d3037faf75ad35a8c467
```
- Frequency: **every 5 minutes**
- Method: POST

## Cron Job 2 - Email Verifier (cron-job.org)
Validates lead email addresses via MX record check before they can be enrolled.
Only leads with `email_status = 'valid'` appear in the Enroll Leads modal.

```
POST https://<your-api-domain>/api/v1/cron/verify-emails?secret=49dfbc43ce53d3037faf75ad35a8c467
```
- Frequency: **every 30 minutes** (or on-demand after importing leads)
- Method: POST
- Processes 100 unverified leads per run

## DB Migration Required on Deploy
Run `libs/db/migrations/003_email_verification.sql` on production Supabase before deploying.
