-- Email verification status on leads
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS email_status TEXT NOT NULL DEFAULT 'unverified';
  -- values: 'unverified' | 'valid' | 'invalid'

CREATE INDEX IF NOT EXISTS leads_email_status_idx
  ON leads(workspace_id, email_status)
  WHERE email IS NOT NULL AND deleted_at IS NULL;
