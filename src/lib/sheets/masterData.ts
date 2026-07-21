import { readSheetColumns } from '@/lib/googleSheets';
import { MasterData } from '@/types';

const MASTER_DATA_SHEET = 'MasterData';

// Simple in-memory cache with short TTL — MasterData rarely changes and
// is fetched on every app load, so we avoid hitting the Sheets API on
// every single request. Restart / redeploy clears it naturally.
let cache: { data: MasterData; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 60_000; // 1 minute

export async function getMasterData(): Promise<MasterData> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.data;
  }

  const columns = await readSheetColumns(MASTER_DATA_SHEET);

  console.log(`READ DATA ${MASTER_DATA_SHEET}`, columns)

  const initialCurrency = { label: 'IDR', value: 'IDR', locale: 'id-ID', rate: 1 };
  const data: MasterData = {
    ROLES: columns.ROLE ?? [],
    PAYMENT_METHODS: columns.PAYMENT_METHOD ?? [],
    ORDER_SOURCES: columns.ORDER_SOURCE ?? [],
    ITEM_STATUSES: columns.ITEM_STATUS ?? [],
    DELIVERY_METHODS: columns.DELIVERY_METHOD ?? [],
    DELIVERY_STATUSES: columns.DELIVERY_STATUS ?? [],
    CARD_STATUSES: columns.CARD_STATUS ?? [],
    INVOICE_STATUSES: columns.INVOICE_STATUS ?? [],
    CURRENCY: [],
  };

  data.CURRENCY = [
    initialCurrency,
    ...(columns.CURRENCY ?? []).map((e, i) => {
      const [currency, locale, rate] = e.split('_');
      return { label: currency, value: currency, locale: locale ?? 'en-US', rate: Number(rate ?? '1') };
    })
  ]

  cache = { data, fetchedAt: Date.now() };
  return data;
}

/** Force-refresh the cache (e.g. after an admin edits the MasterData sheet). */
export function invalidateMasterDataCache(): void {
  cache = null;
}