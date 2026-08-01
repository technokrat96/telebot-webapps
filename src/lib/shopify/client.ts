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

  const res = await fetch(`https://${storeDomain}/admin/api/${apiVersion}/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': accessToken,
    },
    body: JSON.stringify({ query, variables }),
    cache: 'no-store',
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Shopify API error (${res.status}): ${text || res.statusText}`);
  }

  const json = (await res.json()) as ShopifyGraphQLResponse<T>;
  if (json.errors?.length) {
    throw new Error(`Shopify GraphQL error: ${json.errors.map((e) => e.message).join('; ')}`);
  }
  if (!json.data) {
    throw new Error('Shopify GraphQL: respons kosong');
  }
  return json.data;
}
