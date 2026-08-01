import 'server-only';
import { shopifyAdminGraphQL } from './client';
import { getShopifyAdminConfig } from './config';

export interface ShopifyProductInfo {
  imageUrl: string | null;
  productUrl: string | null;
}

/** Bentuk data yang balik dari NODES_QUERY -- cocokkan urutan field-nya. */
interface NodesQueryResult {
  // `nodes()` balikin array SEJAJAR dengan array ID yang diminta -- kalau
  // salah satu produknya sudah dihapus/tidak ketemu, elemennya `null`
  // (bukan di-skip), makanya union-nya termasuk `null`.
  nodes: (
    | {
        id: string; // GID, mis. "gid://shopify/Product/123" -> di-extract jadi "123"
        handle: string; // slug URL produk, mis. "buket-mawar-merah"
        onlineStoreUrl: string | null; // null kalau produk tidak dipublish ke channel Online Store
        featuredImage: { url: string } | null;
      }
    | null
  )[];
}

const NODES_QUERY = `
  # nodes() = ambil banyak resource sekaligus by ID dalam 1 request --
  # dipakai di sini biar lookup gambar/link buat semua produk di 1 order
  # tidak jadi banyak request terpisah (1 per produk).
  query GetProductsByIds($ids: [ID!]!) {
    nodes(ids: $ids) {
      # Perlu "... on Product" karena nodes() bisa balikin tipe resource
      # apa saja (Product, Order, dll) tergantung ID-nya -- field di bawah
      # cuma valid kalau resource-nya memang Product.
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
    if (!node) continue; // produk sudah dihapus / tidak ketemu -- skip, biarkan detail item tanpa gambar/link

    const numericId = node.id.split('/').pop() ?? node.id;
    const productUrl = node.onlineStoreUrl || `https://${storeDomain}/admin/products/${numericId}`;
    result.set(numericId, {
      imageUrl: node.featuredImage?.url ?? null,
      productUrl,
    });
  }
  return result;
}
