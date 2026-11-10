-- Role DB Tebar Kebaikan (docs/04-database/database-security.md, constraints.md §Append-only).
-- JANGAN dijalankan otomatis di production. Jalankan manual oleh owner DB di branch dev/staging,
-- lalu set password tiap role lewat konsol Neon (bukan di file ini).
-- Jalankan SETELAH migrasi (GRANT per tabel butuh tabel yang sudah ada).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_migrator') THEN
    CREATE ROLE app_migrator LOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_rw') THEN
    CREATE ROLE app_rw LOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_ro') THEN
    CREATE ROLE app_ro LOGIN;
  END IF;
END
$$;

-- app_migrator: DDL di schema public (dipakai drizzle-kit migrate).
GRANT USAGE, CREATE ON SCHEMA public TO app_migrator;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO app_migrator;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO app_migrator;

-- app_rw: runtime aplikasi.
GRANT USAGE ON SCHEMA public TO app_rw;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_rw;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_rw;

-- Catatan keuangan: tanpa DELETE.
REVOKE DELETE ON transactions, payments, payment_events FROM app_rw;

-- payment_events append-only: INSERT/SELECT + UPDATE kolom status pemrosesan saja.
REVOKE UPDATE ON payment_events FROM app_rw;
GRANT UPDATE (result, processed_at, verification, payment_id) ON payment_events TO app_rw;

-- audit_logs: hanya INSERT/SELECT.
REVOKE UPDATE, DELETE, TRUNCATE ON audit_logs FROM app_rw;

-- app_ro: baca saja (laporan/rekonsiliasi).
GRANT USAGE ON SCHEMA public TO app_ro;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO app_ro;

-- Tabel baru yang dibuat app_migrator otomatis mendapat grant dasar.
-- Pengecualian (DELETE/UPDATE terbatas) di atas WAJIB diulang untuk tabel finansial baru.
ALTER DEFAULT PRIVILEGES FOR ROLE app_migrator IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_rw;
ALTER DEFAULT PRIVILEGES FOR ROLE app_migrator IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO app_rw;
ALTER DEFAULT PRIVILEGES FOR ROLE app_migrator IN SCHEMA public
  GRANT SELECT ON TABLES TO app_ro;
