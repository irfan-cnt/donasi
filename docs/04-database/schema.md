# Schema (DDL referensi)

> DDL di bawah adalah spesifikasi; implementasi final ditulis sebagai skema Drizzle (`src/lib/db/schema/*.ts`) dan migrasi `drizzle-kit`. Ekstensi: `citext`, `pg_trgm`.

## Enum

```sql
CREATE TYPE campaign_status   AS ENUM ('draft','published','paused','completed','archived');
CREATE TYPE amount_type       AS ENUM ('open','fixed');
CREATE TYPE amount_option_kind AS ENUM ('suggested','package'); -- suggested: chip open amount; package: fixed
CREATE TYPE news_status       AS ENUM ('draft','published');
CREATE TYPE transaction_status AS ENUM ('created','pending','paid','expired','failed','cancelled','refunded');
CREATE TYPE payment_status    AS ENUM ('created','pending','paid','expired','failed','cancelled','refunded');
CREATE TYPE payment_method_type AS ENUM ('qris','ewallet','virtual_account','retail','card');
CREATE TYPE event_verification AS ENUM ('pending','verified','rejected');
CREATE TYPE event_result      AS ENUM ('received','processed','duplicate','ignored_transition','amount_mismatch','unknown_payment','error');
CREATE TYPE notification_channel AS ENUM ('email','whatsapp');
CREATE TYPE notification_status  AS ENUM ('queued','sent','failed','skipped');
CREATE TYPE admin_status      AS ENUM ('active','locked','disabled');
```

## Identitas & donor

```sql
-- Auth.js (nama kolom mengikuti @auth/drizzle-adapter)
CREATE TABLE users (
  id uuid PRIMARY KEY,
  name text, email citext UNIQUE NOT NULL, email_verified timestamptz, image text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE accounts (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type text NOT NULL, provider text NOT NULL, provider_account_id text NOT NULL,
  refresh_token text, access_token text, expires_at int, token_type text, scope text, id_token text, session_state text,
  PRIMARY KEY (provider, provider_account_id)
);
CREATE TABLE sessions (
  session_token text PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires timestamptz NOT NULL
);
CREATE TABLE verification_tokens (identifier text, token text, expires timestamptz NOT NULL, PRIMARY KEY (identifier, token));

CREATE TABLE donors (
  id uuid PRIMARY KEY,
  user_id uuid UNIQUE REFERENCES users(id) ON DELETE SET NULL,
  email citext NOT NULL UNIQUE,                 -- dinormalisasi (lower, trim)
  name text NOT NULL,
  phone_e164 text CHECK (phone_e164 ~ '^\+62[0-9]{8,13}$'),
  whatsapp_opt_in boolean NOT NULL DEFAULT false,
  default_anonymous boolean NOT NULL DEFAULT false,
  anonymized_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
```

## Admin & RBAC

```sql
CREATE TABLE admin_users (
  id uuid PRIMARY KEY, email citext UNIQUE NOT NULL, name text NOT NULL,
  password_hash text NOT NULL, totp_secret_enc text, totp_enabled boolean NOT NULL DEFAULT false,
  status admin_status NOT NULL DEFAULT 'active', failed_login_count int NOT NULL DEFAULT 0, locked_until timestamptz,
  last_login_at timestamptz, must_change_password boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE admin_sessions (
  id uuid PRIMARY KEY, admin_user_id uuid NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  token_hash bytea UNIQUE NOT NULL, ip inet, user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(), last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL, revoked_at timestamptz
);
CREATE TABLE roles (id uuid PRIMARY KEY, code text UNIQUE NOT NULL, name text NOT NULL, is_system boolean NOT NULL DEFAULT false);
CREATE TABLE permissions (code text PRIMARY KEY, description text NOT NULL);
CREATE TABLE role_permissions (role_id uuid REFERENCES roles(id) ON DELETE CASCADE, permission_code text REFERENCES permissions(code), PRIMARY KEY (role_id, permission_code));
CREATE TABLE admin_user_roles (admin_user_id uuid REFERENCES admin_users(id) ON DELETE CASCADE, role_id uuid REFERENCES roles(id), PRIMARY KEY (admin_user_id, role_id));
```

## Campaign & news

```sql
CREATE TABLE campaign_categories (
  id uuid PRIMARY KEY, slug text UNIQUE NOT NULL, name text NOT NULL, icon text, sort_order int NOT NULL DEFAULT 0, is_active boolean NOT NULL DEFAULT true
);
CREATE TABLE campaigns (
  id uuid PRIMARY KEY,
  category_id uuid NOT NULL REFERENCES campaign_categories(id),
  title text NOT NULL CHECK (char_length(title) BETWEEN 10 AND 120),
  slug text UNIQUE NOT NULL CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  short_description text NOT NULL CHECK (char_length(short_description) <= 200),
  description_html text NOT NULL,               -- sudah disanitasi
  featured_image_url text, featured_image_alt text,
  target_amount bigint CHECK (target_amount IS NULL OR target_amount > 0),
  collected_amount bigint NOT NULL DEFAULT 0 CHECK (collected_amount >= 0),
  donor_count int NOT NULL DEFAULT 0,
  amount_type amount_type NOT NULL DEFAULT 'open',
  min_amount bigint NOT NULL DEFAULT 10000 CHECK (min_amount >= 1000),
  max_amount bigint CHECK (max_amount IS NULL OR max_amount >= min_amount),
  start_at timestamptz, end_at timestamptz CHECK (end_at IS NULL OR start_at IS NULL OR end_at > start_at),
  status campaign_status NOT NULL DEFAULT 'draft',
  is_featured boolean NOT NULL DEFAULT false,
  seo_title text, seo_description text CHECK (seo_description IS NULL OR char_length(seo_description) <= 160),
  published_at timestamptz,
  created_by uuid REFERENCES admin_users(id), updated_by uuid REFERENCES admin_users(id),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT published_requires_image CHECK (status = 'draft' OR (featured_image_url IS NOT NULL AND featured_image_alt IS NOT NULL))
);
CREATE TABLE campaign_images (
  id uuid PRIMARY KEY, campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  url text NOT NULL, alt text NOT NULL, width int, height int, sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE campaign_amount_options (
  id uuid PRIMARY KEY, campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  kind amount_option_kind NOT NULL,
  label text,                                   -- mis. 'Paket 1 – Makan 5 anak'
  amount bigint NOT NULL CHECK (amount >= 1000),
  description text,
  sort_order int NOT NULL DEFAULT 0, is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, kind, amount)
);
CREATE TABLE campaign_news (
  id uuid PRIMARY KEY, campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE RESTRICT,
  title text NOT NULL, slug text NOT NULL, excerpt text CHECK (char_length(excerpt) <= 300),
  content_html text NOT NULL, featured_image_url text, featured_image_alt text,
  status news_status NOT NULL DEFAULT 'draft', published_at timestamptz,
  seo_title text, seo_description text,
  deleted_at timestamptz,
  created_by uuid REFERENCES admin_users(id), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, slug),
  CHECK (status = 'draft' OR published_at IS NOT NULL)
);
-- Rincian penyaluran dana (OD-06, disetujui 10 Nov 2026; BR-43)
CREATE TABLE campaign_disbursements (
  id uuid PRIMARY KEY,
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE RESTRICT,
  amount bigint NOT NULL CHECK (amount > 0),     -- rupiah, bigint (total per campaign <= collected_amount dijaga di service dalam transaction)
  kind text NOT NULL CHECK (kind IN ('program','operational','bank_fee')),
  description text NOT NULL CHECK (char_length(description) <= 500),
  disbursed_at date NOT NULL,
  news_id uuid REFERENCES campaign_news(id) ON DELETE SET NULL,  -- berita sebagai bukti (opsional; harus campaign yang sama, divalidasi di service)
  deleted_at timestamptz,                        -- soft delete
  created_by uuid NOT NULL REFERENCES admin_users(id),
  updated_by uuid REFERENCES admin_users(id),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX campaign_disbursements_campaign_idx ON campaign_disbursements (campaign_id, disbursed_at DESC) WHERE deleted_at IS NULL;
```

## Transaksi & pembayaran

```sql
CREATE TABLE payment_providers (
  id uuid PRIMARY KEY, code text UNIQUE NOT NULL CHECK (code IN ('midtrans'))  -- perluas bila provider lain ditambah,
  name text NOT NULL, is_enabled boolean NOT NULL DEFAULT false, priority int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
  -- TIDAK ada kolom kredensial
);
CREATE TABLE payment_methods (
  id uuid PRIMARY KEY, provider_id uuid NOT NULL REFERENCES payment_providers(id),
  code text NOT NULL,                           -- kode internal: 'qris','bca_va',...
  provider_channel text NOT NULL,               -- kode channel di provider
  type payment_method_type NOT NULL, display_name text NOT NULL, logo_url text,
  instructions jsonb NOT NULL DEFAULT '[]',     -- [{title:'m-BCA', steps:['...']}]
  min_amount bigint NOT NULL DEFAULT 1000, max_amount bigint,
  expiry_minutes int NOT NULL DEFAULT 1440 CHECK (expiry_minutes BETWEEN 5 AND 4320),
  fee_flat bigint NOT NULL DEFAULT 0, fee_percent numeric(5,2) NOT NULL DEFAULT 0, fee_borne_by text NOT NULL DEFAULT 'platform' CHECK (fee_borne_by IN ('platform','donor')),  -- OD-04: MVP selalu 'platform' (lembaga menanggung)
 
  is_active boolean NOT NULL DEFAULT false, display_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider_id, code)
);

CREATE TABLE transactions (
  id uuid PRIMARY KEY,
  code text UNIQUE NOT NULL CHECK (code ~ '^TK-[0-9]{6}-[0-9A-HJKMNP-TV-Z]{6}$'),
  access_token_hash bytea NOT NULL, access_token_expires_at timestamptz NOT NULL,
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE RESTRICT,
  donor_id uuid NOT NULL REFERENCES donors(id) ON DELETE RESTRICT,
  amount_option_id uuid REFERENCES campaign_amount_options(id),
  amount bigint NOT NULL CHECK (amount BETWEEN 1000 AND 1000000000),
  status transaction_status NOT NULL DEFAULT 'created',
  -- snapshot (BR-12)
  campaign_title_snapshot text NOT NULL,
  donor_name_snapshot text NOT NULL, donor_email_snapshot citext NOT NULL, donor_phone_snapshot text,
  is_anonymous boolean NOT NULL DEFAULT false, prayer text CHECK (char_length(prayer) <= 280),
  whatsapp_opt_in boolean NOT NULL DEFAULT false,
  paid_at timestamptz, receipt_no text UNIQUE, receipt_issued_at timestamptz,
  source jsonb,                                  -- utm, referrer (tanpa PII)
  ip_hash bytea, user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((status = 'paid') = (paid_at IS NOT NULL) OR status = 'refunded')
);

CREATE TABLE payments (
  id uuid PRIMARY KEY,                           -- = order_id / reference_id ke provider
  transaction_id uuid NOT NULL REFERENCES transactions(id) ON DELETE RESTRICT,
  payment_method_id uuid NOT NULL REFERENCES payment_methods(id),
  provider_id uuid NOT NULL REFERENCES payment_providers(id),
  provider_ref text,
  amount bigint NOT NULL CHECK (amount > 0),
  fee_amount bigint NOT NULL DEFAULT 0,
  status payment_status NOT NULL DEFAULT 'created',
  instruction jsonb,                             -- VA/QR/URL/kode (tanpa secret)
  expires_at timestamptz, paid_at timestamptz, failure_reason text,
  fallback_from_id uuid REFERENCES payments(id),
  last_checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider_id, provider_ref)
);

CREATE TABLE payment_events (
  id uuid PRIMARY KEY,
  provider_id uuid NOT NULL REFERENCES payment_providers(id),
  provider_event_id text,                        -- id unik event / hash payload
  payment_id uuid REFERENCES payments(id),
  event_type text NOT NULL,                      -- notification (webhook), status_check, create_request, create_error, expire_request
  verification event_verification NOT NULL DEFAULT 'pending',
  result event_result NOT NULL DEFAULT 'received',
  status_reported text, amount_reported bigint,
  payload jsonb NOT NULL,                        -- ter-redaksi
  error_message text,
  received_at timestamptz NOT NULL DEFAULT now(), processed_at timestamptz,
  UNIQUE (provider_id, provider_event_id)
);

CREATE TABLE receipt_counters (year int PRIMARY KEY, last_seq int NOT NULL DEFAULT 0);
```

## Notifikasi, audit, pengaturan

```sql
CREATE TABLE notification_templates (
  id uuid PRIMARY KEY, event text NOT NULL, channel notification_channel NOT NULL,
  name text NOT NULL, subject text, body text NOT NULL,
  is_active boolean NOT NULL DEFAULT false, version int NOT NULL DEFAULT 1,
  updated_by uuid REFERENCES admin_users(id),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (channel <> 'email' OR subject IS NOT NULL)
);
CREATE TABLE notification_logs (
  id uuid PRIMARY KEY, channel notification_channel NOT NULL, recipient text NOT NULL,
  template_id uuid REFERENCES notification_templates(id), template_version int,
  transaction_id uuid REFERENCES transactions(id), event text NOT NULL,
  dedup_key text UNIQUE,                         -- event:transaction:channel
  request_payload jsonb, status notification_status NOT NULL DEFAULT 'queued',
  provider_response jsonb, error_message text, attempt int NOT NULL DEFAULT 0,
  is_test boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(), sent_at timestamptz
);
CREATE TABLE audit_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_type text NOT NULL CHECK (actor_type IN ('admin','donor','system','provider')),
  actor_id uuid, action text NOT NULL,           -- 'campaign.update', 'transaction.export', 'reconciliation.issue'
  entity_type text NOT NULL, entity_id text,
  before jsonb, after jsonb, metadata jsonb, ip inet, user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE platform_settings (
  key text PRIMARY KEY, value jsonb NOT NULL, description text,
  updated_by uuid REFERENCES admin_users(id), updated_at timestamptz NOT NULL DEFAULT now()
);
```

## Catatan implementasi (P02)

- `notification_logs.template_id` memakai `ON DELETE SET NULL` sesuai `relationships.md` (DDL di atas tidak menyebut aksi; relationships.md menjadi acuan).
- FK yang di `relationships.md` bertanda RESTRICT (kategori→campaign, provider→method, method→payment, provider→event, opsi nominal→transaksi) ditulis eksplisit `ON DELETE RESTRICT`; FK tanpa aksi tetap `NO ACTION`.
- Constraint CHECK/UNIQUE diberi nama eksplisit (`<tabel>_<kolom>_check`, `..._key`) agar error mudah dipetakan di aplikasi; `published_requires_image` tetap.
- Ekstensi `citext` dan `pg_trgm` dibuat di migrasi manual `drizzle/0000_extensions.sql` (sebelum tabel). Partial index dan CHECK seluruhnya terekspresikan oleh builder Drizzle — tidak perlu SQL manual tambahan.
