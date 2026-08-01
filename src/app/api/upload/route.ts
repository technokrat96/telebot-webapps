import { NextRequest, NextResponse } from 'next/server';
import { put, del, get } from '@vercel/blob';
import { requireAuth } from '@/lib/auth';
import {
  ALLOWED_IMAGE_TYPES,
  ALLOWED_IMAGE_TYPES_LABEL,
  MAX_IMAGE_SIZE_BYTES,
  MAX_IMAGE_SIZE_LABEL,
} from '@/lib/imageUploadConstraints';

// Host gambar produk Shopify (lihat src/lib/shopify/mapOrder.ts -- IMAGE_URLS
// item dari webhook order Shopify bisa berisi URL CDN Shopify, bukan cuma
// Vercel Blob kita sendiri). Dibatasi ke allowlist ini (bukan proxy bebas ke
// URL manapun) supaya endpoint ini tidak jadi celah SSRF.
const SHOPIFY_IMAGE_HOST_PATTERNS = [/(^|\.)cdn\.shopify\.com$/, /\.myshopify\.com$/];

function isShopifyImageHost(hostname: string): boolean {
  return SHOPIFY_IMAGE_HOST_PATTERNS.some((re) => re.test(hostname));
}

/**
 * Upload gambar. Dipakai dari 2 tempat: form transaksi admin (create/edit)
 * untuk field IMAGE_URLS di setiap baris TransactionDetail, dan halaman
 * kurir untuk foto bukti setiap perubahan status delivery (lihat
 * advanceWithPhoto di app/kurir/page.tsx) -- makanya KURIR juga perlu
 * diizinkan, bukan cuma ADMIN.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, ['ADMIN', 'KURIR']);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get('file');

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 400 });
  }
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: `Format file harus ${ALLOWED_IMAGE_TYPES_LABEL}` },
      { status: 400 }
    );
  }
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return NextResponse.json({ error: `Ukuran file maksimal ${MAX_IMAGE_SIZE_LABEL}` }, { status: 400 });
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const key = `item-pesanan/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const blob = await put(key, file, {
    access: 'private',
    addRandomSuffix: false,
    contentType: file.type,
  });

  return NextResponse.json({ url: blob.url });
}

/**
 * Proxy untuk menampilkan gambar item pesanan. Dua sumber:
 * 1. Private Vercel Blob store kita sendiri (foto yang diupload admin/kurir
 *    lewat POST di atas) -- URL-nya tidak bisa diakses langsung dari
 *    <img src>, harus lewat get() yang ter-otentikasi di server.
 * 2. Gambar produk Shopify (IMAGE_URLS dari webhook order, lihat
 *    src/lib/shopify/mapOrder.ts) -- ini sudah URL publik di CDN Shopify,
 *    jadi cukup di-proxy langsung (masih di belakang requireAuth di bawah,
 *    dan dibatasi allowlist host Shopify -- bukan proxy ke URL sembarang).
 * Client selalu fetch route ini (dengan header auth) untuk kedua kasus,
 * lalu ubah response-nya jadi data: URL untuk ditampilkan.
 */
export async function GET(req: NextRequest) {
  // Cuma lihat (bukan upload/hapus), jadi FLORIST & KURIR juga boleh —
  // dipakai buat nampilin foto item pesanan di halaman mereka.
  const auth = await requireAuth(req, ['ADMIN', 'FLORIST', 'KURIR']);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rawUrl = req.nextUrl.searchParams.get('url');
  if (!rawUrl) return NextResponse.json({ error: 'URL wajib diisi' }, { status: 400 });

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    return NextResponse.json({ error: 'URL tidak valid' }, { status: 400 });
  }

  if (isShopifyImageHost(parsedUrl.hostname)) {
    const startedAt = Date.now();
    console.log(`[shopify] -> GET ${rawUrl}`);
    const shopifyRes = await fetch(rawUrl, { cache: 'no-store' });
    console.log(`[shopify] <- GET ${rawUrl} ${shopifyRes.status} ${shopifyRes.statusText} (${Date.now() - startedAt}ms)`);
    if (!shopifyRes.ok || !shopifyRes.body) {
      return NextResponse.json({ error: 'Gambar tidak ditemukan' }, { status: 404 });
    }
    return new NextResponse(shopifyRes.body, {
      headers: {
        'Content-Type': shopifyRes.headers.get('content-type') || 'application/octet-stream',
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-cache',
      },
    });
  }

  const pathname = parsedUrl.pathname.replace(/^\//, '');
  const result = await get(pathname, { access: 'private' });
  if (!result || result.statusCode !== 200 || !result.stream) {
    return NextResponse.json({ error: 'Gambar tidak ditemukan' }, { status: 404 });
  }

  return new NextResponse(result.stream, {
    headers: {
      'Content-Type': result.blob.contentType || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-cache',
    },
  });
}

/**
 * Hapus gambar item pesanan dari Vercel Blob (dipanggil saat user
 * mengganti/menghapus gambar di form sebelum submit, biar tidak numpuk
 * file yatim di storage).
 */
export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req, ['ADMIN']);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { url } = (await req.json()) as { url?: string };
  if (!url) return NextResponse.json({ error: 'URL wajib diisi' }, { status: 400 });

  try {
    await del(url);
  } catch {
    // Best-effort: kalau gagal hapus (mis. sudah tidak ada), jangan blokir user.
  }
  return NextResponse.json({ ok: true });
}
