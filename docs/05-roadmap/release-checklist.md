# Release Checklist

## Kode & kualitas
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:e2e` hijau di `main`
- [ ] Coverage service & payments ≥ 80%
- [ ] Tidak ada test di-skip tanpa issue
- [ ] Lighthouse mobile: Performance ≥ 85, Accessibility ≥ 95, SEO ≥ 95

## Keamanan
- [ ] Security review tanpa temuan `blocker`/`high` terbuka
- [ ] Tidak ada secret di repo/bundle/log
- [ ] Header keamanan aktif (CSP, HSTS, frame-ancestors)
- [ ] Rate limit checkout & admin login aktif
- [ ] Owner admin dengan TOTP aktif; akun default/test dihapus
- [ ] `pnpm audit` tanpa high/critical

## Pembayaran
- [ ] Kredensial **production** Midtrans terpasang hanya di env Production
- [ ] URL webhook production terdaftar di dashboard provider & diuji
- [ ] Metode bayar aktif sesuai yang disetujui merchant
- [ ] Transaksi nyata nominal kecil (mis. Rp10.000) per metode utama: paid → total → notifikasi → kuitansi
- [ ] Job expiry & rekonsiliasi terjadwal di QStash production
- [ ] Alert admin untuk amount_mismatch & rekonsiliasi

## Data
- [ ] Migrasi production sukses; snapshot Neon sebelum migrasi
- [ ] Seed referensi (kategori, roles, metode, template, settings) ada
- [ ] PITR aktif

## Notifikasi
- [ ] Gmail App Password production; batas harian dipantau
- [ ] Fonnte nomor production; consent copy disetujui
- [ ] Template final ditinjau PM (bahasa, nama lembaga)

## Legal & konten
- [ ] Kebijakan privasi, S&K, tentang, kontak, alamat lembaga (teks final dari legal; tidak ada placeholder di produksi; T-49)
- [ ] Izin pengumpulan dana (PUB) / legalitas sesuai arahan legal
- [ ] Campaign peluncuran dengan gambar beralt & copy final

## Operasional
- [ ] Domain + SSL, redirect www
- [ ] Monitoring error & uptime, on-call kontak
- [ ] Rencana rollback diuji
- [ ] Persetujuan go-live tertulis dari PM
