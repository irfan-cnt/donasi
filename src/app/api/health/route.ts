import { NextResponse } from "next/server";

/** Liveness sederhana; tidak menyentuh DB/secret. */
export function GET() {
  return NextResponse.json({ status: "ok" });
}
