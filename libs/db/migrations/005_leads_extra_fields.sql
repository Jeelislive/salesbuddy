-- Add website and email_status columns to leads table
ALTER TABLE leads ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS email_status TEXT NOT NULL DEFAULT 'unverified';

CREATE INDEX IF NOT EXISTS leads_email_status_idx ON leads(workspace_id, email_status);
