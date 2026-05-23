-- AI Sales Agent tables

CREATE TABLE IF NOT EXISTS agents (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        UUID NOT NULL,
  name                TEXT NOT NULL DEFAULT 'AI Sales Agent',
  status              TEXT NOT NULL DEFAULT 'stopped',   -- active | paused | stopped

  -- Goal config
  icp_query           TEXT,
  target_sequence_id  UUID,
  leads_per_run       INT NOT NULL DEFAULT 10,
  min_lead_score      INT NOT NULL DEFAULT 0,

  -- Permissions
  can_find_leads      BOOLEAN NOT NULL DEFAULT true,
  can_verify_emails   BOOLEAN NOT NULL DEFAULT true,
  can_enroll_leads    BOOLEAN NOT NULL DEFAULT false,

  last_run_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id     UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL,
  action       TEXT NOT NULL,                      -- find_leads | verify_emails | enroll_leads | error
  status       TEXT NOT NULL DEFAULT 'success',    -- success | failed | skipped
  summary      TEXT NOT NULL DEFAULT '',
  details      JSONB NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agent_logs_agent_id_idx ON agent_logs (agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS agents_workspace_id_idx ON agents (workspace_id);
