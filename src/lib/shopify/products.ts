import 'server-only';
import { shopifyAdminGraphQL } from './client';

/**
 * Cara baca query GraphQL di bawah, buat yang belum terbiasa: setiap baris
 * di dalam `{ ... }` = 1 field yang diminta dari Shopify, hasilnya nanti
 * balik dengan struktur JSON yang PERSIS sama bentuknya dengan query-nya
 * (lihat interface `ProductsSearchQueryResult` di bawah -- sengaja ditulis
 * field-by-field biar gampang dicocokkan sama query-nya). Beda dari REST
 * yang balikin semua field sekaligus, di sini kita cuma minta field yang
 * benar-benar kepakai.
 */

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
  imageUrl: string | null;
}

/** Bentuk data yang balik dari SEARCH_QUERY -- cocokkan urutan field-nya. */
interface ProductsSearchQueryResult {
  shop: {
    currencyCode: string;
  };
  products: {
    edges: {
      node: {
        id: string; // GID, mis. "gid://shopify/Product/123" -> di-extract jadi "123"
        title: string;
        featuredImage: { url: string } | null; // gambar utama produk, null kalau belum di-upload
        variants: {
          edges: {
            node: {
              id: string;
              sku: string | null;
              title: string; // "Default Title" kalau produknya tidak punya varian beneran
              price: string; // string desimal dari Shopify, mis. "150000.00"
            };
          }[];
        };
      };
    }[];
  };
}

const SEARCH_QUERY = `
  query SearchProducts($query: String!) {
    # Currency toko, dipakai buat field CURRENCY di hasil pencarian.
    shop {
      currencyCode
    }
    # $query = search syntax Shopify, mis. "title:*mawar* OR sku:*BNG*"
    # (lihat searchShopifyProducts() di bawah). Dibatasi 10 produk teratas.
    products(first: 10, query: $query) {
      edges {
        node {
          id
          title
          featuredImage {
            url
          }
          # Satu produk bisa punya beberapa varian (mis. ukuran buket) --
          # tiap varian punya SKU & harga sendiri, makanya diambil juga.
          # Dibatasi 5 varian per produk (lebih dari itu jarang terjadi
          # untuk produk buket).
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
  // "/, \" dibuang biar tidak merusak search syntax-nya.
  const escaped = trimmed.replace(/["\\]/g, '');
  const query = `title:*${escaped}* OR sku:*${escaped}*`;

  const data = await shopifyAdminGraphQL<ProductsSearchQueryResult>(SEARCH_QUERY, { query });
  const currency = data.shop?.currencyCode || 'IDR';

  const results: ShopifyProductSearchResult[] = [];
  for (const { node: product } of data.products.edges) {
    const variantEdges = product.variants.edges;
    const isSingleVariant = variantEdges.length <= 1;

    for (const { node: variant } of variantEdges) {
      // Kode produk = SKU (kalau diisi), fallback ke ID varian kalau SKU
      // kosong -- tetap butuh sesuatu yang unik buat prefix "Nama Item".
      const sku = variant.sku?.trim() || extractNumericId(variant.id);

      // Produk dengan 1 varian & belum di-custom nama variannya cukup
      // ditampilkan nama produknya saja (tanpa embel-embel "- Default
      // Title"). Produk dengan beberapa varian (mis. ukuran) tetap
      // disertakan nama variannya biar tidak ambigu di hasil pencarian.
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
        label: `${sku}-${namePart}`, // format "[kode produk]-[nama]"
        price: Number(variant.price) || 0,
        currency,
        // Featured image di level produk (bukan per-varian) -- semua
        // varian dari produk yang sama pakai gambar yang sama, konsisten
        // dengan sumber gambar yang dipakai webhook order (lihat
        // productLookup.ts).
        imageUrl: product.featuredImage?.url ?? null,
      });
    }
  }
  return results;
}
