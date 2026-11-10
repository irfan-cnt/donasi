# Seed Data

Seed dijalankan `pnpm db:seed` (idempoten, upsert by unique key). Production hanya menjalankan seed **referensi** (kategori, roles, permissions, provider, metode, template, settings). Seed **contoh** (campaign, donor, transaksi) hanya untuk dev/preview.

## Referensi
- **campaign_categories:** pendidikan, kesehatan, kemanusiaan, masjid, yatim-dhuafa, bencana-alam, palestina, lainnya.
- **roles:** owner, admin, finance, editor (`is_system = true`) + `role_permissions` sesuai BR-40.
- **permissions:** campaigns.read, campaigns.write, campaigns.publish, news.write, news.publish, transactions.read, transactions.export, transactions.reconcile, donors.read, donors.export, payment_methods.write, disbursements.write, notifications.write, settings.write, admins.manage, audit.read.
- **payment_providers:** midtrans (priority 1) — `is_enabled=false` sampai env tersedia. (Xendit tidak di-seed di MVP.)
- **payment_methods:** qris, gopay, shopeepay, bca_va, bni_va, bri_va, permata_va, cimb_va, mandiri_bill (semua Midtrans) — `is_active=false` default, instruksi standar per bank.
- **notification_templates:** 7 email + 4 WhatsApp sesuai notification-architecture.md (bahasa Indonesia); template `donation.created` di-seed `is_active = false` (OD-10).
- **platform_settings:** `platform.max_amount=1000000000`, `donation.default_min=10000`, `notifications.whatsapp_enabled=false`, `organization.name`, `organization.address`, `receipt.signatory`.
- **admin owner pertama:** dibuat lewat skrip CLI `pnpm admin:create --email ...` (password acak sekali tampil, wajib ganti + TOTP), **bukan** seed statis.

## Contoh (dev/preview)
- 8 campaign: 5 open (2 tanpa target), 3 fixed; status beragam (published, paused, completed, draft).
- 12 berita.
- 40 donor (10 dengan akun), 300 transaksi lintas status, payment + events sintetis.
- Data memakai nama fiktif dan domain `example.com`, nomor `+628000000xxxx`.
