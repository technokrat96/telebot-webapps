/**
 * Subset field dari payload webhook Shopify (topic `orders/create`) yang
 * benar-benar dipakai di sini. Payload aslinya jauh lebih besar -- lihat
 * https://shopify.dev/docs/api/webhooks?reference=toml#list-of-topics-orders-create
 */
/**
 * `shop_money` vs field polos (mis. `price`, `currency`): `shop_money`
 * selalu dalam currency TOKO (mis. IDR), sudah dikonversi Shopify dari
 * currency asli yang dipakai customer bayar (`presentment_money`) kalau
 * multi-currency checkout aktif. Field polos secara historis juga ikut
 * currency toko, tapi itu perilaku legacy yang tidak dijamin ke depannya --
 * makanya di sini SELALU prioritaskan `*_set.shop_money`, field polos cuma
 * fallback kalau entah kenapa `*_set`-nya tidak ada di payload.
 * Lihat https://shopify.dev/docs/api/usage/pricing-models
 */
interface ShopMoney {
  amount?: string;
  currency_code?: string;
}

export interface ShopifyOrderWebhookPayload {
  id: number;
  order_number?: number;
  email?: string | null;
  phone?: string | null;
  /** @deprecated pakai total_price_set.shop_money.currency_code -- lihat catatan di atas */
  currency?: string;
  financial_status?: string | null;
  total_price_set?: {
    shop_money?: ShopMoney;
  } | null;
  total_shipping_price_set?: {
    shop_money?: ShopMoney;
  } | null;
  customer?: {
    first_name?: string | null;
    last_name?: string | null;
    phone?: string | null;
    email?: string | null;
  } | null;
  shipping_address?: {
    name?: string | null;
    address1?: string | null;
    address2?: string | null;
    city?: string | null;
    province?: string | null;
    zip?: string | null;
    country?: string | null;
    phone?: string | null;
  } | null;
  line_items: {
    title: string;
    quantity: number;
    /** @deprecated pakai price_set.shop_money.amount -- lihat catatan di atas */
    price: string;
    price_set?: {
      shop_money?: ShopMoney;
    } | null;
    sku?: string | null;
    variant_id?: number | null;
    product_id?: number | null;
  }[];
}
