import { NextResponse } from "next/server";

// Liveness probe — used by the smoke harness and Cloud Run health checks.
export async function GET() {
  return NextResponse.json({ ok: true, service: "web" });
}
