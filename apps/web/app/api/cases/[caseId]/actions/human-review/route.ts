import { NextResponse } from "next/server";
import { BrainError, prisma, assertTransition } from "@trustline/db";

// Human reviewer approves (CLEAR) or rejects (REJECT) a NEEDS_REVIEW case.
// Writes a Decision with automated=false and records an audit event.
export async function POST(request: Request, context: { params: Promise<{ caseId: string }> }) {
  try {
    const { caseId } = await context.params;
    const body = await request.json();
    const { outcome, reason, reviewerId = "reviewer" } = body;

    if (outcome !== "CLEAR" && outcome !== "REJECT") {
      return NextResponse.json({ error: "outcome must be CLEAR or REJECT" }, { status: 400 });
    }
    if (!reason?.trim()) {
      return NextResponse.json({ error: "reason is required" }, { status: 400 });
    }

    const item = await prisma.case.findUnique({ where: { id: caseId } });
    if (!item) return NextResponse.json({ error: `Case not found: ${caseId}` }, { status: 404 });

    assertTransition(item.status, "DECIDED" as any);

    const updated = await prisma.$transaction(async (tx) => {
      await tx.decision.upsert({
        where: { caseId },
        create: {
          caseId,
          outcome: outcome as any,
          reasons: [reason] as any,
          automated: false,
          reviewedBy: reviewerId,
        },
        update: {
          outcome: outcome as any,
          reasons: [reason] as any,
          automated: false,
          reviewedBy: reviewerId,
        },
      });
      await tx.auditEvent.create({
        data: {
          caseId,
          type: "HUMAN_DECISION_MADE",
          actor: reviewerId,
          data: { outcome, reason } as any,
        },
      });
      return tx.case.update({
        where: { id: caseId },
        data: { status: "DECIDED" as any, decidedAt: new Date() },
        include: { entity: true, decision: true },
      });
    });

    return NextResponse.json({ case: updated });
  } catch (error) {
    if (error instanceof BrainError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
