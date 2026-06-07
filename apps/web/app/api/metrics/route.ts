import { NextResponse } from "next/server";
import { getMetrics } from "@trustline/db";

export async function GET() {
  try {
    return NextResponse.json(await getMetrics());
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
