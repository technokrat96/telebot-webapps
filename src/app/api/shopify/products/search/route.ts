import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { searchShopifyProducts } from '@/lib/shopify/products';
import { ProductSearchResult } from '@/types';

/**
 * Dipakai field "Nama Item" di form transaksi (lihat
 * src/components/transaction/TransactionForm/ProductNameField.tsx) buat
 * cari produk Shopify sambil ngetik. Kalau tidak ketemu / Shopify belum
 * dikonfigurasi, client tetap bisa isi manual (free text) -- endpoint ini
 * cuma bantu isi otomatis nama & harga kalau produknya ada.
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, ['ADMIN']);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const q = req.nextUrl.searchParams.get('q') ?? '';
  if (!q.trim()) return NextResponse.json({ results: [] });

  try {
    const products = await searchShopifyProducts(q);
    const results: ProductSearchResult[] = products.map((p) => ({
      SKU: p.sku,
      LABEL: p.label,
      PRICE: p.price,
      CURRENCY: p.currency,
    }));
    return NextResponse.json({ results });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
