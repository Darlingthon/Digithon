import { BrainError, getCase } from "@trustline/db";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function GET(_request: Request, context: { params: Promise<{ caseId: string }> }) {
  try {
    const { caseId } = await context.params;
    // customer-facing routes (questionnaire page) call this without auth — allow it
    const session = await getSession();
    const orgId = session?.orgId ?? undefined;
    return NextResponse.json({ case: await getCase(caseId, orgId) });
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
