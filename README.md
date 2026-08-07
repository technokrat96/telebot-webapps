# Florist Telegram Mini App

Webapp Next.js (App Router) + Ant Design untuk toko buket bunga, dibuka
lewat **Telegram Mini App** (atau browser biasa), yang mengintegrasikan
alur kerja tiga peran: **Admin** (input & kelola transaksi/invoice),
**Florist** (kerjakan item pesanan), dan **Kurir** (antar pesanan ke
pelanggan). Database-nya **PostgreSQL**, diakses lewat **Prisma 7**.

## Daftar isi

1. [Tech stack](#1-tech-stack)
2. [Arsitektur & alur login](#2-arsitektur--alur-login)
3. [Role & hak akses](#3-role--hak-akses)
4. [Skema database](#4-skema-database)
5. [Alur bisnis: siklus hidup satu pesanan](#5-alur-bisnis-siklus-hidup-satu-pesanan)
6. [Bot Telegram](#6-bot-telegram)
7. [Halaman & fitur web app](#7-halaman--fitur-web-app)
8. [API routes](#8-api-routes)
9. [Integrasi Shopify](#9-integrasi-shopify)
10. [Sync kurs mata uang](#10-sync-kurs-mata-uang)
11. [Upload & penyimpanan gambar](#11-upload--penyimpanan-gambar)
12. [Invoice PDF](#12-invoice-pdf)
13. [Setup & menjalankan lokal](#13-setup--menjalankan-lokal)
14. [Deploy](#14-deploy)
15. [Struktur folder](#15-struktur-folder)

---

## 1. Tech stack

| Bagian | Package | Catatan |
|---|---|---|
| Framework | Next.js 16 (App Router) | `output: "standalone"`, build tetap sukses walau ada error TypeScript (`ignoreBuildErrors: true`) |
| UI | React 19 + Ant Design 6 | `@ant-design/nextjs-registry` untuk SSR style |
| Database | PostgreSQL | via `pg` + `@prisma/adapter-pg` |
| ORM | Prisma 7 | client generated ke `src/generated/prisma` (gitignored, jalankan `prisma generate`) |
| Bot Telegram | grammY | webhook-based, bukan polling |
| Telegram Mini App SDK | `@tma.js/sdk-react`, `@tma.js/init-data-node` | pengganti `@telegram-apps/*` yang deprecated |
| Auth | JWT (`jsonwebtoken`) + `bcryptjs` | token 30 hari, disimpan client via Zustand + localStorage |
| State client | Zustand | `src/store/authStore.ts` |
| Storage gambar | Vercel Blob | private access, di-proxy lewat API route |
| PDF | pdfkit | generate invoice |
| E-commerce | Shopify Admin API (`@shopify/admin-api-client`) | opsional: cari produk + webhook order |
| Kurs mata uang | ExchangeRate-API | disinkron harian via Vercel Cron |
| Fetching data client | SWR | |

Node.js minimum **>= 20.9**.

## 2. Arsitektur & alur login

Ada dua cara masuk ke aplikasi, keduanya menghasilkan JWT yang sama:

**a. Dari dalam Telegram Mini App** — `AuthProvider`
(`src/components/common/AuthProvider.tsx`) memanggil `init()` +
`retrieveRawInitData()` dari `@tma.js/sdk-react`. Kalau berhasil (berarti
dibuka lewat Telegram), initData dikirim ke `POST /api/auth/login-telegram`,
divalidasi di server dengan `@tma.js/init-data-node` (`src/lib/telegram.ts`),
lalu server mencari/memperbarui `AppUser` berdasarkan Telegram
username. Tidak ada form sama sekali — login otomatis & diam-diam, dan
`chatId`/`telegramId` user ikut ter-update di request ini.

**b. Dari browser biasa** — form username/password
(`src/components/common/LoginScreen.tsx`) memanggil `POST /api/auth/login`.
Password di-hash dengan bcrypt, hanya bisa dipakai kalau user pernah
set password (lewat halaman `/telegram-setup`, dibuka dari tombol
"Set Password" di bot Telegram atau di menu akun).

Setelah login, token JWT (berisi `username`, `name`, `roles` — lihat
`src/lib/jwt.ts`) disimpan di `authStore` dan dikirim di header
`Authorization: Bearer <token>` (`src/lib/apiClient.ts`) untuk semua request
API berikutnya. Setiap API route memverifikasi token lewat
`requireAuth(req, allowedRoles)` (`src/lib/auth.ts`) — token cuma dipakai
untuk **identitas**, role selalu di-re-fetch dari database tiap request
supaya perubahan role oleh admin langsung berlaku tanpa perlu login ulang.

> Di `NODE_ENV !== 'production'` (mis. `npm run dev`), `requireAuth` selalu
> mengembalikan user dummy dengan **semua role** (`ADMIN, FLORIST, KURIR`) —
> memudahkan development tanpa perlu setup Telegram/login sungguhan.

Gate tambahan yang dilewati user sebelum masuk ke aplikasi utama (lihat
`AuthProvider`):

- **`TelegramLinkGate`** — kalau akun belum pernah terhubung ke Telegram
  (login browser tapi `telegramId`/`chatId` masih kosong), user diminta
  buka bot dulu supaya bisa menerima notifikasi.
- **`SetPasswordGate`** — sekali saja setelah login pertama lewat Telegram
  & belum pernah set password, ditawari (boleh dilewati) supaya bisa juga
  login lewat browser nanti.
- **`AttendanceGate`** (`src/components/common/AttendanceGate.tsx`) — user
  harus check-in absensi hari itu sebelum menu navigasi (Transaksi,
  Invoice, Florist, Kurir, dst) muncul di `AppShell`.

## 3. Role & hak akses

Tiga role: **`ADMIN`**, **`FLORIST`**, **`KURIR`** (nilai valid disimpan di
tabel `master_data` kategori `ROLE`, jadi bisa ditambah tanpa ubah kode).
Satu user boleh punya lebih dari satu role. Role dicek dua kali — di UI
(`RoleGuard`, item menu `AppShell`) supaya UX rapi, dan **wajib** juga di
setiap API route lewat `requireAuth(req, ['ROLE', ...])` supaya bukan cuma
disembunyikan di frontend.

| Role | Bisa akses |
|---|---|
| Admin | Semua halaman `/admin/*` (transaksi, invoice, rekap absensi), plus fitur umum |
| Florist | `/florist` — klaim & kerjakan item pesanan |
| Kurir | `/kurir` — klaim & antar pesanan yang siap kirim |
| Semua role | `/`, `/account`, `/attendance` (absensi harian) |

Manajemen user (register, lihat, edit role, hapus) **hanya lewat bot
Telegram**, bukan lewat halaman web — lihat [bagian 6](#6-bot-telegram).

## 4. Skema database

Postgres, dikelola via `prisma/schema.prisma`. Ringkasan tiap tabel:

**`app_user`** — akun pengguna. `username` adalah primary key (username
Telegram, disimpan lowercase). Menyimpan `telegramId`/`chatId` (diisi
otomatis begitu user pernah `/start` bot atau login-telegram) dan
`password` (hash bcrypt, nullable — null berarti belum pernah set password
lewat `/telegram-setup`).

**`user_role`** — relasi many-to-many `app_user` ↔ role (satu baris per
kombinasi username+role, cascade delete kalau user dihapus).

**`master_data`** — dropdown options generik, dikelompokkan per
`category` (`ROLE`, `PAYMENT_METHOD`, `ORDER_SOURCE`, `ITEM_STATUS`,
`DELIVERY_METHOD`, `DELIVERY_STATUS`, `CARD_STATUS`, `INVOICE_STATUS`,
`FLORIST_ASSIGNMENT_STATUS`), diurutkan lewat `sortOrder`. Dibaca via
`GET /api/master-data`, tersedia di client lewat `MasterDataProvider`.

**`currency`** — daftar mata uang yang didukung + `rate`-nya terhadap IDR
(basis: berapa IDR setara 1 unit currency itu). Disinkron harian, lihat
[bagian 10](#10-sync-kurs-mata-uang).

**`bot_session`** — state percakapan bot Telegram per `chatId` (JSON bebas
di kolom `data`), dipakai untuk flow multi-langkah seperti Register/Edit
User yang butuh input teks di tengah jalan. Disimpan di DB (bukan
in-memory) karena webhook Telegram jalan di serverless function — tiap
request bisa kena instance berbeda.

**`transaction`** — satu pesanan/order (mis. `ORD-1735...`). Simpan info
pelanggan, total, uang muka, sisa tagihan, metode bayar, dan
`shopifyOrderId` (unique, nullable) untuk mencegah duplikasi kalau webhook
Shopify retry.

**`transaction_detail`** — item per pesanan (satu order bisa punya banyak
item). Ini tabel paling "gemuk": nama item, qty, harga satuan + currency +
rate, catatan, `itemStatus` (status kerja — lihat [bagian
5](#5-alur-bisnis-siklus-hidup-satu-pesanan)), data kartu ucapan (to/from/
pesan/status), metode & jadwal kirim, ongkir, data penerima (kalau beda
dari pembeli), dan `imageUrls` (foto produk/bukti).

**`invoice`** — tagihan yang dibuat dari satu atau lebih item pesanan yang
sudah/belum lunas. Berdiri sendiri dari `transaction` (satu invoice bisa
menagih item dari transaksi yang sama, item bisa ditagih parsial across
beberapa invoice).

**`invoice_detail`** — baris item per invoice, referensi ke
`transaction_detail` lewat `orderItemId`, simpan qty & harga yang **ditagih
di invoice itu** (bisa beda dari qty total item, kalau ditagih bertahap).

**`florist_assignment`** — klaim seorang florist atas sebagian/seluruh qty
satu item pesanan. Satu item bisa dikerjakan lebih dari satu florist
(dibagi qty-nya). `status`: `ASSIGNED` → `COMPLETED`, atau `RELEASED` kalau
dibatalkan.

**`delivery_driver_assignment`** — sama polanya dengan
`florist_assignment`, tapi untuk kurir. Tambahan `deliveryStatus`
(`PICKUP` → `ON DELIVERY` → `DELIVERED`/`RETURNED`) dan `imageUrls` (foto
bukti kirim, wajib diisi tiap kali status berubah).

**`attendance`** — absensi harian per user (`checkInAt`/`checkOutAt`),
unique per `(username, date)`. Menentukan apakah user boleh mengakses menu
aplikasi hari itu (lihat `AttendanceGate`).

Semua tabel Postgres pakai `camelCase` di level Prisma model, tapi domain
type di `src/types/index.ts` (dipakai di seluruh UI & API) pakai
`SCREAMING_SNAKE_CASE` — peninggalan dari versi awal proyek yang memakai
Google Sheets sebagai database. Setiap file di `src/lib/db/*.ts` punya
fungsi mapper (`toTransaction`, `fromInvoice`, dst) yang menjembatani dua
konvensi ini; kode lain di luar folder itu tidak pernah menyentuh Prisma
model secara langsung.

## 5. Alur bisnis: siklus hidup satu pesanan

`ITEM_STATUS` pada `transaction_detail` bergerak otomatis mengikuti aksi
florist/kurir (bukan field yang di-set manual):

```
NEW ORDER ──(florist klaim qty)──▶ WORK IN PROGRESS
                                          │
                          (florist tandai qty selesai,
                           terakumulasi sampai = qty total item)
                                          ▼
                                READY TO PICKUP
                                          │
                          (kurir klaim qty) ──▶ ON DELIVERY
                                          │
                    (kurir update status per assignment,
                     wajib 1 foto bukti tiap perubahan)
                                          ▼
                            DELIVERED (per assignment)
                                          │
                (terakumulasi sampai semua qty item DELIVERED)
                                          ▼
                                        DONE
```

Cabang `RETURNED` juga tersedia di level assignment kurir (status
terminal, belum ada alur reschedule otomatis). Klaim ditulis di tabel
`florist_assignment`/`delivery_driver_assignment` — satu item bisa dipecah
qty-nya ke beberapa orang, dan semua operasi klaim/lepas/selesaikan
dijalankan di dalam Postgres transaction dengan `SELECT ... FOR UPDATE`
untuk mencegah dua orang mengklaim qty yang sama secara bersamaan.

**Invoice** dibuat terpisah dari status kerja di atas — admin bisa menagih
qty item kapan saja (biasanya setelah `DONE`, tapi tidak dipaksa), dan satu
item bisa ditagih bertahap ke beberapa invoice selama total qty yang
ditagih tidak melebihi qty item (dicek ulang dari DB, bukan dari state
client, saat invoice dibuat — lihat `createInvoice` di
`src/lib/db/invoice.ts`).

## 6. Bot Telegram

Dibangun dengan **grammY**, jalan lewat webhook
(`POST /api/webhook/telegram`, diverifikasi dengan
`TELEGRAM_BOT_SECRET_TOKEN`). Bot cuma punya **satu slash command**
(`/start`) — semua menu lain dikendalikan lewat inline keyboard
(`src/lib/telegramBot/menu.ts`):

- **Who Am I** — semua user, tampilkan nama/username/role terdaftar.
- **Register User**, **Check User** (khusus `ADMIN`) — Register: ketik
  username Telegram → pilih satu/lebih role lewat checkbox inline → simpan.
  Check: cari username (substring, case-insensitive) → dari hasil bisa
  **Edit Role** atau **Hapus User**.
- **Set Password** — muncul kalau `AppUser.password` masih kosong,
  membuka `/telegram-setup` sebagai Telegram Web App.

User baru yang belum terdaftar (belum ada baris di `app_user` + role)
otomatis dibuatkan barisnya tanpa role saat pertama kali `/start`/interaksi,
lalu semua admin yang sudah pernah terhubung ke bot dikirimi notifikasi
untuk meng-assign role-nya. Perubahan role oleh admin juga langsung
mengirim notifikasi ke user yang bersangkutan. Flow multi-langkah (nunggu
input username, nunggu pilihan role) dilacak lewat tabel `bot_session` per
`chatId`, dan otomatis direset bersih setiap `/start`.

## 7. Halaman & fitur web app

Route group `(app)` (lihat `src/app/(app)/`):

- **`/`** — Home, shortcut sesuai role.
- **`/account`** — profil, ganti password, dsb.
- **`/attendance`** — check-in/check-out absensi harian (semua role).
- **`/admin/transaction`**, **`/admin/transaction/create`**,
  **`/admin/transaction/[id]`**, **`/admin/transaction/[id]/edit`** —
  CRUD transaksi + item pesanannya. Form input item mendukung paste teks
  order dari WhatsApp (`src/lib/orderTextParser.ts` mem-parsing format
  "Detail PEMBELI/PENERIMA/Order/Custom Greeting Card") dan pencarian
  produk Shopify langsung dari field nama item.
- **`/admin/invoice`**, **`/admin/invoice/create`**,
  **`/admin/invoice/create/[id]`** — buat invoice dari item transaksi yang
  belum (atau belum sepenuhnya) ditagih, lihat daftar invoice + status
  lunas/belum.
- **`/admin/attendance`** — rekap absensi semua staff (filter tanggal &
  username).
- **`/florist`** — dua tab: item yang tersedia untuk diklaim (status
  `NEW ORDER`/`WORK IN PROGRESS`) dan klaim milik sendiri, dengan aksi
  tandai selesai.
- **`/kurir`** — sama polanya: item siap kirim (`READY TO PICKUP`/
  `ON DELIVERY`) yang tersedia diklaim, dan assignment milik sendiri untuk
  update status pengiriman (wajib upload 1 foto bukti tiap perubahan
  status).
- **`/telegram-setup`** — halaman standalone (dibuka sebagai Telegram Web
  App dari tombol bot) untuk set/ganti password.

## 8. API routes

Semua di `src/app/api/`, tiap route dijaga `requireAuth` dengan daftar role
yang diizinkan. Kelompok utama:

- `auth/` — `login`, `login-telegram`, `me`, `set-password`.
- `transactions/`, `transaction-details/` — CRUD transaksi & item,
  termasuk update status kartu ucapan.
- `invoices/`, `invoice-details/` — CRUD invoice, `invoices/[id]/pdf`
  (generate & unduh PDF), `invoices/[id]/pdf-link` (link sekali pakai
  ber-token, lihat [bagian 12](#12-invoice-pdf)),
  `invoices/[id]/send-telegram` (kirim PDF ke chat Telegram user).
- `florist-assignments/` — list tersedia + milik sendiri, klaim
  (`POST`), lepas (`release`), tandai selesai (`complete`).
- `delivery-assignments/` — pola sama, plus `advance` (majukan status
  pengiriman + foto bukti) dan `photos` (tambah foto tanpa ganti status).
- `attendance/` — `check-in`, `check-out`, riwayat sendiri (`GET /`), dan
  `attendance/all` (rekap semua staff, khusus admin).
- `master-data/` — dropdown options (semua role terautentikasi).
- `upload/` — upload/ambil/hapus foto (lihat [bagian
  11](#11-upload--penyimpanan-gambar)).
- `users/by-role`, `users/with-telegram` — dropdown "assign ke user lain"
  di halaman admin.
- `shopify/products/search` — cari produk Shopify untuk field nama item.
- `webhook/telegram` — endpoint webhook bot (grammY `webhookCallback`).
- `webhook/shopify/order/paid` — webhook order Shopify (lihat [bagian
  9](#9-integrasi-shopify)).
- `cron/sync-exchange-rates` — dipanggil Vercel Cron harian (lihat
  [bagian 10](#10-sync-kurs-mata-uang)).

## 9. Integrasi Shopify

Opsional — semua fitur di bawah tetap bisa dilewati (field manual, tidak
ada order Shopify) kalau `SHOPIFY_*` env kosong.

**Cari produk** (field "Nama Item" di form transaksi) — mengetik sebagian
judul/SKU memunculkan saran dari Shopify Admin API, memilihnya mengisi
otomatis nama (format `[kode produk]-[nama]`) dan harga satuan.

**Webhook order** (`orders/paid`, bukan `orders/create`) — begitu order
Shopify **lunas**, otomatis dibuatkan `Transaction` baru
(`ORDER_SOURCE = SHOPIFY`), langsung muncul di `/admin/transaction` tanpa
approval manual. Idempotent lewat `shopifyOrderId` unik (retry webhook
Shopify tidak bikin transaksi dobel). Gambar produk & link produk
diambil terpisah lewat Admin API (payload webhook order sendiri tidak
menyertakannya) — lihat `src/lib/shopify/mapOrder.ts` & `productLookup.ts`.

Autentikasi ke Shopify pakai **client credentials grant** (Dev Dashboard,
bukan token statis lama) — access token di-cache 24 jam & di-refresh
otomatis oleh `src/lib/shopify/accessToken.ts`.

## 10. Sync kurs mata uang

Kolom `rate` di tabel `currency` (dipakai konversi harga item non-IDR ke
basis IDR saat transaksi dibuat) disinkron **otomatis tiap hari** dari
[ExchangeRate-API](https://www.exchangerate-api.com/) lewat Vercel Cron
(`vercel.json`, endpoint `GET /api/cron/sync-exchange-rates`). IDR sendiri
di-skip (base currency, rate selalu 1); hanya currency yang sudah terdaftar
di tabel `currency` yang di-update.

## 11. Upload & penyimpanan gambar

Foto (gambar item pesanan admin, foto bukti kirim kurir) dikompres dulu di
browser (`browser-image-compression`, otomatis koreksi orientasi EXIF, jalan
di Web Worker) sebelum diupload ke **Vercel Blob** dengan access **private**
lewat `POST /api/upload`. Karena private, tampilannya selalu lewat proxy
`GET /api/upload?url=...` (terautentikasi via header Authorization) yang
mem-stream isi blob-nya — client lalu mengubahnya jadi `data:` URL
(`fileToDataUrl`) untuk ditampilkan, bukan `URL.createObjectURL` (supaya
tidak ada masalah lifecycle revoke saat dipakai ulang di modal
preview/zoom). Proxy yang sama juga menangani gambar produk Shopify
(dibatasi allowlist domain `*.myshopify.com`/`cdn.shopify.com` supaya tidak
jadi celah SSRF).

## 12. Invoice PDF

`src/lib/pdf/invoicePdf.ts` men-generate PDF invoice (header, info
penagihan, tabel item, total) dengan **pdfkit**, dipanggil dari
`GET /api/invoices/[id]/pdf`. Untuk kebutuhan share link (mis. dikirim ke
pelanggan tanpa perlu login), ada `pdf-link` yang menghasilkan token
sekali pakai (`src/lib/pdfToken.ts` — HMAC ditandatangani pakai
`TELEGRAM_BOT_TOKEN`, kedaluwarsa 5 menit) yang bisa dipasang di URL PDF
tanpa header Authorization.

## 13. Setup & menjalankan lokal

```bash
npm install
cp .env .env.local   # isi semua env var (lihat daftar di bawah)
npm run db:push       # terapkan schema.prisma ke database
npm run dev
```

Env var yang dibutuhkan (lihat juga catatan tiap kelompok di bagian
relevan di atas):

```
DATABASE_URL=                     # Postgres connection string
JWT_SECRET=                       # signing secret untuk JWT login
TELEGRAM_BOT_TOKEN=               # dari @BotFather
TELEGRAM_BOT_SECRET_TOKEN=        # secret custom untuk verifikasi webhook
APP_URL=                          # URL production app (HTTPS), dipakai bot buat tombol Web App
NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=  # username bot (tanpa @), dipakai tombol "Buka Bot" di TelegramLinkGate
BLOB_READ_WRITE_TOKEN=            # Vercel Blob
BLOB_STORE_ID=
SHOPIFY_STORE_DOMAIN=              # opsional
SHOPIFY_CLIENT_ID=
SHOPIFY_CLIENT_SECRET=
SHOPIFY_API_VERSION=
SHOPIFY_WEBHOOK_SECRET=
EXCHANGE_RATE_API_KEY=            # opsional, untuk cron sync kurs
CRON_SECRET=                      # auto-provision oleh Vercel, tidak perlu isi manual
NEXT_PUBLIC_CLIENT_REV_TAG=       # opsional, cache-busting versi client
```

Karena Mini App butuh konteks Telegram asli, saat `retrieveRawInitData()`
gagal (tidak dibuka lewat Telegram) **dan** `NODE_ENV !== 'production'`,
`requireAuth` di server otomatis fallback ke user dummy ber-semua-role,
jadi bisa develop langsung di browser tanpa setup Telegram/database
attendance dulu (lihat catatan di `src/lib/auth.ts` dan
`AttendanceGate.tsx`).

### Setup Google Cloud / Telegram Bot & Mini App (ringkas)

1. Chat [@BotFather](https://t.me/BotFather) → `/newbot` → simpan token.
2. `/setmenubutton` (atau `/newapp`) → arahkan ke `NEXT_PUBLIC_APP_URL`
   production (harus HTTPS).
3. Daftarkan webhook Telegram ke
   `https://<domain-app>/api/webhook/telegram` dengan secret token yang
   sama dengan `TELEGRAM_BOT_SECRET_TOKEN`.
4. User yang mengakses wajib punya **username** Telegram (bukan cuma
   nama) — dipakai sebagai primary key `app_user`.

## 14. Deploy

Deploy sebagai Next.js app biasa (didesain untuk Vercel — ada
`vercel.json` untuk cron job). Pastikan:

- HTTPS aktif (wajib untuk Telegram Mini App & webhook Shopify/Telegram).
- Semua env var di atas terisi di environment production.
- `APP_URL` sama dengan URL yang didaftarkan ke BotFather.
- Webhook Telegram & (kalau dipakai) webhook Shopify `orders/paid`
  terdaftar ke domain production.
- Setelah `prisma/schema.prisma` berubah, jalankan `npm run db:push`
  sebelum/saat deploy supaya skema DB production ikut update.

## 15. Struktur folder

```
src/
  app/
    (app)/                 halaman utama (App Router, perlu auth)
    api/                    semua API route (REST-ish, dijaga requireAuth)
    telegram-setup/          halaman standalone set password
  components/
    common/                 AppShell, AuthProvider, gate-gate (Attendance/
                             TelegramLink/SetPassword), RoleGuard, MasterDataProvider
    transaction/, invoice/, florist/, kurir/  komponen per fitur
  lib/
    db/                     akses data Prisma + mapper ke domain types (SCREAMING_SNAKE_CASE)
    telegramBot/             logic bot grammY (command/callback/text handler, menu)
    shopify/                 integrasi Shopify (access token, webhook verify, product search)
    pdf/                     generate invoice PDF
    auth.ts, jwt.ts, password.ts, telegram.ts   inti autentikasi
    apiClient.ts             fetch wrapper client (attach JWT, upload+kompresi gambar)
  store/                    Zustand store (authStore)
  types/                    domain types (SCREAMING_SNAKE_CASE, dipakai UI & API)
  generated/prisma/         Prisma client hasil generate (gitignored)
prisma/schema.prisma        skema database
```
