import { NextResponse } from "next/server";
import { MOCK_CASE_DETAILS } from "@trustline/shared/fixtures";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = MOCK_CASE_DETAILS.find((c) => c.id === id);
  if (!detail) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ case: detail });
}
