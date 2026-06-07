import { NextResponse } from "next/server";
import { startCase, setQuestionnaireDelivery, setCaseLanguage, type RiskTier } from "@trustline/db";
import { channelsUrl, channelsPost } from "@/lib/channels";
import { getCurrentOrg } from "@/lib/session";

// One form → a live case. BOTH modes start the same way: text the customer an
// IDV link. The chosen channel only decides how the questionnaire is collected
// AFTER identity verification passes (handled by the post-idv action):
//   - "CALL": Vera phones the customer right away.
//   - "SMS":  text the questionnaire link; if not filled within the fallback
//             window, the Channels sweep has Vera auto-call them.

type Mode = "CALL" | "SMS";

export async function POST(req: Request) {
  const org = await getCurrentOrg();
  if (!org) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const name: string = (body.name ?? "").trim();
  const phone: string | undefined = body.phone?.trim() || undefined;
  const email: string | undefined = body.email?.trim() || undefined;
  const tier: RiskTier = (body.riskTier as RiskTier) ?? "LOW";
  const mode: Mode = body.mode === "SMS" ? "SMS" : "CALL";
  const language: string = typeof body.language === "string" && body.language ? body.language : "en";

  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });
  if (!phone) return NextResponse.json({ error: "phone is required (E.164)" }, { status: 400 });
  if (!channelsUrl()) {
    return NextResponse.json(
      { error: "CHANNELS_URL is not set — start the channels service and set CHANNELS_URL to go live" },
      { status: 409 },
    );
  }

  try {
    const created = await startCase({ entityName: name, orgId: org.id, phone, email, riskTier: tier });
    const caseId = created.id;
    await setQuestionnaireDelivery(caseId, mode);
    await setCaseLanguage(caseId, language);

    // First touch: a real SMS with the IDV link. The customer verifies identity,
    // then the post-idv action collects the questionnaire over the chosen channel.
    const invite = await channelsPost<{ link: string; smsSid: string }>(`/invite/${caseId}`, { phone });

    return NextResponse.json({
      caseId,
      mode,
      status: created.status,
      entityName: name,
      link: invite.link,
      smsSid: invite.smsSid,
      message:
        mode === "CALL"
          ? `IDV link sent. Once identity is verified, Vera will call ${phone} to run the questionnaire.`
          : `IDV link sent. After identity is verified, we'll text the questionnaire — Vera auto-calls if it's not filled in time.`,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
