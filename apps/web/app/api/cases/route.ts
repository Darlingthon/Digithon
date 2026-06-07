import { NextResponse } from "next/server";
import { BrainError, listCases, startCase, getOrCreateMember } from "@trustline/db";
import { getSession, getCurrentOrg } from "@/lib/session";

export async function GET() {
  try {
    const org = await getCurrentOrg();
    if (!org) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ cases: await listCases(org.id) });
  } catch (error) {
    return toError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const org = await getCurrentOrg();
    if (!org) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await getOrCreateMember(session.userId, session.email, org.id);

    const body = await request.json();
    const kase = await startCase({
      entityName: body.entityName,
      orgId: org.id,
      phone: body.phone,
      email: body.email,
      country: body.country,
      riskTier: body.riskTier,
    });
    return NextResponse.json({ case: kase }, { status: 201 });
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
