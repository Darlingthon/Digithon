import { NextResponse } from "next/server";
import { getMetrics } from "@trustline/db";
import { getCurrentOrg } from "@/lib/session";

export async function GET() {
  try {
    const org = await getCurrentOrg();
    if (org) {
      return NextResponse.json(await getMetrics(org.id));
    }
    return NextResponse.json(await getMetrics());
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
