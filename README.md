# AntaraPulsa — Go API + Vite Frontend

Web agen pulsa full-stack yang dipisah menjadi dua aplikasi mandiri.

## Menjalankan aplikasi

Buka dua terminal.

### Terminal 1 — Backend

```powershell
cd backend
go run ./cmd/api
```

Backend berjalan di `http://localhost:8080`.

### Terminal 2 — Frontend

```powershell
cd frontend
npm install
npm run dev
```

Frontend berjalan di `http://localhost:3000`.

## Akun demo

- Nomor: `081234567890`
- Kata sandi: `pulsa123`

## Struktur utama

```text
backend/
├── cmd/api/              entry point API
├── internal/auth/        autentikasi dan session
├── internal/handler/     route dan HTTP handler
├── internal/model/       model domain
└── internal/store/       penyimpanan dan logika transaksi

frontend/
├── src/components/       komponen UI reusable
├── src/config/           konfigurasi aplikasi
├── src/services/         komunikasi REST API
├── src/styles/           desain responsif
├── src/utils/            formatter/helper
├── src/app.js            controller aplikasi
├── index.html            seluruh halaman UI
└── vite.config.js        dev server dan proxy API
```

Data backend masih disimpan di memori dan kembali ke kondisi awal ketika backend dimulai ulang. Untuk produksi, gunakan PostgreSQL/MySQL, password hashing, CSRF protection, rate limiting, HTTPS, dan secret dari environment variable.
