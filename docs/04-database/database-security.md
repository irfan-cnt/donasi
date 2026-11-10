# Database Security

1. **Role terpisah** (Neon):
   - `app_migrator` — DDL, dipakai hanya saat migrasi di CI.
   - `app_rw` — DML aplikasi; tanpa DDL; `audit_logs` INSERT/SELECT saja; tanpa DELETE di `transactions`, `payments`, `payment_events`.
   - `app_ro` — read-only untuk analitik/BI.
2. **Koneksi:** TLS wajib (`sslmode=require`), string koneksi hanya di env server. Preview memakai branch Neon terpisah, **tidak pernah** data produksi (seed sintetis).
3. **Secret tidak disimpan di DB:** kredensial payment/SMTP/Fonnte hanya env. `admin_users.totp_secret_enc` dienkripsi AES-256-GCM dengan `APP_ENCRYPTION_KEY`.
4. **Token di-hash:** `admin_sessions.token_hash`, `transactions.access_token_hash` (SHA-256). Auth.js `sessions.session_token` acak 32 byte.
5. **PII minimal & redaksi:** `payment_events.payload` disaring (hapus nomor kartu, token, signature mentah disimpan sebagai `***` setelah verifikasi). `ip_hash` = HMAC IP dengan salt.
6. **Anonimisasi akun:** saat donor menghapus akun → `donors.name='Donatur Terhapus'`, email diganti `deleted+{uuid}@invalid`, phone NULL, `anonymized_at` diisi; snapshot transaksi PII di-hash sesuai kebijakan retensi.
7. **Backup & PITR:** Neon history retention ≥7 hari (prod); uji restore per kuartal.
8. **Query aman:** Drizzle parameterized; larangan `sql.raw` dengan input user (lint rule).
9. **Row ownership:** semua repository donor menerima `donorId` dari sesi, bukan dari input.
10. **Monitoring:** log query lambat (>500 ms), alert koneksi gagal.
