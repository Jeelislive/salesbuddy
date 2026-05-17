import { google } from 'googleapis';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGO = 'aes-256-gcm';

function getKey() {
  const key = process.env['ENCRYPTION_KEY'];
  if (!key || key.length !== 64) throw new Error('ENCRYPTION_KEY must be 32 bytes hex (64 chars)');
  return Buffer.from(key, 'hex');
}

export function encrypt(text: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decrypt(data: string): string {
  const [ivHex, tagHex, encHex] = data.split(':');
  const decipher = createDecipheriv(ALGO, getKey(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  const dec = Buffer.concat([decipher.update(Buffer.from(encHex, 'hex')), decipher.final()]);
  return dec.toString('utf8');
}

export function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env['GOOGLE_CLIENT_ID'],
    process.env['GOOGLE_CLIENT_SECRET'],
    process.env['GOOGLE_REDIRECT_URI'],
  );
}

export function getGmailAuthUrl(state: string): string {
  return getOAuth2Client().generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/gmail.send', 'https://www.googleapis.com/auth/userinfo.email'],
    state,
  });
}

export async function exchangeCode(code: string) {
  const client = getOAuth2Client();
  const { tokens } = await client.getToken(code);
  return tokens;
}

export async function sendGmail(
  encryptedRefreshToken: string,
  to: string,
  subject: string,
  htmlBody: string,
): Promise<string> {
  const client = getOAuth2Client();
  client.setCredentials({ refresh_token: decrypt(encryptedRefreshToken) });

  const gmail = google.gmail({ version: 'v1', auth: client });

  const raw = Buffer.from(
    [
      `To: ${to}`,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=utf-8',
      '',
      htmlBody,
    ].join('\r\n'),
  ).toString('base64url');

  const res = await gmail.users.messages.send({ userId: 'me', requestBody: { raw } });
  return res.data.id!;
}
