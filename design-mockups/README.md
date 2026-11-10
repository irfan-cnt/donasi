# Tebar Kebaikan — Mockup UI (Phase 1)

Mockup TSX mandiri (Vite + React + TypeScript + Tailwind + Lucide). Data contoh fiktif; **tidak** terhubung ke database atau payment gateway.

```bash
npm install
npm run dev          # http://localhost:5173 — indeks semua layar
npm run typecheck
npm run build        # dist/
npm run build:single # dist-single/index.html (satu file, mudah dibagikan)
```

- Indeks: `#/` · Penampil dengan toolbar state & ukuran: `#/v/<id>` · Halaman langsung: `#/p/<id>?state=loading|empty|error`
- Struktur: `src/public`, `src/donor`, `src/admin`, `src/components/{ui,public,donor,admin}`, `src/styles`, `src/data/sample.ts`, `src/registry.tsx`.
- Komponen `src/components/ui` dirancang agar mudah dipetakan ke shadcn/ui di Phase 2 (Button, Card, Badge, Input, Switch, Alert, Skeleton, Table, Sheet).

Daftar layar & hasil validasi: `../docs/06-design/mockup-index.md`. Design system: `../docs/06-design/design-system.md`.
