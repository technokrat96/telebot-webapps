import 'server-only';
import { getShopifyAdminConfig } from './config';
import { getShopifyAccessToken } from './accessToken';

interface ShopifyGraphQLResponse<T> {
  data?: T;
  errors?: { message: string }[];
}

/**
 * Panggil Shopify Admin GraphQL API. Dipakai untuk search produk (lihat
 * ./products.ts). Selalu `no-store` karena harga/stok produk bisa berubah
 * kapan saja.
 */
export async function shopifyAdminGraphQL<T>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const { storeDomain, apiVersion } = getShopifyAdminConfig();
  const accessToken = await getShopifyAccessToken();
  const url = `https://${storeDomain}/admin/api/${apiVersion}/graphql.json`;

  // Log sebelum & sesudah fetch -- bantu lacak 502/error: apakah request-nya
  // sama sekali gagal terkirim (network/timeout), atau terkirim tapi
  // Shopify balikin status/error tertentu.
  const startedAt = Date.now();
  console.log(`[shopify] -> POST ${url}`);

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken,
      },
      body: JSON.stringify({ query, variables }),
      cache: 'no-store',
    });
  } catch (err) {
    console.error(`[shopify] <- POST ${url} FAILED after ${Date.now() - startedAt}ms:`, (err as Error).message);
    throw err;
  }

  console.log(`[shopify] <- POST ${url} ${res.status} ${res.statusText} (${Date.now() - startedAt}ms)`);

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error(`[shopify] graphql error body:`, text);
    throw new Error(`Shopify API error (${res.status}): ${text || res.statusText}`);
  }

  const json = (await res.json()) as ShopifyGraphQLResponse<T>;
  if (json.errors?.length) {
    console.error(`[shopify] graphql errors:`, json.errors);
    throw new Error(`Shopify GraphQL error: ${json.errors.map((e) => e.message).join('; ')}`);
  }
  if (!json.data) {
    throw new Error('Shopify GraphQL: respons kosong');
  }
  return json.data;
}
