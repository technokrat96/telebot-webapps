import 'server-only';

/**
 * Kredensial Shopify diambil dari .env (lihat README bagian "Setup
 * Shopify"). Divalidasi baru saat benar-benar dipakai (bukan di top-level
 * module) supaya build/halaman lain tidak ikut error kalau env var ini
 * belum diisi.
 *
 * Sejak custom app dibuat lewat Dev Dashboard (berlaku per Jan 2026),
 * Shopify tidak lagi menerbitkan token statis langsung dari halaman admin
 * -- yang didapat cuma Client ID + Client Secret, lalu token-nya harus
 * diminta programatically pakai OAuth client_credentials grant (lihat
 * ./accessToken.ts). storeDomain di sini tetap domain `*.myshopify.com`
 * toko-nya.
 */
export interface ShopifyAdminConfig {
  storeDomain: string;
  clientId: string;
  clientSecret: string;
  apiVersion: string;
}
export function getShopifyAdminConfig(): ShopifyAdminConfig {
  const storeDomain = process.env.SHOPIFY_STORE_DOMAIN;
  const clientId = process.env.SHOPIFY_CLIENT_ID;
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;
  const apiVersion = process.env.SHOPIFY_API_VERSION || '2026-07';

  if (!storeDomain || !clientId || !clientSecret) {
    throw new Error(
      'SHOPIFY_STORE_DOMAIN / SHOPIFY_CLIENT_ID / SHOPIFY_CLIENT_SECRET belum diatur di .env — lihat README bagian Setup Shopify.'
    );
  }

  return { storeDomain, clientId, clientSecret, apiVersion };
}

export function getShopifyWebhookSecret(): string {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error('SHOPIFY_WEBHOOK_SECRET belum diatur di .env — lihat README bagian Setup Shopify.');
  }
  return secret;
}
