import type Anthropic from '@anthropic-ai/sdk';

export interface ProposalPromptInput {
  deal: {
    title: string;
    value?: number | null;
    currency?: string;
    stage?: string;
    notes?: string | null;
  };
  contact: {
    first_name: string;
    last_name: string;
    title?: string | null;
    company_name?: string | null;
  };
  product: {
    name: string;
    description: string;
    key_benefits?: string[];
    pricing_model?: string;
  };
}

/**
 * Builds the prompt for generating a professional sales proposal in HTML.
 * Returns a single user MessageParam.
 * Expected model response: valid HTML string for the proposal body.
 */
export function buildProposalPrompt(
  input: ProposalPromptInput,
): Anthropic.MessageParam[] {
  const { deal, contact, product } = input;

  const valueStr =
    deal.value != null
      ? `${deal.currency ?? 'USD'} ${deal.value.toLocaleString()}`
      : 'To be discussed';

  const benefitsSection = product.key_benefits?.length
    ? `\nKey benefits:\n${product.key_benefits.map((b) => `- ${b}`).join('\n')}`
    : '';

  const message: Anthropic.MessageParam = {
    role: 'user',
    content: `You are a senior sales executive writing a compelling, professional B2B sales proposal.

DEAL DETAILS:
Title: ${deal.title}
Deal value: ${valueStr}
Notes: ${deal.notes ?? 'None'}

RECIPIENT:
${contact.first_name} ${contact.last_name}${contact.title ? `, ${contact.title}` : ''}${contact.company_name ? ` at ${contact.company_name}` : ''}

PRODUCT / SERVICE:
Name: ${product.name}
Description: ${product.description}${benefitsSection}
Pricing model: ${product.pricing_model ?? 'Custom pricing'}

INSTRUCTIONS:
Write a complete, professional sales proposal as clean HTML (not markdown, not a full HTML page - just the body content using <h1>, <h2>, <p>, <ul>, <table> tags).
The proposal must include:
1. Executive Summary - personalised to the recipient
2. Problem Statement - the challenge their organisation faces
3. Proposed Solution - how ${product.name} solves it
4. Key Benefits & ROI - measurable outcomes
5. Investment - pricing overview (use ${valueStr})
6. Next Steps - clear call to action
7. About Us - brief company credibility statement

Make it persuasive, concise (600–900 words), and personalised using the recipient's name and company.
Return ONLY the HTML content - no explanation, no markdown code fences.`,
  };

  return [message];
}
