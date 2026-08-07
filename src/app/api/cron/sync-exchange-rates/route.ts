import { NextRequest, NextResponse } from "next/server";
import { fetchExchangeRatesFromIdr } from "@/lib/exchangeRate";
import { updateCurrencyRate } from "@/lib/db/currency";

/**
 * Dipanggil Vercel Cron tiap hari (lihat jadwalnya di vercel.json) buat
 * sinkron kolom `rate` di tabel `Currency` ke kurs terbaru dari
 * ExchangeRate-API. Daftar kode currency yang diproses berasal dari
 * respons API (bukan dari tabel `Currency`) -- kalau kode itu belum ada
 * di DB, akan di-insert; kalau sudah ada, di-update. IDR di-skip (base
 * currency kita, rate-nya selalu 1).
 *
 * Diproteksi `CRON_SECRET` yang otomatis di-provision & dikirim Vercel
 * lewat header `Authorization: Bearer <CRON_SECRET>` tiap kali dia yang
 * manggil -- endpoint ini tidak dimaksudkan diakses manual/dari browser.
 * Di non-production (dev lokal), cek ini dilewati biar gampang di-test.
 */
export async function GET(req: NextRequest) {
  const isDev = process.env.NODE_ENV !== "production";
  const expectedAuth = process.env.CRON_SECRET
    ? `Bearer ${process.env.CRON_SECRET}`
    : null;
  if (
    !isDev &&
    (!expectedAuth || req.headers.get("authorization") !== expectedAuth)
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  console.log("[cron/sync-exchange-rates] mulai");

  try {
    const ratesFromIdr = await fetchExchangeRatesFromIdr();
    const codes = Object.keys(ratesFromIdr);

    const results: { code: string; rate?: number; error?: string }[] = [];
    for (const code of codes) {
      if (code === "IDR") continue; // base currency kita, rate selalu 1

      const rateFromIdr = ratesFromIdr[code]; // "berapa <code> setara 1 IDR"
      if (!rateFromIdr) {
        results.push({ code, error: "rate dari ExchangeRate-API kosong/0" });
        continue;
      }

      const rate = 1 / rateFromIdr; // dibalik jadi "berapa IDR setara 1 <code>"
      // upsert: insert kalau kode belum ada di DB, update kalau sudah ada
      await updateCurrencyRate(code, rate);
      results.push({ code, rate });
    }

    console.log(
      `[cron/sync-exchange-rates] selesai (${Date.now() - startedAt}ms):`,
      results,
    );
    return NextResponse.json({ ok: true, results });
  } catch (err) {
    console.error(
      `[cron/sync-exchange-rates] gagal setelah ${Date.now() - startedAt}ms:`,
      (err as Error).message,
    );
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 502 },
    );
  }
}
