# Payment Architecture

> **Keputusan 10 Nov 2026 (OD-03):** MVP hanya memakai **Midtrans Core API**. Interface `PaymentProvider` tetap dibangun agar provider lain bisa ditambahkan tanpa mengubah alur checkout; bagian Xendit di bawah menjadi referensi untuk fase berikutnya dan **tidak diimplementasikan** di MVP. Fallback antar-provider (BR-16) nonaktif.

## 1. Prinsip
1. Status bayar hanya dari **webhook terverifikasi** atau **query status ke API provider**.
2. Semua pemrosesan **idempoten**; total campaign bertambah sekali per transaksi.
3. Setiap interaksi provider dicatat di `payment_events`.
4. Secret hanya di server (`MIDTRANS_SERVER_KEY`).
5. Hanya metode yang benar-benar didukung provider aktif yang ditampilkan.

## 2. Interface

```ts
// src/lib/payments/types.ts
export type ProviderCode = 'midtrans'; // tambah 'xendit' bila OD-03 dibuka kembali
export type MethodType = 'qris' | 'ewallet' | 'virtual_account' | 'retail' | 'card';
export type PaymentStatus = 'created' | 'pending' | 'paid' | 'expired' | 'failed' | 'cancelled' | 'refunded';

export interface CreatePaymentInput {
  paymentId: string;          // UUID internal → idempotency key / order_id
  transactionCode: string;
  amount: bigint;             // rupiah
  method: { code: string; type: MethodType; providerChannel: string }; // mis. 'bca_va', 'gopay', 'qris'
  customer: { name: string; email: string; phone?: string };
  description: string;
  expiresInMinutes: number;
  successRedirectUrl: string; // hanya untuk UX, bukan bukti bayar
}

export interface PaymentInstruction {
  kind: 'virtual_account' | 'qr' | 'redirect' | 'payment_code';
  bankName?: string;
  vaNumber?: string;
  qrString?: string;          // dirender jadi gambar QR di server/client
  qrImageUrl?: string;
  paymentUrl?: string;        // deeplink / checkout URL e-wallet
  paymentCode?: string;
  billerCode?: string;        // Mandiri Bill (echannel)
  billKey?: string;
  expiresAt: Date;
  raw?: Record<string, unknown>; // ter-redaksi
}

export interface CreatePaymentResult { providerRef: string; status: PaymentStatus; instruction: PaymentInstruction; }
export interface StatusResult { providerRef: string; status: PaymentStatus; paidAmount?: bigint; paidAt?: Date; needsReview?: boolean; raw: unknown; }
export interface VerifiedWebhook { eventId: string; providerRef: string; orderId: string; status: PaymentStatus; amount: bigint; paidAt?: Date; needsReview?: boolean; raw: unknown; }

export interface PaymentProvider {
  readonly code: ProviderCode;
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
  getPaymentStatus(ref: { providerRef: string; orderId: string }): Promise<StatusResult>;
  verifyWebhook(req: { headers: Headers; rawBody: string }): Promise<VerifiedWebhook>; // throw bila tidak valid
  getPaymentInstructions(payment: { providerRef: string; instruction: PaymentInstruction }): PaymentInstruction;
  expirePayment(ref: { providerRef: string; orderId: string }): Promise<void>;
}
```

Registry: `getProvider(code)` membaca konfigurasi env; provider tanpa kredensial dianggap **tidak terkonfigurasi** dan metodenya tidak tampil.

## 3. Adapter

> Endpoint & field persis **wajib diverifikasi ulang** terhadap dokumentasi resmi saat Development Step 5 (API provider berevolusi).

### Midtrans (Core API)
| Fungsi | Implementasi |
|---|---|
| createPayment | `POST {base}/v2/charge` dengan `payment_type` (`bank_transfer`, `qris`, `gopay`, `shopeepay`, `echannel` untuk Mandiri), `transaction_details.order_id = payment.id`, `gross_amount`, `custom_expiry` |
| getPaymentStatus | `GET {base}/v2/{order_id}/status` |
| verifyWebhook | `signature_key == SHA512(order_id + status_code + gross_amount + SERVER_KEY)`; lalu **cross-check** `getPaymentStatus` |
| expirePayment | `POST {base}/v2/{order_id}/expire` (407 = berhasil; 404/412 = sudah final → cek status) |
| Mapping status | `settlement`/`capture(accept)` → paid; `capture(challenge)` → pending + `needsReview`; `capture(deny)`/`deny`/`failure` → failed; `pending` → pending; `expire` → expired; `cancel` → cancelled; `refund`/`partial_refund` → refunded (dicatat, `needsReview`, tanpa otomatisasi); lainnya (`authorize`, `chargeback`, …) → error `unmapped_status` (tidak diterapkan) |
| Base URL | sandbox `https://api.sandbox.midtrans.com`, prod `https://api.midtrans.com` |

### 3a. Implementasi Midtrans (P10, T-23) — `src/lib/payments/midtrans/`
- `mapping.ts` (murni): kanal → `payment_type`, body charge, normalisasi instruksi, pemetaan status, `gross_amount` → bigint (pecahan ditolak), signature SHA512 + `timingSafeEqual`. `provider.ts`: `createMidtransProvider({serverKey, isProduction, recordEvent, fetch?, now?, timeoutMs?})`. `event-log.ts`: sink `payment_events` (`create_request`/`create_error`/`status_check`/`expire_request`, `provider_event_id` NULL, `payment_id` hanya bila baris `payments` ada). `redact.ts`: header tidak pernah disimpan; kunci `authorization|server_key|signature_key|token|password|secret` → `[REDACTED]`, email/phone/first_name/last_name disamarkan (nama kunci case-insensitive), literal server key diganti. `errors.ts`: `MidtransError{code,userMessage,retryable}` (pesan ramah donatur).
- HTTP: Basic `base64(SERVER_KEY + ":")`, timeout 10 s (`AbortSignal.timeout`, termasuk saat membaca body → `timeout`/`network`). **POST (charge/expire) tidak pernah di-retry.** GET di-retry 1× hanya bila `fetch` melempar sebelum ada respons (jaringan/timeout); 4xx/5xx ber-body tidak pernah di-retry.
- Pemulihan charge: error jaringan/timeout atau 406 `duplicate_order` → `GET status`. Pending + nominal sama + instruksi lengkap → kembalikan instruksi charge yang sudah ada; transaksi tidak ada → error asli (boleh dicoba lagi); status lain/instruksi tak lengkap → `duplicate_order`; nominal beda → `invalid_response`. Pemulihan expire: error jaringan → cek status; bukan pending = selesai.
- `order_id`: milik kita (`createPayment`, `getPaymentStatus`, `expirePayment`) wajib UUID; `order_id` notifikasi wajib `^[A-Za-z0-9._~-]{1,50}$` dan bukan `.`/`..` (aman untuk path). `event-log.ts` hanya menautkan `payment_id` bila `order_id` UUID valid (perbandingan `uuid`, tanpa cast `::text`). Hasil ditentukan dari `status_code` di body (Midtrans membalas HTTP 200 untuk error, terverifikasi di sandbox).
- `createPayment` memvalidasi respons: `order_id` & `gross_amount` sama dengan request, `transaction_id` ada, status `pending`. `expiresAt` = `expiry_time` respons (WIB) atau fallback `now + expiry_minutes`.
- `verifyWebhook`: Zod → signature (dengan `gross_amount` string persis) → `GET status` → status, nominal, `paidAt` **dari API**; `transaction_id` notifikasi harus sama dengan API. `eventId = transaction_id:transaction_status:status_code` (dipisah `:`). Hanya `VerifiedWebhook`/`StatusResult` ini yang boleh masuk `applyVerifiedStatus` (M2).
- QR: dari `qr_string` saja; URL `generate-qr-code` Midtrans tidak pernah dipakai/disimpan di instruksi. GoPay tanpa `qr_string` → `kind: redirect` (deeplink).
- Env guard (`env.ts`): selain `APP_ENV=production`, `MIDTRANS_IS_PRODUCTION` wajib false; `APP_ENV=production` mewajibkan `MIDTRANS_IS_PRODUCTION=true` (tanpa pengecualian staging); mode sandbox mewajibkan prefix `SB-Mid-server-`/`SB-Mid-client-`; mode production menolak kunci `SB-`.

#### Perbedaan dokumentasi resmi Midtrans vs catatan playbook (dicek 10 Nov 2026; docs resmi menang)
1. **Permata VA**: integrasi resmi memakai `payment_type: "permata"` tanpa objek `bank_transfer` ([Bank Transfer](https://docs.midtrans.com/docs/coreapi-core-api-bank-transfer-integration)); playbook: `bank_transfer` + bank `permata`. Adapter memakai `"permata"`. Sandbox menerima keduanya dan membalas `payment_type: "bank_transfer"` + `permata_va_number`.
2. **Mandiri Bill**: tabel atribut docs menyebut `bill_key` = "company code" dan `biller_code` = "bill number", tetapi contoh respons (dan respons sandbox nyata: `biller_code "70012"`, `bill_key` 12 digit) menunjukkan sebaliknya. Adapter: `billerCode` = kode perusahaan, `billKey` = kode bayar. `bill_info1` ≤10 karakter, `bill_info2` ≤30 (dipotong Mandiri).
3. **Expire**: sukses = `status_code "407"` ("Success, transaction has expired"), bukan 200 ([Expire](https://docs.midtrans.com/reference/expire-transaction)). 412 = merchant tidak boleh mengubah status; 404 tidak didokumentasikan di halaman itu tetapi sandbox mengembalikan `status_code "404"` (HTTP 200). Tidak ada fallback `cancel`.
4. **Get Status 404**: dikembalikan sebagai HTTP 200 dengan body `status_code "404"` ([Get Status](https://docs.midtrans.com/reference/get-transaction-status); terverifikasi sandbox). Semua hasil dibaca dari body.
5. **QR GoPay**: docs [GoPay](https://docs.midtrans.com/docs/coreapi-e-money-integration) menyarankan *hotlink* URL `generate-qr-code`; kebijakan kita tetap tidak memuat gambar dari domain Midtrans (QR hanya dari `qr_string`; GoPay → deeplink).
6. **Batas expiry**: ShopeePay & QRIS default 5 menit (dokumen lain: 15 menit), min 20 detik, maks 5 hari; GoPay maks 7 hari ([ShopeePay & QRIS](https://docs.midtrans.com/reference/shopeepay), [Charge](https://docs.midtrans.com/reference/charge-transactions-1)). Seed 15 menit aman; `custom_expiry` melebihi batas ditolak Midtrans.
7. **Status notifikasi**: halaman [HTTP Notification](https://docs.midtrans.com/docs/https-notification-webhooks) juga mendefinisikan `authorize` (kartu) dan tidak mendefinisikan `chargeback` → dipetakan ke error `unmapped_status`. `capture + deny` → failed (playbook tidak menyebut).
8. **Kode error tambahan**: 402 "Payment channel is not activated" dan (GoPay) 404 "Merchant pop id is not found" pada charge — dipetakan ke `channel_unavailable` ("Metode pembayaran ini sedang tidak tersedia…"); 406 = order_id duplikat; 429 = rate limit.
9. **QRIS `acquirer`**: halaman QRIS Core API tidak dapat diakses (404) saat dicek; adapter mengirim `qris.acquirer = "gopay"` sesuai playbook — verifikasi saat QRIS aktif di sandbox.
10. **Retry webhook Midtrans**: 2xx tanpa retry; 500 → 1×, 503 → 4×, 400/404 → 2×, lainnya hingga 5× (≈2/10/30/90/210 menit). Relevan untuk P13 (balas 200 untuk event duplikat/anomali yang sudah dicatat).

### 3b. Select Payment & createPayment (P11, T-20/T-25) — `src/server/services/payment-service.ts`
- Daftar metode: `payment_methods` aktif × `payment_providers.is_enabled` × provider terkonfigurasi env (`isProviderConfigured`). Cache Redis `tk:cache:payment-methods:active:v1` TTL 5 menit (dev tanpa Upstash → DB langsung); admin (P22) wajib memanggil `invalidatePaymentMethodsCache()` setelah mengubah metode/provider. Grup QRIS / E-Wallet / Virtual Account (Mandiri Bill masuk VA); metode yang `min_amount`/`max_amount`-nya tidak mencakup nominal disembunyikan (`src/lib/payments/method-groups.ts`). Saat membuat pembayaran metode dibaca segar dari DB (bukan cache).
- `createPaymentForTransaction`: Zod → token (hash) + slug → transaksi `created|pending` → lock Redis `tk:lock:payment:{trxId}` 60 s (menutup expire 10 s + charge 10 s + pemulihan Get Status + margin; fallback in-memory hanya dev; Redis error → **fail-closed** di preview/production (pesan "coba lagi"), lanjut hanya di development; indeks `payments_one_active_per_tx_idx` (`status IN ('pending','paid')`, migrasi 0001) sebagai cadangan) → payment pending metode sama dengan sisa > 60 s dipakai ulang → insert payment `created` (UUIDv7 = order_id) → payment pending metode lain: `provider.expirePayment` dulu (gagal → berhenti, payment lama tetap sah), lalu **langsung** `pending→cancelled` di DB agar charge mati tidak pernah dipakai ulang di jalur gagal mana pun → `provider.createPayment` → **satu transaksi DB** (`FOR UPDATE` transaksi): lama `pending→cancelled`, baru `created→pending` (+provider_ref, instruction, expires_at), transaksi `pending`. Transaksi tidak pernah terlihat `cancelled`.
- Gagal provider: payment baru `failed`, pesan `MidtransError.userMessage`, transaksi tetap `created`/`pending` (bisa dicoba lagi). `failure_reason` & log hanya berisi kode (`midtrans:<code>[:status]`, `db:<sqlstate>`, atau nama kelas error) — tidak pernah body request/PII.
- Aktivasi gagal (indeks satu-aktif, transaksi sudah paid, error DB) setelah charge baru dibuat → payment baru `failed` (provider_ref disimpan bila tidak bentrok) + charge di-expire ke provider. Bila expire itu gagal: log error (paymentId, providerRef) + audit `payment.orphan_charge` (actor system, metadata transactionId/paymentId/providerRef/cause). **Rekonsiliasi P14 wajib mencakup payment `failed` yang punya provider_ref dan audit `payment.orphan_charge`** (charge bisa dibayar → alert P16).
- Placeholder instruksi memakai DTO minimal (kode, nominal, status, judul program; tanpa data donatur).
- Setelah sukses: QStash `payment.pending` ke `/api/jobs/notify` (dedup `payment-pending-{paymentId}`, handler P16). Tanpa `QSTASH_TOKEN` hanya di `APP_ENV=development` → log & lewati. Redirect `/transaksi/{code}/instruksi?t=` (placeholder; P12). `successRedirectUrl` ke provider = `/transaksi/{code}` **tanpa** token.

### Xendit (referensi — ditunda, tidak diimplementasikan di MVP)
| Fungsi | Implementasi |
|---|---|
| createPayment | Payments/Payment Request API (versi dipilih saat implementasi) dengan `reference_id = payment.id`, header `Idempotency-key = payment.id`, channel VA/QRIS/e-wallet |
| getPaymentStatus | GET payment request by id |
| verifyWebhook | header `x-callback-token` dibandingkan `XENDIT_WEBHOOK_TOKEN` (timing-safe), lalu cross-check status via API |
| expirePayment | endpoint expire/cancel sesuai channel bila tersedia; bila tidak, cek status dan tandai lokal setelah dipastikan belum dibayar |
| Mapping status | `SUCCEEDED` → paid; `PENDING`/`REQUIRES_ACTION` → pending; `EXPIRED` → expired; `FAILED` → failed; `CANCELED` → cancelled |

## 4. State machine

```mermaid
stateDiagram-v2
  [*] --> created
  created --> pending: createPayment OK
  created --> failed: createPayment error final
  pending --> paid: webhook/status verified
  pending --> expired: expiry + provider check
  pending --> failed: provider failure
  pending --> cancelled: ganti metode / batal
  paid --> refunded: (masa depan, manual)
  paid --> [*]
```

Status **transaksi** diturunkan dari payment aktif: `created` (belum ada payment), `pending`, `paid`, `expired`, `failed`, `cancelled`, `refunded`.

## 5. Pemrosesan webhook (pseudocode)

```ts
POST /api/webhooks/[provider]
  raw = await req.text()
  event = insert payment_events {provider, raw(redacted), received_at, verification:'pending'}
  try verified = provider.verifyWebhook({headers, raw})
  catch → update event 'rejected'; return 401
  if exists payment_events(provider, event_id=verified.eventId, processed=true) → return 200   // dedup
  db.transaction(async tx => {
    p = SELECT * FROM payments WHERE id = verified.orderId FOR UPDATE
    if !p → mark 'unknown_payment'; return
    if verified.amount !== p.amount → mark 'amount_mismatch'; alert; return
    if !canTransition(p.status, verified.status) → mark 'ignored_transition'; return
    UPDATE payments SET status, paid_at, provider_ref ...
    if verified.status === 'paid':
       updated = UPDATE transactions SET status='paid', paid_at=now(), receipt_no=nextval(...)
                 WHERE id=p.transaction_id AND status <> 'paid' RETURNING *
       if updated: UPDATE campaigns SET collected_amount += amount, donor_count += 1 WHERE id = ...
    mark event processed
  })
  publish QStash notify(event, transactionId)   // dedup key = event:trx:channel
  revalidateTag(`campaign:${slug}`)
  return 200
```

Kunci idempotensi:
- `payment_events UNIQUE(provider_id, provider_event_id)`
- `payments UNIQUE(provider_id, provider_ref)`
- Guard `WHERE status <> 'paid'` + `SELECT ... FOR UPDATE`
- `notification_logs UNIQUE(dedup_key)`

### 5a. Implementasi (P09, T-22) — `src/lib/payments/apply-verified-status.ts`
- `applyVerifiedStatus(tx, {paymentId, status, amount, paidAt, source, eventId, providerRef?})` dipanggil di dalam `getTxDb().transaction()` (driver WebSocket Pool; HTTP driver tidak mendukung transaksi interaktif). `source` ∈ `webhook | expiry_job | reconcile | admin_check`. `eventId` = `payment_events.id` milik event webhook (opsional).
- Urutan: `SELECT ... FROM payments WHERE id = $1 FOR UPDATE` → unknown → nominal (`paid` tanpa nominal juga dianggap `amount_mismatch`) → status sama = `duplicate` → `canTransition` → `UPDATE payments` → turunkan status transaksi.
- `paid`: `UPDATE transactions SET status='paid' ... WHERE id=$1 AND status NOT IN ('paid','refunded') RETURNING` (guard BR-19 diperluas agar transaksi `refunded` tidak kembali paid). Hanya bila baris kembali: `campaigns` += amount/1 dan nomor kuitansi `KW/YYYY/NNNNNN` dari `INSERT INTO receipt_counters ... ON CONFLICT (year) DO UPDATE SET last_seq = last_seq + 1 RETURNING last_seq` (YYYY = tahun `paid_at` Asia/Jakarta; upsert agar tahun baru tidak gagal).
- Status non-paid diturunkan ke transaksi hanya bila transisi transaksi legal (`TRANSACTION_TRANSITIONS`) dan tidak ada attempt lain yang `pending/paid`. Transaksi boleh `expired/failed/cancelled → pending` (attempt baru, BR-11).
- **Anomali** (tidak melempar; ikut ter-commit): `payment_events.result` (`unknown_payment`, `amount_mismatch`, `ignored_transition`) — update event webhook bila `eventId` ada, selain itu baris baru `event_type = internal.<source>`; plus `audit_logs` (actor `system`, entity `payment`) aksi `payment.amount_mismatch`, `payment.unknown_payment`, `payment.ignored_transition`, `payment.needs_review` (uang masuk ke payment yang sudah expired/cancelled atau transaksi sudah paid lewat payment lain — BR-17), dan log JSON terstruktur.
- **Alert admin internal:** hasil fungsi berisi `alert` (`amount_mismatch | paid_after_terminal | unknown_payment | refund_reported | needs_review`). Pengiriman email admin belum ada (P16): P16 mengirim `alert` ini ke `EMAIL_ADMIN_ALERT` setelah commit dan dapat memindai `audit_logs` aksi `payment.*` sebagai cadangan.
- Hasil `{outcome, changed, becamePaid, newStatus, transactionStatus, campaignId, receiptNo, alert}`; notifikasi & `revalidateTag` hanya bila `becamePaid`, di luar transaksi DB.
- Registry (`registry.ts`): `getProvider(code)` → `null` bila env (`MIDTRANS_SERVER_KEY` + `MIDTRANS_CLIENT_KEY`) tidak lengkap (slot Midtrans diisi `createMidtransFromEnv` di P10). Tidak ada provider palsu di `src/`; `FakeProvider` hanya di `tests/support/`.

## 6. Rekonsiliasi
- **Expiry job** (5 menit) dan **rekonsiliasi harian** memanggil `getPaymentStatus` lalu menggunakan fungsi yang sama `applyVerifiedStatus()` dengan webhook.
- Selisih (provider paid, DB tidak; nominal beda; payment tak dikenal) → `audit_logs` aksi `reconciliation.issue` + email admin.
- Admin dapat menekan "Cek status ke provider" (permission `transactions.reconcile`) — tetap melalui `applyVerifiedStatus()`.

## 7. Instruksi pembayaran
`payment_methods.instructions` (JSONB) menyimpan langkah per kanal (m-banking/ATM/internet banking) yang dapat diedit admin; data dinamis (nomor VA, QR, URL, expiry) berasal dari `payments.instruction` hasil provider. Template instruksi mendukung placeholder `{{va_number}}`, `{{amount}}`, `{{bank_name}}`.

## 8. Metode awal (usulan, dikonfirmasi setelah akun merchant aktif)
| Kode | Tipe | Provider utama | Fallback |
|---|---|---|---|
| qris | QRIS (`payment_type: qris`) | Midtrans | — |
| gopay | e-wallet (`gopay`) | Midtrans | — |
| shopeepay | e-wallet (`shopeepay`) | Midtrans | — |
| bca_va, bni_va, bri_va, permata_va, cimb_va | VA (`bank_transfer` + `bank`) | Midtrans | — |
| mandiri_bill | Mandiri Bill Payment (`echannel`: biller_code + bill_key) | Midtrans | — |

Daftar final mengikuti metode yang **aktif di akun merchant Midtrans** (cek Dashboard → Settings → Payment). OVO/DANA tidak tersedia di MVP.

### Catatan review keamanan P09 (10 Nov 2026)
- **M1 (terbuka):** transisi `paid → refunded` belum mengurangi `collected_amount`/`donor_count`. Wajib dirancang (reversal dalam transaksi DB yang sama, guard `status='paid' RETURNING`) sebelum alur refund dipakai. **Mitigasi P10:** `applyVerifiedStatus` menolak status `refunded` kecuali `source = 'admin_check'` → `ignored_transition` + audit `payment.needs_review` + alert `refund_reported`; input `needsReview` (Midtrans `capture+challenge`) pada status `pending` → audit `payment.needs_review` + alert `needs_review` (status tetap).
- **M2 (aturan):** `applyVerifiedStatus` hanya boleh menerima data dari `provider.verifyWebhook()` atau `provider.getPaymentStatus()`. Tombol admin (`admin_check`) wajib memanggil `getPaymentStatus()` segar di service; status tidak pernah berasal dari input form.
- **L1/L4 (ditutup):** guard `rowCount === 1` pada update payment dan assert nominal transaksi = nominal terverifikasi (beda → rollback).
- **L2/L3 (diterima):** status terminal sesaat saat ada attempt baru (self-heal); pembayaran kedua pada transaksi yang sudah paid tetap `processed` + `alert` — pemanggil wajib memeriksa `alert`.
