import { PAGINATION_DEFAULTS } from '@salesbuddy/shared-constants';

// ─── Pagination Helpers ───────────────────────────────────────────────────────

export function parsePagination(
  page: unknown,
  limit: unknown,
): { page: number; limit: number; offset: number } {
  const parsedPage = Math.max(1, parseInt(String(page ?? PAGINATION_DEFAULTS.PAGE), 10) || 1);
  const parsedLimit = Math.min(
    PAGINATION_DEFAULTS.MAX_LIMIT,
    Math.max(1, parseInt(String(limit ?? PAGINATION_DEFAULTS.LIMIT), 10) || PAGINATION_DEFAULTS.LIMIT),
  );
  return {
    page: parsedPage,
    limit: parsedLimit,
    offset: (parsedPage - 1) * parsedLimit,
  };
}

// ─── Error Helpers ────────────────────────────────────────────────────────────

export function buildApiError(error: string, code: string): { error: string; code: string } {
  return { error, code };
}

// ─── Crypto Helpers ──────────────────────────────────────────────────────────

export function generateToken(length = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

// ─── Date Helpers ────────────────────────────────────────────────────────────

export function nowISO(): string {
  return new Date().toISOString();
}

export function todayStartISO(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

// ─── String Helpers ──────────────────────────────────────────────────────────

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3) + '...';
}
