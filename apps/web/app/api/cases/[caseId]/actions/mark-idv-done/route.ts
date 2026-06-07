import { BrainError, markIdvDone } from "@trustline/db";
import { NextResponse } from "next/server";

export async function POST(request: Request, context: { params: Promise<{ caseId: string }> }) {
  try {
    const { caseId } = await context.params;
    const body = await request.json();
    return NextResponse.json({ case: await markIdvDone(caseId, Boolean(body.passed), body.rawResult) });
  } catch (error) {
    return toError(error);
  }
}

function toError(error: unknown) {
  if (error instanceof BrainError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
}
