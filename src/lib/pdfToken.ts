import 'server-only';
import crypto from 'crypto';

const SECRET = process.env.TELEGRAM_BOT_TOKEN ?? '';
const TTL_MS = 5 * 60 * 1000; // 5 menit cukup buat langsung dibuka

function sign(payload: string): string {
  return crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
}

/** token = invoiceId.expiresAt.signature */
export function generatePdfToken(invoiceId: string): string {
  const expiresAt = Date.now() + TTL_MS;
  const payload = `${invoiceId}.${expiresAt}`;
  const sig = sign(payload);
  return Buffer.from(`${payload}.${sig}`).toString('base64url');
}

export function verifyPdfToken(token: string, invoiceId: string): boolean {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const [tokenInvoiceId, expiresAtStr, sig] = decoded.split('.');
    if (tokenInvoiceId !== invoiceId) return false;

    const expiresAt = Number(expiresAtStr);
    if (!expiresAt || Date.now() > expiresAt) return false;

    const expectedSig = sign(`${tokenInvoiceId}.${expiresAtStr}`);
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig));
  } catch {
    return false;
  }
}