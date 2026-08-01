import 'server-only';
import { shopifyAdminGraphQL } from './client';
import { getShopifyAdminConfig } from './config';

export interface ShopifyProductInfo {
  imageUrl: string | null;
  productUrl: string | null;
}

interface NodesQueryResult {
  nodes: (
    | {
        id: string;
        handle: string;
        onlineStoreUrl: string | null;
        featuredImage: { url: string } | null;
      }
    | null
  )[];
}

const NODES_QUERY = `
  query GetProductsByIds($ids: [ID!]!) {
    nodes(ids: $ids) {
      ... on Product {
        id
        handle
        onlineStoreUrl
        featuredImage {
          url
        }
      }
    }
  }
`;

/**
 * Ambil gambar utama + link produk untuk sekumpulan product ID numeric
 * Shopify. Dipakai webhook order (src/lib/shopify/mapOrder.ts) karena
 * payload order dari webhook TIDAK menyertakan gambar/link produk sama
 * sekali -- cuma `product_id`/`variant_id` per line item -- jadi harus
 * di-lookup terpisah. Di-batch jadi 1 request GraphQL pakai `nodes()`
 * biar tidak 1 API call per line item.
 *
 * `productUrl` prioritas ke halaman produk di toko online (kalau produk
 * dipublish ke channel Online Store); kalau tidak ada, fallback ke link
 * halaman produk di Shopify Admin (selalu ada, tapi butuh login admin).
 */
export async function getProductInfoByIds(
  productIds: string[]
): Promise<Map<string, ShopifyProductInfo>> {
  const uniqueIds = [...new Set(productIds.filter(Boolean))];
  const result = new Map<string, ShopifyProductInfo>();
  if (uniqueIds.length === 0) return result;

  const { storeDomain } = getShopifyAdminConfig();
  const gids = uniqueIds.map((id) => `gid://shopify/Product/${id}`);
  const data = await shopifyAdminGraphQL<NodesQueryResult>(NODES_QUERY, { ids: gids });

  for (const node of data.nodes) {
    if (!node) continue;
    const numericId = node.id.split('/').pop() ?? node.id;
    const productUrl = node.onlineStoreUrl || `https://${storeDomain}/admin/products/${numericId}`;
    result.set(numericId, {
      imageUrl: node.featuredImage?.url ?? null,
      productUrl,
    });
  }
  return result;
}
