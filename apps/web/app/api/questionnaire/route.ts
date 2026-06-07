import { QUESTIONNAIRE, questionsForTier, type RiskTier } from "@trustline/shared/questionnaire";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const tier = new URL(request.url).searchParams.get("riskTier") ?? "LOW";
  const riskTier = ["LOW", "MEDIUM", "HIGH"].includes(tier) ? (tier as RiskTier) : "LOW";
  return NextResponse.json({
    id: QUESTIONNAIRE.id,
    version: QUESTIONNAIRE.version,
    riskTier,
    questions: questionsForTier(riskTier),
  });
}
