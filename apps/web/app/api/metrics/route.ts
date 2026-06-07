import { NextResponse } from "next/server";
import { MOCK_METRICS } from "@trustline/shared/fixtures";

// Mock metrics endpoint feeding the dashboard. Track A replaces with computed
// metrics over real cases (time-to-decision, STP rate, etc.).
export async function GET() {
  return NextResponse.json(MOCK_METRICS);
}
