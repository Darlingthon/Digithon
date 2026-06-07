import { NextResponse } from "next/server";
import { getMetrics } from "@trustline/db";
import { getSession } from "@/lib/session";
import { getOrCreateOrg } from "@trustline/db";
import { withAuth } from "@workos-inc/authkit-nextjs";

export async function GET() {
  try {
    const session = await getSession();
    if (session?.orgId) {
      const auth = await withAuth();
      const org = await getOrCreateOrg(session.orgId, auth.user?.firstName ?? "My Org");
      return NextResponse.json(await getMetrics(org.id));
    }
    return NextResponse.json(await getMetrics());
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
