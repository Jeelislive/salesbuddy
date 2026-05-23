-- ============================================================
-- SalesBuddy - Initial Schema
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── WORKSPACES ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  plan TEXT NOT NULL DEFAULT 'starter',
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, user_id)
);

-- ─── COMPANIES ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  domain TEXT,
  industry TEXT,
  employee_count INT,
  linkedin_url TEXT,
  technologies TEXT[],
  funding_stage TEXT,
  enrichment_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── LEADS / CONTACTS ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
  company_id UUID REFERENCES companies(id),
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  name TEXT GENERATED ALWAYS AS (first_name || ' ' || last_name) STORED,
  email TEXT,
  phone TEXT,
  title TEXT,
  company_name TEXT,
  source TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  score INT DEFAULT 0 CHECK (score >= 0 AND score <= 100),
  notes TEXT,
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  assigned_to UUID,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS leads_workspace_id_idx ON leads(workspace_id);
CREATE INDEX IF NOT EXISTS leads_status_idx ON leads(workspace_id, status);
CREATE INDEX IF NOT EXISTS leads_email_idx ON leads(workspace_id, email);

-- ─── PIPELINE STAGES ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS pipeline_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  position INT NOT NULL DEFAULT 0,
  probability INT DEFAULT 0,
  stage_type TEXT DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── DEALS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
  stage_id UUID REFERENCES pipeline_stages(id),
  name TEXT NOT NULL,
  amount NUMERIC(12,2) DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  close_date DATE,
  probability INT DEFAULT 0,
  contact_id UUID REFERENCES leads(id),
  company_name TEXT,
  owner_id UUID,
  lost_reason TEXT,
  won_at TIMESTAMPTZ,
  lost_at TIMESTAMPTZ,
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS deals_workspace_id_idx ON deals(workspace_id);
CREATE INDEX IF NOT EXISTS deals_stage_idx ON deals(workspace_id, stage_id);

-- ─── SEQUENCES ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  ai_generated BOOLEAN DEFAULT FALSE,
  created_by UUID,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sequence_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id UUID REFERENCES sequences(id) ON DELETE CASCADE NOT NULL,
  step_number INT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'email',
  delay_days INT NOT NULL DEFAULT 0,
  subject TEXT,
  body TEXT NOT NULL DEFAULT '',
  ai_variables JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sequence_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id UUID REFERENCES sequences(id) ON DELETE CASCADE NOT NULL,
  contact_id UUID REFERENCES leads(id) ON DELETE CASCADE NOT NULL,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  current_step INT DEFAULT 1,
  enrolled_by UUID,
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(sequence_id, contact_id)
);

-- ─── PROPOSALS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
  deal_id UUID REFERENCES deals(id),
  contact_id UUID REFERENCES leads(id),
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  content JSONB NOT NULL DEFAULT '{}',
  total_amount NUMERIC(12,2),
  tracking_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  view_count INT DEFAULT 0,
  viewed_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS proposals_workspace_idx ON proposals(workspace_id);
CREATE INDEX IF NOT EXISTS proposals_tracking_token_idx ON proposals(tracking_token);

-- ─── ACTIVITIES ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL,
  subject TEXT,
  body TEXT,
  occurred_at TIMESTAMPTZ DEFAULT NOW(),
  contact_id UUID REFERENCES leads(id),
  deal_id UUID REFERENCES deals(id),
  user_id UUID,
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS activities_workspace_idx ON activities(workspace_id);
CREATE INDEX IF NOT EXISTS activities_deal_idx ON activities(deal_id);

-- ─── SEED: Default pipeline stages ────────────────────────
-- (Will be created per-workspace on signup, this is just reference data)
