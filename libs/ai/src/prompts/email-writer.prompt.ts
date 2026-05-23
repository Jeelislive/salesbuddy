import type Anthropic from '@anthropic-ai/sdk';

export interface EmailSequenceOptions {
  icp: {
    industry?: string;
    role?: string;
    company_size?: string;
    pain_points?: string[];
  };
  product: {
    name: string;
    value_proposition: string;
    key_features?: string[];
  };
  steps: number;
  tone?: 'professional' | 'conversational' | 'direct';
}

/**
 * Builds the system + user message pair for generating a multi-step cold email sequence.
 * Returns an array of Anthropic MessageParam objects ready to pass to messages.create().
 */
export function buildEmailSequencePrompt(
  options: EmailSequenceOptions,
): Anthropic.MessageParam[] {
  const { icp, product, steps, tone = 'professional' } = options;

  const icpDescription = [
    icp.industry ? `Industry: ${icp.industry}` : null,
    icp.role ? `Target role: ${icp.role}` : null,
    icp.company_size ? `Company size: ${icp.company_size}` : null,
    icp.pain_points?.length
      ? `Pain points: ${icp.pain_points.join(', ')}`
      : null,
  ]
    .filter(Boolean)
    .join('\n');

  const featuresSection = product.key_features?.length
    ? `\nKey features:\n${product.key_features.map((f) => `- ${f}`).join('\n')}`
    : '';

  const systemMessage: Anthropic.MessageParam = {
    role: 'user',
    content: `You are an expert B2B sales copywriter specialising in cold email sequences that convert.
Your output MUST be valid JSON - an array of step objects. Do not wrap in markdown code fences.
Each step object must have these fields:
{
  "step_number": number (1-based),
  "subject": string (email subject line),
  "body": string (email body with {{first_name}} personalisation placeholder),
  "delay_days": number (days to wait after previous step; step 1 = 0),
  "type": "email"
}
Write ${steps} steps. Tone: ${tone}. Be concise, value-driven, and avoid spam trigger words.
IMPORTANT: Do NOT include ANY sign-off, closing line, or signature. No "Best,", "Regards,", "Cheers,", "Thanks,", [Your Name], or [Sender]. End the body immediately after the call-to-action sentence.`,
  };

  const userMessage: Anthropic.MessageParam = {
    role: 'user',
    content: `Generate a ${steps}-step email sequence for the following context:

PRODUCT
Name: ${product.name}
Value proposition: ${product.value_proposition}${featuresSection}

IDEAL CUSTOMER PROFILE
${icpDescription || 'General B2B prospect'}

Return ONLY the JSON array. No explanation, no markdown.`,
  };

  // Anthropic expects alternating user/assistant turns - for a single-turn call
  // we pass one user message combining the system context and the request.
  const combined: Anthropic.MessageParam = {
    role: 'user',
    content: `${systemMessage.content}\n\n---\n\n${userMessage.content}`,
  };

  return [combined];
}
