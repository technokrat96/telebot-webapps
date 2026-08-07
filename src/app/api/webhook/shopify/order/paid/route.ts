import { NextRequest, NextResponse } from "next/server";
import { verifyShopifyWebhook } from "@/lib/shopify/webhookVerify";
import { mapShopifyOrderToTransaction } from "@/lib/shopify/mapOrder";
import type { ShopifyOrderWebhookPayload } from "@/lib/shopify/types";
import {
  createTransaction,
  findTransactionByShopifyOrderId,
} from "@/lib/db/transaction";

/**
 * Webhook order Shopify, topic "Order payment" / `orders/paid` (daftarkan
 * ke URL ini, lihat README bagian Setup Shopify). Beda dari `orders/create`
 * -- ini baru nembak setelah order lunas (financial_status = "paid"), jadi
 * order dengan pembayaran manual/COD yang belum dikonfirmasi TIDAK bikin
 * Transaction dulu sampai statusnya paid. Begitu nembak, langsung disimpan
 * sebagai Transaction dengan ORDER_SOURCE = "SHOPIFY" -- tidak ada tahap
 * approval manual, admin akan langsung melihatnya di /admin/transaction.
 */
export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  console.log("[shopify] <- webhook orders/paid diterima");

  // Baca raw body dulu (bukan req.json()) karena signature HMAC dihitung
  // dari bytes mentahnya, sebelum di-parse.
  const rawBody = await req.text();
  const hmacHeader = req.headers.get("x-shopify-hmac-sha256");

  let verified: boolean;
  try {
    verified = verifyShopifyWebhook(rawBody, hmacHeader);
  } catch (err) {
    console.error("[webhook/shopify]", (err as Error).message);
    return NextResponse.json(
      { error: "Webhook belum dikonfigurasi (SHOPIFY_WEBHOOK_SECRET kosong)" },
      { status: 500 },
    );
  }
  if (!verified) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let order: ShopifyOrderWebhookPayload;
  try {
    order = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (
    !order?.id ||
    !Array.isArray(order.line_items) ||
    order.line_items.length === 0
  ) {
    return NextResponse.json(
      { error: "Payload order tidak valid" },
      { status: 400 },
    );
  }

  // Idempotent: Shopify bisa retry webhook yang sama kalau respons kita
  // telat/gagal -- jangan sampai bikin Transaction dobel untuk order yang
  // sama.
  const existing = await findTransactionByShopifyOrderId(String(order.id));
  if (existing) {
    return NextResponse.json({
      ok: true,
      orderId: existing.ORDER_ID,
      duplicate: true,
    });
  }

  const { transaction, details } = await mapShopifyOrderToTransaction(order);
  const orderId = await createTransaction(transaction, details);

  console.log(
    `[shopify] -> webhook orders/paid selesai, orderId=${orderId} (${Date.now() - startedAt}ms)`,
  );
  return NextResponse.json({ ok: true, orderId });
}
