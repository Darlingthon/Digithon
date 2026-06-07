import { NextResponse } from "next/server";
import {
  startCase,
  markIdvDone,
  dispatchQuestionnaire,
  recordAnswers,
  runScreening,
  decide,
  getOrCreateOrg,
} from "@trustline/db";
import { questionsForTier, type RiskTier } from "@trustline/shared/questionnaire";
import { getSession } from "@/lib/session";
import { withAuth } from "@workos-inc/authkit-nextjs";

// Autopilot: fill in a name + phone and Vera runs the whole KYC case on her own —
// the same six Brain actions, in the correct order, deterministically (no LLM
// ordering slips, no rate limits). Returns the case + final decision.

function autoAnswers(tier: RiskTier): Record<string, unknown> {
  const defaults: Record<string, unknown> = {
    occupation: "Software Engineer",
    annualIncomeBand: "50k-150k",
    sourceOfFunds: "Salary",
    isPep: false,
    expectedMonthlyVolume: "10k-100k",
    sourceOfWealthDetail: "Accumulated through salary and long-term savings.",
    foreignAccounts: false,
  };
  const answers: Record<string, unknown> = {};
  for (const q of questionsForTier(tier)) {
    answers[q.field] =
      defaults[q.field] ?? (q.type === "boolean" ? false : q.options ? q.options[0] : "N/A");
  }
  return answers;
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.orgId) return NextResponse.json({ error: "No organisation" }, { status: 403 });

  const auth = await withAuth();
  const org = await getOrCreateOrg(session.orgId, auth.user?.firstName ?? "My Org");

  const body = await req.json().catch(() => ({}));
  const name: string = (body.name ?? "").trim();
  const phone: string | undefined = body.phone?.trim() || undefined;
  const email: string | undefined = body.email?.trim() || undefined;
  const tier: RiskTier = (body.riskTier as RiskTier) ?? "LOW";
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  try {
    // 1. create → 2. IDV pass → 3. dispatch → 4. answers → 5. screen → 6. decide
    const created = await startCase({ entityName: name, orgId: org.id, phone, email, riskTier: tier });
    const caseId = created.id;
    await markIdvDone(caseId, true, { source: "autopilot", note: "simulated IDV pass" });
    await dispatchQuestionnaire(caseId);
    await recordAnswers(caseId, "WEB", autoAnswers(tier));
    await runScreening(caseId);
    const decided = await decide(caseId);
    return NextResponse.json({ caseId, ...decided });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
