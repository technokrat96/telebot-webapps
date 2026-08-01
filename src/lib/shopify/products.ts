import 'server-only';
import { shopifyAdminGraphQL } from './client';

export interface ShopifyProductSearchResult {
  productId: string;
  variantId: string;
  sku: string;
  productTitle: string;
  variantTitle: string;
  /** Siap pakai buat field "Nama Item": format "[kode produk]-[nama]". */
  label: string;
  price: number;
  currency: string;
}

interface ProductsSearchQueryResult {
  shop: { currencyCode: string };
  products: {
    edges: {
      node: {
        id: string;
        title: string;
        variants: {
          edges: {
            node: {
              id: string;
              sku: string | null;
              title: string;
              price: string;
            };
          }[];
        };
      };
    }[];
  };
}

const SEARCH_QUERY = `
  query SearchProducts($query: String!) {
    shop {
      currencyCode
    }
    products(first: 10, query: $query) {
      edges {
        node {
          id
          title
          variants(first: 5) {
            edges {
              node {
                id
                sku
                title
                price
              }
            }
          }
        }
      }
    }
  }
`;

function extractNumericId(gid: string): string {
  const parts = gid.split('/');
  return parts[parts.length - 1] ?? gid;
}

/**
 * Cari produk Shopify by judul/SKU (dipanggil dari
 * /api/shopify/products/search, dipakai field "Nama Item" di form
 * transaksi). Satu produk bisa punya beberapa varian (mis. ukuran buket) —
 * tiap varian jadi 1 hasil terpisah karena harga & kode produknya beda-beda.
 *
 * Query syntax Shopify: https://shopify.dev/docs/api/usage/search-syntax
 */
export async function searchShopifyProducts(keyword: string): Promise<ShopifyProductSearchResult[]> {
  const trimmed = keyword.trim();
  if (!trimmed) return [];

  // Wildcard '*' di kedua sisi supaya cocok sebagian (bukan cuma prefix).
  const escaped = trimmed.replace(/["\\]/g, '');
  const query = `title:*${escaped}* OR sku:*${escaped}*`;

  const data = await shopifyAdminGraphQL<ProductsSearchQueryResult>(SEARCH_QUERY, { query });
  const currency = data.shop?.currencyCode || 'IDR';

  const results: ShopifyProductSearchResult[] = [];
  for (const { node: product } of data.products.edges) {
    const variantEdges = product.variants.edges;
    const isSingleVariant = variantEdges.length <= 1;

    for (const { node: variant } of variantEdges) {
      const sku = variant.sku?.trim() || extractNumericId(variant.id);
      const hasRealVariantTitle = variant.title && variant.title !== 'Default Title';
      const namePart = isSingleVariant && !hasRealVariantTitle
        ? product.title
        : `${product.title} - ${variant.title}`;

      results.push({
        productId: extractNumericId(product.id),
        variantId: extractNumericId(variant.id),
        sku,
        productTitle: product.title,
        variantTitle: variant.title,
        label: `${sku}-${namePart}`,
        price: Number(variant.price) || 0,
        currency,
      });
    }
  }
  return results;
}
