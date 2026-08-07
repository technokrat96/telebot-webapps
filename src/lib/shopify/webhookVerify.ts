import "server-only";
import crypto from "node:crypto";
import { getShopifyWebhookSecret } from "./config";

/**
 * Verifikasi signature webhook Shopify (header `X-Shopify-Hmac-Sha256`):
 * HMAC-SHA256 dari raw body, di-encode base64, pakai SHOPIFY_WEBHOOK_SECRET
 * (shared secret dari custom app / webhook subscription-nya, lihat README
 * bagian Setup Shopify). Wajib pakai raw body (belum di-JSON.parse) karena
 * signature dihitung dari bytes mentahnya.
 */
export function verifyShopifyWebhook(
  rawBody: string,
  hmacHeader: string | null,
): boolean {
  if (!hmacHeader) return false;

  const secret = getShopifyWebhookSecret();
  const digest = crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("base64");

  const digestBuffer = Buffer.from(digest);
  const headerBuffer = Buffer.from(hmacHeader);
  if (digestBuffer.length !== headerBuffer.length) return false;

  return crypto.timingSafeEqual(digestBuffer, headerBuffer);
}
