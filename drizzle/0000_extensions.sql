-- Ekstensi wajib sebelum tabel (citext untuk email, pg_trgm untuk index GIN trigram).
CREATE EXTENSION IF NOT EXISTS citext;
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pg_trgm;
