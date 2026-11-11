# Constraints

## Integritas finansial
| Constraint | Lokasi | Menjamin |
|---|---|---|
| `amount BETWEEN 1000 AND 1000000000` | transactions | Batas absolut (BR-08) |
| `collected_amount >= 0` | campaigns | Tidak negatif (refund P25 mengurangi; pelanggaran = rollback) |
| `donor_count >= 0` | campaigns | P25 (migrasi 0003) |
| `UNIQUE(transaction_id) WHERE status IN ('pending','paid')` | payments | Satu payment aktif (BR-11) |
| `UNIQUE(provider_id, provider_ref)` | payments | Tidak ada dua record untuk referensi provider yang sama |
| `UNIQUE(provider_id, provider_event_id)` | payment_events | Webhook diproses sekali |
| `UNIQUE(receipt_no)` | transactions | Kuitansi unik |
| `CHECK (status='paid') = (paid_at IS NOT NULL)` | transactions | Konsistensi waktu bayar |
| FK `ON DELETE RESTRICT` | transactions, payments | Catatan keuangan tak bisa terhapus berantai |

## Validasi tingkat aplikasi (tidak bisa di DB murni)
- Nominal ∈ [campaign.min, campaign.max] dan [method.min, method.max] — divalidasi service; untuk fixed, `amount = option.amount` dan `option.campaign_id = transaction.campaign_id` (trigger opsional `trg_tx_option_matches_campaign`).
- Transisi status payment mengikuti state machine (fungsi `canTransition`). Opsional: trigger DB `trg_payment_status_transition` menolak transisi ilegal sebagai lapisan kedua.
- Campaign `published` harus punya ≥1 opsi `package` aktif bila `amount_type='fixed'` — dicek saat publish.

## Data & format
- `slug` regex kebab-case; `phone_e164` regex `+62`; `code` transaksi regex.
- `email` bertipe `citext` (case-insensitive unik).
- Panjang teks dibatasi (judul 10–120, ringkasan ≤200, SEO desc ≤160, doa ≤280).

## Append-only
- `audit_logs` dan `payment_events`: role DB aplikasi `app_rw` hanya punya `INSERT, SELECT` (plus `UPDATE` kolom `result, processed_at, verification, payment_id` untuk payment_events). Tidak ada `DELETE`.
