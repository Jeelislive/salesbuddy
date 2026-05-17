import type Anthropic from '@anthropic-ai/sdk';

export interface LeadScoringInput {
  lead: {
    first_name: string;
    last_name: string;
    email: string;
    title?: string | null;
    company_name?: string | null;
    source?: string | null;
    notes?: string | null;
    tags?: string[];
  };
  icp: {
    target_industries?: string[];
    target_roles?: string[];
    target_company_sizes?: string[];
    negative_keywords?: string[];
  };
}

/**
 * Builds the prompt for scoring a lead 0–100 against an ICP definition.
 * Returns a single user MessageParam. Expects JSON response from the model:
 * { "score": number, "reasoning": string, "fit_signals": string[], "risk_signals": string[] }
 */
export function buildLeadScoringPrompt(
  input: LeadScoringInput,
): Anthropic.MessageParam[] {
  const { lead, icp } = input;

  const leadInfo = [
    `Name: ${lead.first_name} ${lead.last_name}`,
    `Email: ${lead.email}`,
    lead.title ? `Title: ${lead.title}` : null,
    lead.company_name ? `Company: ${lead.company_name}` : null,
    lead.source ? `Source: ${lead.source}` : null,
    lead.notes ? `Notes: ${lead.notes}` : null,
    lead.tags?.length ? `Tags: ${lead.tags.join(', ')}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const icpInfo = [
    icp.target_industries?.length
      ? `Target industries: ${icp.target_industries.join(', ')}`
      : null,
    icp.target_roles?.length
      ? `Target roles: ${icp.target_roles.join(', ')}`
      : null,
    icp.target_company_sizes?.length
      ? `Target company sizes: ${icp.target_company_sizes.join(', ')}`
      : null,
    icp.negative_keywords?.length
      ? `Disqualifying keywords: ${icp.negative_keywords.join(', ')}`
      : null,
  ]
    .filter(Boolean)
    .join('\n');

  const message: Anthropic.MessageParam = {
    role: 'user',
    content: `You are a B2B sales qualification expert. Score the following lead from 0 to 100 based on how well they match the Ideal Customer Profile (ICP).

SCORING CRITERIA:
- 80–100: Excellent fit, high priority
- 60–79: Good fit, worth pursuing
- 40–59: Moderate fit, nurture
- 20–39: Weak fit, low priority
- 0–19: Poor fit, disqualify

LEAD INFORMATION:
${leadInfo}

IDEAL CUSTOMER PROFILE:
${icpInfo || 'No specific ICP criteria — use general B2B sales heuristics.'}

Respond ONLY with valid JSON in this exact shape (no markdown, no extra text):
{
  "score": <integer 0-100>,
  "reasoning": "<one paragraph explaining the score>",
  "fit_signals": ["<positive signal 1>", "<positive signal 2>"],
  "risk_signals": ["<concern 1>", "<concern 2>"]
}`,
  };

  return [message];
}
