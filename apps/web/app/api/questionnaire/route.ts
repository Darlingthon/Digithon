import { NextResponse } from "next/server";
import { prisma } from "@trustline/db";
import { getCurrentOrg } from "@/lib/session";
import { QUESTIONNAIRE, questionsForTier, type RiskTier } from "@trustline/shared/questionnaire";

export async function GET(request: Request) {
  const tier = new URL(request.url).searchParams.get("riskTier") ?? "LOW";
  const riskTier = (["LOW", "MEDIUM", "HIGH"].includes(tier) ? tier : "LOW") as RiskTier;

  try {
    const org = await getCurrentOrg();
    if (org) {
      const q = await prisma.questionnaire.findFirst({
        where: { orgId: org.id, riskTier, isActive: true },
        orderBy: { version: "desc" },
      });
      if (q) {
        return NextResponse.json({
          id: q.id,
          version: q.version,
          riskTier,
          questions: q.questions,
        });
      }
    }
  } catch {
    // fall through to default
  }

  // Fallback: global hardcoded questionnaire (unauthenticated callers / no org questionnaire yet)
  return NextResponse.json({
    id: QUESTIONNAIRE.id,
    version: QUESTIONNAIRE.version,
    riskTier,
    questions: questionsForTier(riskTier),
  });
}
