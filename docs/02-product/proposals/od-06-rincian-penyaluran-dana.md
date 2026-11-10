# Proposal OD-06 — Rincian Penyaluran Dana

Status: ✅ Disetujui PM, 10 Nov 2026 (masuk MVP).

## Latar belakang
Donatur ingin tahu ke mana dana disalurkan. Rincian penyaluran adalah pembeda kepercayaan terhadap platform lain dan sebelumnya hanya berupa usulan P1 (`campaign_disbursements` di ERD/schema) yang di luar daftar scope eksplisit.

## Keputusan
Fitur **rincian penyaluran dana masuk MVP**. Admin mencatat setiap penyaluran per campaign; publik melihat rinciannya di Campaign Detail.

## Cakupan
- Tabel `campaign_disbursements` (nominal `bigint` rupiah, FK ke `campaigns`, `created_by`, timestamp, tautan opsional ke berita sebagai bukti).
- Admin (permission `disbursements.write`): tambah, ubah, hapus (soft delete) penyaluran; semua aksi masuk audit log.
- Publik: komponen "Rincian Penyaluran Dana" di `/campaign/[slug]` (ringkasan terkumpul vs tersalurkan, daftar penyaluran, tautan berita bukti).
- Jenis: `program`, `operational`, `bank_fee`.
- Validasi Zod; total penyaluran tidak boleh melebihi `collected_amount` campaign (BR-43).

## Di luar cakupan
- Pelaporan akuntansi lengkap / rekonsiliasi bank.
- Unggah dokumen bukti (nota, transfer) selain tautan berita.
- Notifikasi otomatis ke donatur saat ada penyaluran baru.
- Ekspor laporan penyaluran.

## Dampak
- DB: 1 tabel baru, 1 permission baru; ERD & seed permission diperbarui.
- Admin: 1 layar (di editor campaign). Publik: 1 komponen.
- Estimasi: T-50 (0.5d), T-51 (1d), T-52 (0.5d).
- Dokumen: scope C9, F-33, AC-33.x, BR-43, schema.md, implementation-order.md.
