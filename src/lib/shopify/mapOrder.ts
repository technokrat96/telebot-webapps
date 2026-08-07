import { Transaction, TransactionDetail } from "@/types";
import type { ShopifyOrderWebhookPayload } from "./types";
import { getProductInfoByIds, type ShopifyProductInfo } from "./productLookup";

function formatAddress(
  addr: ShopifyOrderWebhookPayload["shipping_address"],
): string {
  if (!addr) return "";
  return [
    addr.address1,
    addr.address2,
    addr.city,
    addr.province,
    addr.zip,
    addr.country,
  ]
    .filter(Boolean)
    .join(", ");
}

/**
 * Ubah payload webhook order Shopify jadi bentuk siap pakai buat
 * createTransaction() (lihat src/lib/db/transaction.ts). ORDER_SOURCE
 * selalu "SHOPIFY" (lihat poin 2 permintaan awal) supaya kelihatan jelas
 * transaksi ini datang otomatis dari Shopify, bukan diinput manual admin.
 *
 * Catatan asumsi (sesuaikan kalau bisnisnya beda):
 * - GRAND_TOTAL dihitung dari sum(qty x harga) line item, konsisten dengan
 *   cara form manual menghitungnya (lihat TransactionForm/index.tsx) --
 *   BUKAN order.total_price Shopify (yang sudah termasuk pajak dll).
 * - Kalau financial_status Shopify == "paid", DOWN_PAYMENT diisi penuh
 *   (grandTotal + ongkir) karena pembayaran sudah lunas lewat checkout
 *   Shopify. Selain itu DOWN_PAYMENT = 0 (mis. order belum/tidak dibayar
 *   di muka, misal COD).
 * - IMAGE_URLS diisi gambar utama produk Shopify (kalau ada), CUSTOM_NOTES
 *   diisi link ke halaman produknya -- keduanya di-lookup terpisah lewat
 *   Admin API (lihat ./productLookup.ts) karena payload webhook order
 *   sendiri tidak menyertakan gambar/link produk.
 * - Semua nominal uang diambil dari `*_set.shop_money` (bukan field polos
 *   seperti `price`/`currency`) -- itu yang selalu dalam currency TOKO
 *   (mis. IDR), sudah dikonversi Shopify dari currency asli customer bayar
 *   kalau multi-currency checkout aktif. Jadi CURRENCY_RATE aman di-set 1
 *   terus, tidak perlu tabel kurs sendiri -- Shopify yang sudah convert.
 */
export async function mapShopifyOrderToTransaction(
  order: ShopifyOrderWebhookPayload,
): Promise<{
  transaction: Omit<Transaction, "ORDER_ID">;
  details: Omit<TransactionDetail, "ORDER_ID" | "ORDER_ITEM_ID">[];
}> {
  const currency =
    order.total_price_set?.shop_money?.currency_code || order.currency || "IDR";

  const customerName =
    [order.customer?.first_name, order.customer?.last_name]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    order.shipping_address?.name ||
    order.email ||
    `Shopify Order #${order.order_number ?? order.id}`;

  const customerPhone =
    order.phone || order.shipping_address?.phone || order.customer?.phone || "";
  const customerEmail = order.email || order.customer?.email || "";
  const customerAddress = formatAddress(order.shipping_address);
  const receiverName = order.shipping_address?.name || customerName;

  const shippingFee =
    Number(order.total_shipping_price_set?.shop_money?.amount ?? 0) || 0;

  // Ambil gambar + link produk dalam 1 batch request untuk semua
  // product_id unik di order ini. Kalau gagal (mis. Admin API lagi
  // bermasalah), jangan sampai gagalkan seluruh pembuatan transaksi --
  // item tetap dibuat, cuma tanpa foto/link.
  const productIds = order.line_items
    .map((item) => String(item.product_id ?? ""))
    .filter(Boolean);
  let productInfo = new Map<string, ShopifyProductInfo>();
  try {
    productInfo = await getProductInfoByIds(productIds);
  } catch (err) {
    console.error(
      "[shopify/mapOrder] gagal ambil gambar/link produk:",
      (err as Error).message,
    );
  }

  const details: Omit<TransactionDetail, "ORDER_ID" | "ORDER_ITEM_ID">[] =
    order.line_items.map((item) => {
      const quantity = Number(item.quantity) || 0;
      const unitPrice =
        Number(item.price_set?.shop_money?.amount ?? item.price) || 0;
      // "[kode produk]-[nama]" -- format yang sama dipakai fitur cari produk
      // di form transaksi (lihat ProductNameField.tsx).
      const kodeProduk =
        item.sku?.trim() || String(item.variant_id ?? item.product_id ?? "");
      const itemName = kodeProduk ? `${kodeProduk}-${item.title}` : item.title;

      const info = item.product_id
        ? productInfo.get(String(item.product_id))
        : undefined;

      return {
        ITEM_NAME: itemName,
        QUANTITY: quantity,
        UNIT_PRICE: unitPrice,
        CURRENCY: currency,
        CURRENCY_RATE: 1,
        CUSTOM_NOTES: info?.productUrl
          ? `Produk Shopify: ${info.productUrl}`
          : "",
        SUBTOTAL: quantity * unitPrice,
        ITEM_STATUS: "NEW ORDER",
        CARD_TO: "",
        CARD_MESSAGE: "",
        CARD_FROM: "",
        CARD_NOTE: "",
        CARD_CREATED_BY: "",
        CARD_STATUS: "NEW ORDER",
        DELIVERY_METHOD: "",
        DELIVERY_DATE: "",
        DELIVERY_TIME: "",
        SHIPPING_FEE: shippingFee,
        RECEIVER_NAME: receiverName,
        RECEIVER_ADDRESS: customerAddress,
        RECEIVER_PHONE: customerPhone,
        IMAGE_URLS: info?.imageUrl ? [info.imageUrl] : [],
      };
    });

  const grandTotal = details.reduce((sum, d) => sum + d.SUBTOTAL, 0);
  const isPaid = order.financial_status === "paid";
  const downPayment = isPaid ? grandTotal + shippingFee : 0;
  const remainingBalance = grandTotal + shippingFee - downPayment;

  const transaction: Omit<Transaction, "ORDER_ID"> = {
    ORDER_SOURCE: "SHOPIFY",
    SALES_NAME: "",
    CUSTOMER_NAME: customerName,
    CUSTOMER_ADDRESS: customerAddress,
    CUSTOMER_PHONE: customerPhone,
    CUSTOMER_EMAIL: customerEmail,
    GRAND_TOTAL: grandTotal,
    DOWN_PAYMENT: downPayment,
    REMAINING_BALANCE: remainingBalance,
    PAYMENT_METHOD: "SHOPIFY",
    SHOPIFY_ORDER_ID: String(order.id),
  };

  return { transaction, details };
}
