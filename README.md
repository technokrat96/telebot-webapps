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
   USERNAME | NAME | ROLE
   budi       Budi   ADMIN
   siti        Siti   FLORIST
   joko        Joko   KURIR
   rina        Rina   ADMIN, FLORIST
   ```
   ROLE isinya `ADMIN`, `FLORIST`, dan/atau `KURIR`. Satu user boleh punya
   lebih dari satu role — pisahkan dengan koma (boleh juga `;`, `/`, atau
   `|`) dalam satu sel yang sama, contoh: `ADMIN, FLORIST`. User dengan
   lebih dari satu role akan melihat gabungan menu semua role-nya (mis.
   halaman Transaksi/Invoice **dan** halaman Florist). Parsing dilakukan di
   `src/lib/roles.ts`.

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
4. **Wajib**: user yang mengakses harus punya Telegram **username** (bukan
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
otomatis fallback ke user dummy (`Dev User`, role `ADMIN, FLORIST, KURIR`)
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
