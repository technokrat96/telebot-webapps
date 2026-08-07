import "server-only";
import { getShopifyAdminConfig } from "./config";

/**
 * Tukar Client ID + Client Secret jadi Admin API access token pakai OAuth
 * "client credentials grant" -- cara resmi Shopify buat custom app yang
 * dibuat lewat Dev Dashboard (client_id/client_secret, bukan token statis
 * lagi per Jan 2026). Lihat:
 * https://shopify.dev/docs/apps/build/dev-dashboard/get-api-access-tokens
 *
 * Token berlaku 24 jam (`expires_in` selalu 86399 detik), jadi di-cache di
 * memori proses & di-refresh otomatis begitu mau kedaluwarsa. Catatan:
 * cache ini per-instance server -- di deployment serverless dengan banyak
 * instance (mis. Vercel), tiap instance akan minta token sendiri-sendiri
 * (lebih sering fetch, tapi tetap benar).
 */
let cachedToken: string | null = null;
let cachedTokenExpiresAt = 0;

export async function getShopifyAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedTokenExpiresAt - 60_000) {
    return cachedToken;
  }

  const { storeDomain, clientId, clientSecret } = getShopifyAdminConfig();
  const url = `${storeDomain}/admin/oauth/access_token`;

  // Log sebelum & sesudah fetch (tanpa nge-log client_secret) -- bantu
  // lacak apakah 502/error yang muncul asalnya dari sini (mis. shop_not_
  // permitted, client_id/secret salah, atau request-nya kelamaan/timeout).
  const startedAt = Date.now();
  console.log(`[shopify] -> POST ${url} (client_id=${clientId})`);

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
      }),
      cache: "no-store",
    });
  } catch (err) {
    console.error(
      `[shopify] <- POST ${url} FAILED after ${Date.now() - startedAt}ms:`,
      (err as Error).message,
    );
    throw err;
  }

  console.log(
    `[shopify] <- POST ${url} ${res.status} ${res.statusText} (${Date.now() - startedAt}ms)`,
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(`[shopify] access_token error body:`, text);
    throw new Error(
      `Gagal ambil Shopify access token (${res.status}): ${text || res.statusText}`,
    );
  }

  const { access_token, expires_in } = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };

  cachedToken = access_token;
  cachedTokenExpiresAt = Date.now() + expires_in * 1000;
  return cachedToken;
}
