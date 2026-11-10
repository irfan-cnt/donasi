// Hostname publik store Vercel Blob MILIK proyek ini (M1). Modul murni: dipakai next.config
// (images.remotePatterns) dan validasi URL gambar. Sumber: BLOB_STORE_ID ("store_<id>") atau
// id store di token (`vercel_blob_rw_<id>_<secret>`). Host = `<id huruf kecil>.public.blob.vercel-storage.com`.

const ID_RE = /^[A-Za-z0-9]{8,64}$/;

export function blobStoreHost(env: { BLOB_STORE_ID?: string; BLOB_READ_WRITE_TOKEN?: string }): string | null {
  const fromId = env.BLOB_STORE_ID?.trim().replace(/^store_/i, "");
  const fromToken = /^vercel_blob_rw_([A-Za-z0-9]+)_/.exec(env.BLOB_READ_WRITE_TOKEN ?? "")?.[1];
  const id = fromId || fromToken;
  return id && ID_RE.test(id) ? `${id.toLowerCase()}.public.blob.vercel-storage.com` : null;
}
