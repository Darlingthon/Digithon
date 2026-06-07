import { NextResponse } from "next/server";
import { BrainError, listCases, startCase } from "@trustline/db";
import { getSession } from "@/lib/session";
import { getOrCreateOrg, getOrCreateMember } from "@trustline/db";
import { withAuth } from "@workos-inc/authkit-nextjs";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!session.orgId) return NextResponse.json({ error: "No organisation" }, { status: 403 });

    const auth = await withAuth();
    const org = await getOrCreateOrg(session.orgId, auth.user?.firstName ?? "My Org");
    return NextResponse.json({ cases: await listCases(org.id) });
  } catch (error) {
    return toError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!session.orgId) return NextResponse.json({ error: "No organisation" }, { status: 403 });

    const auth = await withAuth();
    const org = await getOrCreateOrg(session.orgId, auth.user?.firstName ?? "My Org");
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
