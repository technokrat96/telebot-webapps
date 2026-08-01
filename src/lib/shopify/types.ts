/**
 * Subset field dari payload webhook Shopify (topic `orders/create`) yang
 * benar-benar dipakai di sini. Payload aslinya jauh lebih besar -- lihat
 * https://shopify.dev/docs/api/webhooks?reference=toml#list-of-topics-orders-create
 */
export interface ShopifyOrderWebhookPayload {
  id: number;
  order_number?: number;
  email?: string | null;
  phone?: string | null;
  currency?: string;
  financial_status?: string | null;
  total_shipping_price_set?: {
    shop_money?: { amount?: string };
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
    price: string;
    sku?: string | null;
    variant_id?: number | null;
    product_id?: number | null;
  }[];
}
