// ─── Lead Status ─────────────────────────────────────────────────────────────

export enum LeadStatus {
  NEW = 'new',
  CONTACTED = 'contacted',
  QUALIFIED = 'qualified',
  UNQUALIFIED = 'unqualified',
  CONVERTED = 'converted',
  ARCHIVED = 'archived',
}

// ─── Deal Stage ──────────────────────────────────────────────────────────────

export enum DealStage {
  PROSPECTING = 'prospecting',
  QUALIFICATION = 'qualification',
  PROPOSAL = 'proposal',
  NEGOTIATION = 'negotiation',
  CLOSED_WON = 'closed_won',
  CLOSED_LOST = 'closed_lost',
}

// ─── Sequence Status ─────────────────────────────────────────────────────────

export enum SequenceStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  PAUSED = 'paused',
  ARCHIVED = 'archived',
}

// ─── Enrollment Status ───────────────────────────────────────────────────────

export enum EnrollmentStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  PAUSED = 'paused',
  UNSUBSCRIBED = 'unsubscribed',
  BOUNCED = 'bounced',
}

// ─── Proposal Status ─────────────────────────────────────────────────────────

export enum ProposalStatus {
  DRAFT = 'draft',
  SENT = 'sent',
  VIEWED = 'viewed',
  ACCEPTED = 'accepted',
  DECLINED = 'declined',
  EXPIRED = 'expired',
}

// ─── Activity Type ───────────────────────────────────────────────────────────

export enum ActivityType {
  EMAIL_SENT = 'email_sent',
  EMAIL_OPENED = 'email_opened',
  EMAIL_REPLIED = 'email_replied',
  CALL = 'call',
  MEETING = 'meeting',
  NOTE = 'note',
  STAGE_CHANGE = 'stage_change',
  DEAL_WON = 'deal_won',
  DEAL_LOST = 'deal_lost',
  PROPOSAL_SENT = 'proposal_sent',
  PROPOSAL_VIEWED = 'proposal_viewed',
}

// ─── User Role ───────────────────────────────────────────────────────────────

export enum UserRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  MEMBER = 'member',
  VIEWER = 'viewer',
}

// ─── Sequence Step Type ──────────────────────────────────────────────────────

export enum SequenceStepType {
  EMAIL = 'email',
  WAIT = 'wait',
  TASK = 'task',
  SMS = 'sms',
  LINKEDIN = 'linkedin',
}

// ─── Lead Source ─────────────────────────────────────────────────────────────

export enum LeadSource {
  WEBSITE = 'website',
  REFERRAL = 'referral',
  LINKEDIN = 'linkedin',
  EMAIL = 'email',
  COLD_OUTREACH = 'cold_outreach',
  INBOUND = 'inbound',
  EVENT = 'event',
  OTHER = 'other',
}

// ─── Pagination Defaults ─────────────────────────────────────────────────────

export const PAGINATION_DEFAULTS = {
  PAGE: 1,
  LIMIT: 25,
  MAX_LIMIT: 100,
} as const;

// ─── Queue Names ─────────────────────────────────────────────────────────────

export const QUEUE_NAMES = {
  EMAIL_SEND: 'email-send',
  ENRICHMENT: 'enrichment',
  AI_AGENT: 'ai-agent',
  SEQUENCE: 'sequence-scheduler',
} as const;
