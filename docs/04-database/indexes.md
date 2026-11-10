# Indexes

| Tabel | Index | Tujuan |
|---|---|---|
| campaigns | `UNIQUE(slug)` | Lookup detail |
| campaigns | `(status, published_at DESC)` | Listing beranda & `/campaign` |
| campaigns | `(category_id, status, published_at DESC)` | Filter kategori |
| campaigns | `(is_featured) WHERE status='published'` | Hero/pilihan |
| campaigns | `(end_at) WHERE status='published'` | Scheduler completed |
| campaigns | GIN `title gin_trgm_ops` | Cari judul di admin |
| campaign_images | `(campaign_id, sort_order)` | Galeri |
| campaign_disbursements | `(campaign_id, disbursed_at DESC) WHERE deleted_at IS NULL` | Rincian penyaluran di Campaign Detail |
| campaign_amount_options | `(campaign_id, kind, sort_order) WHERE is_active` | Checkout |
| campaign_news | `UNIQUE(campaign_id, slug)`; `(campaign_id, status, published_at DESC)` | Berita terkait |
| donors | `UNIQUE(email)`; `UNIQUE(user_id)`; GIN trigram `name` | Klaim, cari donor |
| transactions | `UNIQUE(code)` | Halaman publik |
| transactions | `(donor_id, created_at DESC)` | Riwayat donor |
| transactions | `(campaign_id, status, paid_at DESC)` | Donatur terbaru, total |
| transactions | `(status, created_at)` | Admin filter, job cancel-stale |
| transactions | `(created_at DESC)` | Admin listing default (keyset) |
| transactions | `(donor_email_snapshot)` | Cari & klaim tamu |
| payments | `UNIQUE(provider_id, provider_ref)` | Webhook lookup, idempotensi |
| payments | `UNIQUE(transaction_id) WHERE status IN ('pending','paid')` | Maks satu aktif (BR-11) |
| payments | `(status, expires_at) WHERE status='pending'` | Job expiry |
| payment_events | `UNIQUE(provider_id, provider_event_id)` | Dedup webhook |
| payment_events | `(payment_id, received_at DESC)`; `(received_at DESC)` | Log admin |
| notification_logs | `UNIQUE(dedup_key)`; `(transaction_id)`; `(status, created_at DESC)` | Dedup & log |
| notification_templates | `UNIQUE(event, channel) WHERE is_active` | Satu aktif per kombinasi (BR-30) |
| audit_logs | `(entity_type, entity_id, created_at DESC)`; `(actor_id, created_at DESC)` | Penelusuran |
| admin_sessions | `UNIQUE(token_hash)`; `(admin_user_id) WHERE revoked_at IS NULL` | |
| payment_methods | `(is_active, display_order)` | Select Payment |
