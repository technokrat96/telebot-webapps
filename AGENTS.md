<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Proyek ini

Webapp Telegram Mini App untuk **toko buket bunga**: mengintegrasikan alur kerja
**Admin** (input/kelola transaksi & invoice), **Florist** (kerjakan item
pesanan), dan **Kurir** (antar pesanan). Login lewat Telegram (otomatis,
tanpa form) atau lewat browser biasa (username/password). Detail fitur &
skema database lengkap ada di `README.md` — baca itu dulu sebelum
menjelajah kode.

## Stack & versi package penting

Semua versi persis ada di `package.json`; ini catatan hal-hal yang beda dari
training data kamu:

- **Next.js 16** (App Router). `params` di route handler dinamis (`[id]`)
  adalah `Promise` dan **wajib** di-`await`. `next lint` sudah dihapus —
  linting pakai ESLint flat config (`eslint.config.mjs`) dan **tidak**
  otomatis jalan saat `next build` (`next.config.ts` juga set
  `typescript.ignoreBuildErrors: true`, jadi build sukses walau ada error
  TS — jangan andalkan `npm run build` untuk cek tipe, pakai `tsc --noEmit`
  atau baca error editor).
- **React 19**, **Ant Design 6** (butuh React 18/19).
- **Prisma 7** dengan driver adapter (`@prisma/adapter-pg`, provider
  `postgresql`). Client generated ke `src/generated/prisma` (bukan lokasi
  default `node_modules/.prisma`) dan **di-gitignore** — wajib jalankan
  `npx prisma generate` (atau `npm install`, yang otomatis lewat
  `postinstall`) sebelum tipe `@/generated/prisma/*` tersedia.
- **grammY** untuk bot Telegram (bukan `node-telegram-bot-api` /
  `telegraf`), jalan lewat webhook (`src/app/api/webhook/telegram/route.ts`),
  bukan polling.
- Validasi initData Telegram Mini App pakai **`@tma.js/init-data-node`** /
  **`@tma.js/sdk-react`** (bukan `@telegram-apps/*` — package itu sudah
  dinyatakan deprecated oleh authornya sendiri, walau satu monorepo & API).
- **Zustand** untuk auth token client-side (`src/store/authStore.ts`,
  persisted ke localStorage), bukan Context/Redux untuk itu.
- **Vercel Blob** (`@vercel/blob`) untuk penyimpanan foto (private access,
  di-proxy lewat `/api/upload` — tidak ada URL publik langsung).
- **pdfkit** untuk generate invoice PDF, jalan di Node runtime
  (`serverExternalPackages: ['pdfkit']` di `next.config.ts`).
- Node.js minimum **>= 20.9**.

## Perintah

```bash
npm run dev          # dev server
npm run build         # prisma generate + next build
npm run lint          # eslint (terpisah, tidak otomatis saat build)
npm run db:sync        # prisma db pull + generate (tarik skema dari DB)
npm run db:push        # prisma db push + generate (dorong schema.prisma ke DB)
```

Tidak ada folder `prisma/migrations` yang dipakai aktif — schema dikelola
lewat `db push`, bukan migration files bertahap.

## Konvensi penting di codebase ini

- **Bahasa**: komentar & teks UI dalam Bahasa Indonesia (proyek untuk toko
  lokal). Ikuti gaya ini kalau menambah kode baru.
- **Domain types pakai `SCREAMING_SNAKE_CASE`** (`src/types/index.ts`:
  `Transaction`, `TransactionDetail`, `Invoice`, dst) — peninggalan dari
  versi awal proyek yang pakai Google Sheets sebagai database (kolom
  spreadsheet). Skema Postgres asli (`prisma/schema.prisma`) pakai
  `camelCase` standar. Setiap `src/lib/db/*.ts` punya pasangan mapper
  `toX()`/`fromX()` yang menjembatani dua konvensi ini — **selalu lewat
  layer ini**, jangan import Prisma model langsung ke komponen/route.
- **Auth**: semua API route mulai dengan
  `const auth = await requireAuth(req, ['ROLE', ...])` (`src/lib/auth.ts`).
  Role yang valid: `ADMIN`, `FLORIST`, `KURIR` (disimpan di tabel
  `master_data`, kategori `ROLE` — bisa nambah role baru dari situ, bukan
  hardcode). **Di `NODE_ENV !== 'production'`, `requireAuth` selalu
  mengembalikan user dummy ber-role semua** (lihat `src/lib/auth.ts`) —
  jangan kaget kalau auth "selalu lolos" saat `npm run dev`.
- **Dua jalur login**: Telegram Mini App (`POST /api/auth/login-telegram`,
  initData divalidasi lewat `@tma.js/init-data-node`, tanpa password) dan
  browser biasa (`POST /api/auth/login`, username/password, JWT 30 hari).
  Keduanya berakhir di JWT yang sama; role di JWT **tidak** dipercaya penuh
  — `requireAuth` selalu re-fetch role terbaru dari DB tiap request.
- **State bot Telegram** (multi-step flow seperti Register/Edit User) hidup
  di tabel `bot_session` (bukan in-memory) karena webhook jalan di
  serverless function tanpa state persisten antar-request.
- **Concurrency**: klaim item florist/kurir (`claimItem`,
  `advanceAssignmentDeliveryStatus`, dst di `src/lib/db/floristAssignment.ts`
  & `deliveryDriverAssignment.ts`) pakai `SELECT ... FOR UPDATE` di dalam
  `prisma.$transaction` untuk cegah race condition qty. Ikuti pola ini kalau
  menambah operasi tulis serupa.
- **Status pesanan derived, bukan kolom manual**: `ITEM_STATUS` di
  `TransactionDetail` naik otomatis lewat aksi (klaim/selesai florist,
  klaim/update status kurir) — alurnya `NEW ORDER → WORK IN PROGRESS → READY
  TO PICKUP → ON DELIVERY → DONE`. Jangan set field ini manual dari luar
  flow itu.

## Env vars

Lihat `.env` untuk daftar lengkap (tidak ada `.env.example` — file itu
sengaja di-gitignore). Kelompok: `DATABASE_URL` (Postgres), `JWT_SECRET`,
`TELEGRAM_BOT_TOKEN`/`TELEGRAM_BOT_SECRET_TOKEN`/`APP_URL`,
`BLOB_READ_WRITE_TOKEN`/`BLOB_STORE_ID` (Vercel Blob), `SHOPIFY_*` (opsional,
integrasi Shopify), `EXCHANGE_RATE_API_KEY` (cron sync kurs), `CRON_SECRET`
(auto-provision Vercel).

## Struktur folder singkat

```
src/app/            halaman (App Router, grouped di (app)/) + API routes
src/lib/db/           layer akses data (Prisma) + mapper ke domain types
src/lib/telegramBot/   logic bot grammY (command, callback, text handler)
src/lib/shopify/       integrasi Shopify (access token, webhook, product search)
src/lib/pdf/           generate invoice PDF (pdfkit)
src/components/        komponen React (common/ = shell & gate, sisanya per fitur)
prisma/schema.prisma    skema database
```

Untuk penjelasan fitur, alur bisnis, dan skema tabel selengkapnya, baca
`README.md`.
