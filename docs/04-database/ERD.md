# Entity Relationship Diagram

Database: Neon PostgreSQL 17 · ORM: Drizzle · Konvensi: `snake_case`, PK `uuid` (UUIDv7 dibuat aplikasi), uang `bigint` rupiah, waktu `timestamptz`.

## Perubahan dari daftar tabel master prompt

| Usulan awal | Keputusan | Alasan |
|---|---|---|
| `users` + `donor_profiles` + `donors` | `users` (identitas login Auth.js) + `donors` (profil donatur, termasuk tamu) | `donor_profiles` duplikat `donors`; tamu tidak punya `users` |
| `transaction_items` | **Tidak dibuat** | 1 transaksi = 1 campaign = 1 nominal (BR-11); paket fixed direferensikan langsung `transactions.amount_option_id`. Bisa ditambah bila kelak ada keranjang multi-campaign |
| `roles` | `roles`, `permissions`, `role_permissions`, `admin_user_roles` | RBAC granular |
| (baru) | `accounts`, `sessions`, `verification_tokens` | Wajib untuk Auth.js adapter |
| (baru) | `admin_sessions` | Sesi admin terpisah |
| (baru) | `campaign_amount_options` | Paket fixed & saran nominal open dapat diurutkan/aktif-nonaktif |
| (baru) | `receipt_counters` | Nomor kuitansi berurutan per tahun tanpa celah |
| (baru, OD-06) | `campaign_disbursements` | Rincian penyaluran dana (transparansi) — disetujui PM 10 Nov 2026 |

## Diagram

```mermaid
erDiagram
  users ||--o{ accounts : has
  users ||--o{ sessions : has
  users ||--o| donors : "is (optional)"
  donors ||--o{ transactions : makes

  campaign_categories ||--o{ campaigns : groups
  campaigns ||--o{ campaign_images : has
  campaigns ||--o{ campaign_amount_options : offers
  campaigns ||--o{ campaign_news : publishes
  campaigns ||--o{ transactions : receives
  campaigns ||--o{ campaign_disbursements : "reports"
  campaign_amount_options |o--o{ transactions : "selected in"

  transactions ||--o{ payments : "attempts"
  payment_providers ||--o{ payment_methods : provides
  payment_methods ||--o{ payments : "used by"
  payment_providers ||--o{ payment_events : sends
  payments |o--o{ payment_events : "about"

  notification_templates ||--o{ notification_logs : renders
  transactions |o--o{ notification_logs : triggers

  admin_users ||--o{ admin_sessions : has
  admin_users ||--o{ admin_user_roles : assigned
  roles ||--o{ admin_user_roles : grants
  roles ||--o{ role_permissions : contains
  permissions ||--o{ role_permissions : in
  admin_users |o--o{ audit_logs : performs

  donors {
    uuid id PK
    uuid user_id FK "nullable, unique"
    citext email UK
    text name
    text phone_e164
    bool whatsapp_opt_in
  }
  campaigns {
    uuid id PK
    text slug UK
    enum status
    enum amount_type "open|fixed"
    bigint target_amount "nullable"
    bigint collected_amount
    bigint min_amount
    bigint max_amount
  }
  transactions {
    uuid id PK
    text code UK
    uuid campaign_id FK
    uuid donor_id FK
    uuid amount_option_id FK
    bigint amount
    enum status
    text receipt_no UK
    jsonb receipt_snapshot
    bytea receipt_hash
  }
  payments {
    uuid id PK
    uuid transaction_id FK
    uuid payment_method_id FK
    text provider_ref
    enum status
    bigint amount
    jsonb instruction
    timestamptz expires_at
  }
  payment_events {
    uuid id PK
    uuid provider_id FK
    text provider_event_id
    uuid payment_id FK
    enum verification
    enum result
    jsonb payload
  }
```

## Relasi inti: donor ↔ transaksi ↔ payment ↔ campaign

1. **Donor** (login atau tamu) membuat **transaksi** untuk tepat satu **campaign** dengan satu nominal.
2. Transaksi memiliki 1..n **payment** (percobaan). Paling banyak satu payment `pending|paid` (partial unique index).
3. Setiap payment memakai satu **payment method** milik satu **provider**.
4. **Payment events** menyimpan semua webhook/respon provider; dipakai untuk audit & idempotensi.
5. Ketika payment → `paid`, transaksi → `paid` dan `campaigns.collected_amount` bertambah sekali (BR-19). Total selalu dapat diverifikasi ulang: `SUM(transactions.amount WHERE status='paid' AND campaign_id=X)`.
