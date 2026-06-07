import { NextResponse } from "next/server";
import { MOCK_CASES } from "@trustline/shared/fixtures";

// Mock cases endpoint. Track A swaps the body for a real Prisma query
// (prisma.case.findMany) once the DB-backed actions land.
export async function GET() {
  return NextResponse.json({ cases: MOCK_CASES });
}
