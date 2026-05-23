-- ============================================================
-- SalesBuddy - Email Outreach Schema
-- ============================================================

-- Add scheduling columns to sequence_enrollments
ALTER TABLE sequence_enrollments
  ADD COLUMN IF NOT EXISTS next_send_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS enrollments_next_send_idx
  ON sequence_enrollments(next_send_at)
  WHERE status = 'active';

-- Connected Gmail / Outlook accounts per workspace
CREATE TABLE IF NOT EXISTS email_accounts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
  user_id      UUID NOT NULL,
  email        TEXT NOT NULL,
  provider     TEXT NOT NULL DEFAULT 'gmail',
  refresh_token TEXT NOT NULL,  -- AES-256-GCM encrypted
  token_expiry  TIMESTAMPTZ,
  is_default   BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, email)
);

-- Log every email sent
CREATE TABLE IF NOT EXISTS email_logs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     UUID REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
  enrollment_id    UUID REFERENCES sequence_enrollments(id) ON DELETE SET NULL,
  contact_id       UUID REFERENCES leads(id) ON DELETE SET NULL,
  email_account_id UUID REFERENCES email_accounts(id) ON DELETE SET NULL,
  step_number      INT,
  subject          TEXT,
  status           TEXT NOT NULL DEFAULT 'sent',  -- sent | failed | bounced
  gmail_message_id TEXT,
  error            TEXT,
  sent_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS email_logs_enrollment_idx ON email_logs(enrollment_id);
CREATE INDEX IF NOT EXISTS email_logs_contact_idx    ON email_logs(contact_id);
CREATE INDEX IF NOT EXISTS email_logs_workspace_idx  ON email_logs(workspace_id, sent_at DESC);
