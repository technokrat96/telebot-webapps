# Florist Telegram Mini App

Scaffold Next.js (App Router) + Ant Design untuk aplikasi manajemen toko bunga
yang dibuka lewat **Telegram Mini App**, dengan **Google Sheets** sebagai
database (4 sheet yang sudah kamu punya + 1 sheet tambahan `Users`).

Status: **scaffold lengkap** — semua halaman & API sudah ada dan berfungsi
(CRUD + role-based access), tapi ini masih level dasar. Bagian yang perlu kamu
sesuaikan lebih lanjut ada di bagian "Yang masih perlu disempurnakan" di bawah.

## 0. Catatan versi dependency

Semua dependency di `package.json` sengaja diset ke versi **paling baru**
per Juli 2026: **Next.js 16**, **React 19**, **Ant Design 6**,
`@telegram-apps/sdk-react` v3, dll. Beberapa hal yang berubah dari versi
sebelumnya dan sudah disesuaikan di kode ini:

- **Next.js 15+**: `params` di dynamic route (route handler `[id]`) sekarang
  berupa `Promise` dan wajib di-`await` — semua route handler `[id]` di
  project ini sudah pakai pola ini.
- **Next.js 16**: `next lint` dihapus, ESLint pindah ke flat config
  (`eslint.config.mjs`, bukan `.eslintrc.json` lagi), dan linting tidak lagi
  otomatis jalan saat `next build`. Jalankan `npm run lint` secara terpisah
  kalau perlu.
- **Ant Design 6**: butuh React 18/19 (sudah tidak support React 16/17).
- Untuk validasi initData di server dipakai `@tma.js/init-data-node`
  (bukan `@telegram-apps/init-data-node`) — package itu sendiri sudah
  menyatakan dirinya deprecated dan mengarahkan ke `@tma.js/init-data-node`,
  meski satu monorepo & API yang sama (`validate`/`parse`). Lihat bagian 4.
- Karena rilis-rilis ini masih relatif baru dan saya tidak bisa menjalankan
  `npm install` + build di sandbox untuk verifikasi otomatis, **coba jalankan
  `npm run dev` dan `npm run build` begitu kamu clone**, siapa tahu ada
  breaking change kecil dari library pihak ketiga yang belum tercakup di
  sini. Kalau ada error saat install/build, cara paling gampang adalah
  turunkan versi package yang bermasalah ke minor version sebelumnya.

## 1. Struktur halaman yang sudah dibuat

- `/` — Home (shortcut sesuai role)
- `/whoami` — Who Am I (identitas Telegram + role)
- `/admin/transaction` — List transaksi + detail item (expandable row)
- `/admin/transaction/create` — Buat transaksi baru + item-itemnya
- `/admin/transaction/[id]/edit` — Update data transaksi
- `/admin/invoice` — List invoice + detail item (expandable row)
- `/admin/invoice/create` — Buat invoice dari item transaksi yang belum ditagih
- `/florist` — Antrian kerja florist: update status item (WIP/DONE) &
  tandai transaksi selesai (siap diambil kurir)
- `/kurir` — List transaksi siap diambil, update status pengiriman
  (On Delivery → Delivered → Received, atau Returned)

Role disimpan di sheet `Users` dan dicek di setiap API route
(lihat `src/lib/auth.ts`), jadi bukan cuma disembunyikan di UI.

## 2. Asumsi & penyesuaian terhadap skema sheet kamu

Skema 4 sheet yang kamu kasih **tidak diubah** strukturnya. Ada 2 penyesuaian
logika yang perlu kamu tahu:

1. **Sheet tambahan `Users`** (untuk mapping Telegram username → role):
   ```
   USERNAME | NAME | ROLES
   budi       Budi   ADMIN
   siti        Siti   FLORIST
   joko        Joko   KURIR
   rina        Rina   ADMIN, FLORIST
   ```
   ROLES isinya `ADMIN`, `FLORIST`, dan/atau `KURIR`. Satu USER boleh punya
   lebih dari satu role — pisahkan dengan koma (boleh juga `;`, `/`, atau
   `|`) dalam satu sel yang sama, contoh: `ADMIN, FLORIST`. User dengan
   lebih dari satu role akan melihat gabungan menu semua role-nya (mis.
   halaman Transaksi/Invoice **dan** halaman Florist). Parsing dilakukan di
   `src/lib/ROLES.ts`.

2. **Status pesanan** disimpan di `ITEM_STATUS` (kolom yang sudah ada di
   `Transaction Detail`), bukan kolom baru di sheet `Transaction`. Karena
   sheet `Transaction` tidak punya kolom status sendiri, status "level order"
   (Ready to Pickup / On Delivery / Delivered / Received / Returned) dianggap
   tercapai kalau **semua item** di order itu sudah punya status yang sama.
   Alurnya:
   ```
   NEW → WIP → DONE  (diupdate florist per-item)
                 │
                 ▼
   Florist klik "Update Transaksi ke Done" (butuh semua item = DONE)
                 │
                 ▼
   READY_TO_PICKUP  (semua item, otomatis, ini yang difilter di halaman Kurir)
                 │
                 ▼
   ON_DELIVERY → DELIVERED → RECEIVED
                 │
                 └──→ RETURNED
   ```
   Kalau kamu maunya status order disimpan terpisah (bukan derived dari
   item), tinggal tambah kolom `ORDER_STATUS` di sheet `Transaction` dan
   pindahkan logic di `src/lib/sheets/transaction.ts` /
   `src/app/api/transactions/[id]/status/route.ts` supaya update kolom itu
   langsung, bukan bulk-update semua `Transaction Detail`.

## 3. Setup Google Sheets API

1. Buat project di [Google Cloud Console](https://console.cloud.google.com/),
   aktifkan **Google Sheets API**.
2. Buat **Service Account**, lalu buat key JSON-nya.
3. Buka spreadsheet kamu → klik **Share** → tambahkan email service account
   (`xxx@xxx.iam.gserviceaccount.com`) sebagai **Editor**.
4. Tambahkan sheet ke-5 bernama `Users` (lihat format di atas).
5. Isi `.env` (copy dari `.env.example`):
   ```
   GOOGLE_SHEET_ID=...          # dari URL spreadsheet
   GOOGLE_SERVICE_ACCOUNT_EMAIL=...
   GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   ```

## 4. Setup Telegram Bot & Mini App

1. Chat [@BotFather](https://t.me/BotFather) → `/newbot` → simpan token ke
   `TELEGRAM_BOT_TOKEN`.
2. `/newapp` (atau `/setmenubutton` untuk versi Mini App terbaru) → arahkan
   ke URL production app kamu (harus HTTPS), isi `NEXT_PUBLIC_APP_URL`.
3. Client pakai [`@telegram-apps/sdk-react`](https://www.npmjs.com/package/@telegram-apps/sdk-react)
   (lihat `src/components/common/TelegramProvider.tsx`) untuk `init()` dan
   `retrieveLaunchParams()` — jadi tidak perlu load script manual dari
   `telegram.org`. `initDataRaw` yang didapat lalu divalidasi di server
   (endpoint `/api/auth`, lihat `src/lib/telegram.ts`) memakai
   [`@tma.js/init-data-node`](https://www.npmjs.com/package/@tma.js/init-data-node)
   — package pengganti resmi untuk `@telegram-apps/init-data-node` yang
   sudah dinyatakan deprecated oleh authornya sendiri, tapi berasal dari
   monorepo & API yang sama (`validate`/`parse`).
4. **Wajib**: USER yang mengakses harus punya Telegram **username** (bukan
   cuma nama), dan username itu harus terdaftar di sheet `Users`.

## 5. Menjalankan secara lokal

Butuh **Node.js >= 20.9** (syarat Next.js 16).

```bash
npm install
cp .env.example .env.local   # isi semua env var
npm run dev
```

Karena Mini App butuh konteks Telegram asli, saat `retrieveLaunchParams()`
gagal (tidak dibuka lewat Telegram) dan `NODE_ENV !== 'production'`, app ini
otomatis fallback ke USER dummy (`Dev User`, role `ADMIN, FLORIST, KURIR`)
supaya kamu bisa develop di browser biasa. Ganti role dummy ini di
`src/components/common/TelegramProvider.tsx` kalau mau test role lain, atau
lihat [dokumentasi `mockTelegramEnv`](https://docs.telegram-mini-apps.com/platform/mocking)
kalau mau simulasi initData Telegram yang lebih realistis saat development.

## 6. Deploy

Deploy seperti Next.js app pada umumnya (Vercel, VPS + PM2, dsb), pastikan:
- HTTPS aktif (wajib untuk Telegram Mini App)
- Semua env var di `.env.example` sudah diisi di environment production
- `NEXT_PUBLIC_APP_URL` sama dengan URL yang didaftarkan ke BotFather

## 7. Yang masih perlu disempurnakan (di luar scope scaffold ini)

- **Validasi form** lebih ketat (nomor telepon, email, angka tidak boleh negatif, dst)
- **Auto-generate ID** (ORDER_ID, ORDER_ITEM_ID, INVOICE_ID) — saat ini diisi manual di form
- **Auto-hitung** SUBTOTAL / GRAND_TOTAL / REMAINING_BALANCE dari qty × harga
- **Pagination/caching** kalau data sudah ribuan baris (saat ini baca seluruh sheet tiap request)
- **Loading skeleton & optimistic UI** yang lebih halus
- **Notifikasi Telegram** otomatis ke florist/kurir saat ada order baru (pakai Telegram Bot API `sendMessage`, bisa dipanggil dari API route yang sudah ada)
- **Race condition** saat 2 orang update sheet bersamaan (Google Sheets API tidak punya transaction lock bawaan)

## 8. Struktur folder

```
src/
  app/                    # halaman (App Router) + API routes
  components/
    common/                # AppShell, TelegramProvider, RoleGuard
    transaction/            # Form & tabel transaksi
    invoice/                 # Tabel invoice
  lib/
    googleSheets.ts        # generic read/append/update ke Google Sheets
    sheets/                 # accessor per-sheet (transaction, invoice, users)
    telegram.ts             # validasi initData Telegram
    auth.ts                  # requireAuth() dipakai semua API route
    apiClient.ts             # fetch wrapper (attach initData) untuk client
  types/                    # TypeScript types sesuai skema sheet
```

## 9. Setup Shopify

Ada 2 fitur yang terhubung ke Shopify:

1. **Cari produk** di field "Nama Item" pada form Buat Transaksi (ketik
   sebagian judul/SKU → muncul saran dari Shopify → pilih untuk isi
   otomatis nama item dengan format `[kode produk]-[nama]` dan Harga
   Satuan). Kalau produknya tidak ketemu (atau Shopify belum
   dikonfigurasi), field ini tetap bisa diisi manual seperti biasa.
2. **Webhook order**: tiap ada order baru masuk di Shopify, otomatis
   tersimpan sebagai Transaction baru (Sumber Order = `SHOPIFY`), langsung
   kelihatan di `/admin/transaction` — tidak ada tahap approval manual.

### 9.1 Custom app (buat akses cari produk)

Sejak Januari 2026 Shopify pindah ke **Dev Dashboard** untuk custom app —
tidak ada lagi token statis yang tinggal di-copy dari halaman admin. Yang
kamu dapat cuma **Client ID** + **Client Secret**, lalu app-nya sendiri
yang wajib menukar keduanya jadi access token tiap kali butuh (kode di
`src/lib/shopify/accessToken.ts` sudah handle ini — token di-cache 24 jam
lalu di-refresh otomatis, tidak perlu kamu urus manual).

1. Buka [Dev Dashboard](https://dev.shopify.com/dashboard/) → buat/pilih
   app kamu → pastikan scope minimal **`read_products`** aktif (untuk
   fitur cari produk; scope tambahan seperti `read_orders`/
   `read_customers` tidak masalah kalau kamu nanti mau pakai, cuma belum
   dipakai kode yang ada sekarang).
2. **Install app itu ke toko kamu** (harus dari Dev Dashboard, bukan lewat
   link instalasi biasa) — client credentials grant cuma jalan kalau app
   & toko ada di **organization** Dev Dashboard yang sama. Kalau nanti
   dapat error `shop_not_permitted`, ini penyebabnya paling sering.
3. Tab **Settings** di app tersebut → copy **Client ID** dan **Client
   secret**.
4. **Store domain**: domain `*.myshopify.com` toko kamu (bukan custom
   domain kalau ada) — lihat Shopify Admin → **Settings → Domains**, atau
   dari URL waktu login ke `admin.shopify.com/store/<nama-toko>` →
   domainnya `<nama-toko>.myshopify.com`.
5. Isi ke `.env`:
   ```
   SHOPIFY_STORE_DOMAIN=nama-toko-kamu.myshopify.com
   SHOPIFY_CLIENT_ID=xxxxxxxxxxxxxxxx
   SHOPIFY_CLIENT_SECRET=xxxxxxxxxxxxxxxx
   SHOPIFY_API_VERSION=2026-07
   ```

### 9.2 Webhook order baru

Dipakai event **Order payment** (`orders/paid`), bukan **Order creation**
(`orders/create`) — jadi Transaction baru cuma dibuat setelah order-nya
lunas (`financial_status = paid`), order dengan pembayaran manual/COD yang
belum dikonfirmasi tidak akan langsung masuk.

1. Di Shopify Admin: **Settings → Notifications**, scroll ke bagian
   **Webhooks** di bawah.
2. **Create webhook** → Event: **Order payment**, Format: **JSON**, URL:
   `https://<domain-app-kamu>/api/webhook/shopify/order/paid` (harus HTTPS
   — sama seperti `NEXT_PUBLIC_APP_URL`, kalau masih localhost butuh
   tunnel HTTPS mis. `ngrok` untuk testing).
3. Simpan. Masih di halaman **Webhooks**, ada bagian **Signing secret** —
   klik untuk lihat/copy nilainya, isi ke `.env`:
   ```
   SHOPIFY_WEBHOOK_SECRET=xxxxxxxxxxxxxxxx
   ```

Tiap item pesanan yang terbentuk dari order ini otomatis diisi **gambar
utama produknya** (IMAGE_URLS) dan **link ke halaman produknya**
(CUSTOM_NOTES, format `Produk Shopify: <url>`) — dua-duanya di-ambil
terpisah lewat Admin API karena payload webhook order sendiri tidak
menyertakan gambar/link produk (lihat `src/lib/shopify/mapOrder.ts` &
`productLookup.ts`).

### 9.3 Terapkan perubahan skema DB

Integrasi ini menambah 1 kolom baru (`shopify_order_id`) ke tabel
`transaction`, dipakai supaya kalau Shopify mengirim ulang webhook yang
sama (retry), tidak kebentuk Transaction dobel. Setelah `.env` di atas
terisi, jalankan:

```bash
npm run db:push
```

lalu restart `npm run dev` (atau redeploy kalau di production).

## 10. Sync kurs mata uang harian

Kolom `rate` di tabel `Currency` (dipakai buat convert Harga Satuan ke basis
IDR waktu bikin transaksi dengan currency selain IDR, lihat
`ItemPesananFields.tsx`) di-sync otomatis tiap hari dari
[ExchangeRate-API](https://www.exchangerate-api.com/), lewat Vercel Cron.

1. Daftar & ambil API key di [exchangerate-api.com](https://app.exchangerate-api.com/dashboard)
   (paket Free cukup untuk sync 1x/hari), isi ke `.env`:
   ```
   EXCHANGE_RATE_API_KEY=xxxxxxxxxxxxxxxx
   ```
2. Jadwalnya sudah diatur di `vercel.json` (`0 17 * * *` = jam 17:00 UTC =
   00:00 WIB tiap hari — **Vercel Cron selalu UTC**, kalau toko kamu bukan
   di zona WIB, sesuaikan jamnya). Aktif otomatis begitu di-deploy ke
   Vercel, tidak perlu setup tambahan di dashboard Vercel.
3. `CRON_SECRET` **tidak perlu diisi manual** — Vercel yang provision &
   kirim otomatis tiap manggil cron-nya. Endpoint-nya:
   `GET /api/cron/sync-exchange-rates`.
4. Paket **Hobby** Vercel: maksimal 2 cron job & minimal jeda 1x/hari
   (pas buat kebutuhan ini), tapi jam eksekusinya cuma dijamin akurat
   dalam rentang 1 jam (mis. dijadwalkan 17:00 UTC, bisa saja baru jalan
   sampai 17:59 UTC).
5. IDR sendiri di-skip (base currency kita, rate-nya selalu 1) — cuma
   currency lain yang sudah ada di tabel `Currency` yang di-update.
