import "server-only";

interface ExchangeRateApiResponse {
  result: "success" | "error";
  base_code?: string;
  conversion_rates?: Record<string, number>;
  "error-type"?: string;
}

/**
 * Ambil kurs semua currency relatif ke IDR dari ExchangeRate-API
 * (https://www.exchangerate-api.com/docs/standard-requests), dipakai cron
 * sync harian (lihat src/app/api/cron/sync-exchange-rates/route.ts).
 *
 * Base request-nya IDR, jadi `conversion_rates.USD` artinya "berapa USD
 * setara 1 IDR" (angka kecil, mis. 0.000063) -- KEBALIK dari yang kita
 * simpan di tabel Currency (`rate` = "berapa IDR setara 1 unit currency
 * itu", dipakai ItemPesananFields.tsx buat convert harga item ke basis
 * IDR). Pembalikan (1 / rate) dilakukan oleh caller, bukan di sini, biar
 * fungsi ini murni "ambil data mentah dari API".
 */
export async function fetchExchangeRatesFromIdr(): Promise<
  Record<string, number>
> {
  const apiKey = process.env.EXCHANGE_RATE_API_KEY;
  if (!apiKey) {
    throw new Error("EXCHANGE_RATE_API_KEY belum diatur di .env");
  }

  const url = `https://v6.exchangerate-api.com/v6/${apiKey}/latest/IDR`;
  const startedAt = Date.now();
  console.log("[exchangeRate] -> GET latest/IDR");

  const res = await fetch(url, { cache: "no-store" });
  const json = (await res.json().catch(() => ({}))) as ExchangeRateApiResponse;

  console.log(
    `[exchangeRate] <- GET latest/IDR ${res.status} result=${json.result ?? "?"} (${Date.now() - startedAt}ms)`,
  );

  if (!res.ok || json.result !== "success" || !json.conversion_rates) {
    throw new Error(
      `ExchangeRate-API error: ${json["error-type"] ?? res.statusText}`,
    );
  }

  return json.conversion_rates;
}
