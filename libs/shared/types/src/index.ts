// ─── Workspace ───────────────────────────────────────────────────────────────

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  plan: string;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  role: string;
  invited_at: string | null;
  accepted_at: string | null;
  created_at: string;
}

// ─── Company ─────────────────────────────────────────────────────────────────

export interface Company {
  id: string;
  workspace_id: string;
  name: string;
  domain: string | null;
  industry: string | null;
  size: string | null;
  location: string | null;
  website: string | null;
  linkedin_url: string | null;
  enriched_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ─── Contact ─────────────────────────────────────────────────────────────────

export interface Contact {
  id: string;
  workspace_id: string;
  company_id: string | null;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  title: string | null;
  linkedin_url: string | null;
  enriched_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ─── Lead ────────────────────────────────────────────────────────────────────

export interface Lead {
  id: string;
  workspace_id: string;
  contact_id: string | null;
  company_id: string | null;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  title: string | null;
  company_name: string | null;
  source: string | null;
  status: string;
  score: number | null;
  notes: string | null;
  tags: string[];
  metadata: Record<string, unknown>;
  assigned_to: string | null;
  enriched_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateLeadInput {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  title?: string;
  company_name?: string;
  source?: string;
  status?: string;
  score?: number;
  notes?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  assigned_to?: string;
}

export interface UpdateLeadInput extends Partial<CreateLeadInput> {}

export interface LeadFilters {
  status?: string;
  source?: string;
  search?: string;
  page?: number;
  limit?: number;
}

// ─── Deal ────────────────────────────────────────────────────────────────────

export interface Deal {
  id: string;
  workspace_id: string;
  contact_id: string | null;
  company_id: string | null;
  lead_id: string | null;
  title: string;
  value: number | null;
  currency: string;
  stage_id: string;
  probability: number | null;
  expected_close_date: string | null;
  owner_id: string | null;
  notes: string | null;
  tags: string[];
  won_at: string | null;
  lost_at: string | null;
  lost_reason: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateDealInput {
  contact_id?: string;
  company_id?: string;
  lead_id?: string;
  title: string;
  value?: number;
  currency?: string;
  stage_id: string;
  probability?: number;
  expected_close_date?: string;
  owner_id?: string;
  notes?: string;
  tags?: string[];
}

export interface UpdateDealInput extends Partial<CreateDealInput> {}

export interface DealFilters {
  stage_id?: string;
  owner_id?: string;
  page?: number;
  limit?: number;
}

// ─── Sequence ────────────────────────────────────────────────────────────────

export interface Sequence {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  status: string;
  created_by: string;
  step_count?: number;
  enrollment_count?: number;
  created_at: string;
  updated_at: string;
}

export interface SequenceStep {
  id: string;
  sequence_id: string;
  workspace_id: string;
  step_number: number;
  type: string;
  subject: string | null;
  body: string;
  delay_days: number;
  delay_hours: number;
  created_at: string;
  updated_at: string;
}

export interface CreateSequenceInput {
  name: string;
  description?: string;
  steps: CreateSequenceStepInput[];
}

export interface CreateSequenceStepInput {
  step_number: number;
  type: string;
  subject?: string;
  body: string;
  delay_days?: number;
  delay_hours?: number;
}

// ─── Enrollment ──────────────────────────────────────────────────────────────

export interface Enrollment {
  id: string;
  workspace_id: string;
  sequence_id: string;
  contact_id: string;
  status: string;
  current_step: number;
  enrolled_at: string;
  completed_at: string | null;
  unsubscribed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface EnrollmentFilters {
  sequence_id?: string;
  status?: string;
  contact_id?: string;
}

// ─── Proposal ────────────────────────────────────────────────────────────────

export interface Proposal {
  id: string;
  workspace_id: string;
  deal_id: string | null;
  contact_id: string | null;
  title: string;
  content: string;
  status: string;
  tracking_token: string;
  sent_at: string | null;
  viewed_at: string | null;
  view_count: number;
  expires_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CreateProposalInput {
  deal_id?: string;
  contact_id?: string;
  title: string;
  content?: string;
  expires_at?: string;
}

// ─── Activity ────────────────────────────────────────────────────────────────

export interface Activity {
  id: string;
  workspace_id: string;
  deal_id: string | null;
  contact_id: string | null;
  lead_id: string | null;
  type: string;
  subject: string | null;
  body: string | null;
  performed_by: string;
  performed_at: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ─── Analytics ───────────────────────────────────────────────────────────────

export interface AnalyticsOverview {
  lead_count: number;
  active_deals: number;
  pipeline_value: number;
  emails_sent_today: number;
  reply_rate: number;
  meetings_booked: number;
}

export interface PipelineStageStats {
  stage_id: string;
  stage_name: string;
  deal_count: number;
  total_value: number;
  avg_probability: number;
}

export interface OutreachStats {
  sequence_id: string;
  sequence_name: string;
  enrolled: number;
  sent: number;
  opened: number;
  replied: number;
  meetings_booked: number;
  open_rate: number;
  reply_rate: number;
}

export interface ForecastEntry {
  stage_name: string;
  weighted_value: number;
  deal_count: number;
}

// ─── Pagination ──────────────────────────────────────────────────────────────

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  has_more: boolean;
}

// ─── API Error ───────────────────────────────────────────────────────────────

export interface ApiError {
  error: string;
  code: string;
}
