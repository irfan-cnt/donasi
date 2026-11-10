# Relationships

| Parent | Child | Kardinalitas | ON DELETE | Catatan |
|---|---|---|---|---|
| users | accounts, sessions | 1:N | CASCADE | Auth.js |
| users | donors | 1:0..1 | SET NULL | Donor tetap ada bila akun dihapus (anonimisasi) |
| donors | transactions | 1:N | RESTRICT | Catatan keuangan tidak boleh hilang |
| campaign_categories | campaigns | 1:N | RESTRICT | Kategori dinonaktifkan, bukan dihapus |
| campaigns | campaign_images | 1:N | CASCADE | Hanya untuk draft yang dihapus |
| campaigns | campaign_amount_options | 1:N | CASCADE | Opsi yang sudah dipakai transaksi → nonaktifkan, jangan hapus (RESTRICT via transactions FK) |
| campaigns | campaign_news | 1:N | RESTRICT | |
| campaigns | transactions | 1:N | RESTRICT | Campaign bertransaksi tidak bisa dihapus (AC-24.1) |
| campaign_amount_options | transactions | 1:N (opsional) | RESTRICT | Hanya untuk fixed |
| transactions | payments | 1:N | RESTRICT | Maks satu pending/paid aktif |
| payment_providers | payment_methods | 1:N | RESTRICT | |
| payment_methods | payments | 1:N | RESTRICT | |
| payments | payments (fallback_from_id) | 0..1:N | — | Jejak fallback |
| payment_providers | payment_events | 1:N | RESTRICT | |
| payments | payment_events | 0..1:N | — | Event bisa datang untuk payment tak dikenal |
| transactions | notification_logs | 0..1:N | — | Log tes tidak terkait transaksi |
| notification_templates | notification_logs | 1:N | SET NULL | Simpan `template_version` |
| admin_users | admin_sessions, admin_user_roles | 1:N | CASCADE | |
| roles | role_permissions | 1:N | CASCADE | |

## Turunan & invarian

1. `transactions.status` = cermin status payment aktif terakhir (atau `created` bila belum ada payment).
2. `campaigns.collected_amount = SUM(amount) FROM transactions WHERE campaign_id = c.id AND status = 'paid'` — diverifikasi job rekonsiliasi harian; selisih → audit + alert, perbaikan hanya via skrip yang tercatat.
3. `campaigns.donor_count` = jumlah transaksi paid (bukan donor unik) — label UI "x donasi". Donor unik dihitung on-demand bila diperlukan.
4. `transactions.amount = payments.amount` untuk semua payment transaksi itu (fee tercatat terpisah di `fee_amount`).
5. `receipt_no` hanya terisi bila status pernah `paid`.
