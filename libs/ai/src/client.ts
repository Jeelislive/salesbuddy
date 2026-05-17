import Anthropic from '@anthropic-ai/sdk';

export const DEFAULT_MODEL = 'claude-sonnet-4-6' as const;

export const DEFAULT_GENERATION_PARAMS = {
  max_tokens: 4096,
  temperature: 0.7,
} as const;

let _anthropic: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (!_anthropic) {
    const apiKey = process.env['ANTHROPIC_API_KEY'];
    if (!apiKey) throw new Error('Missing ANTHROPIC_API_KEY environment variable');
    _anthropic = new Anthropic({ apiKey });
  }
  return _anthropic;
}

export const anthropic = new Proxy({} as Anthropic, {
  get(_, prop) { return (getAnthropic() as any)[prop]; },
});
