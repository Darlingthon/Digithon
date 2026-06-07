import { NextResponse } from "next/server";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { getOrCreateOrg } from "@trustline/db";

export async function GET() {
  try {
    const auth = await withAuth();
    if (!auth.user) return NextResponse.json({ user: null });

    let orgName: string | null = null;
    if (auth.organizationId) {
      try {
        const org = await getOrCreateOrg(auth.organizationId, auth.user.firstName ?? "My Org");
        orgName = org.name;
      } catch {
        // org provisioning failed — non-fatal
      }
    }

    return NextResponse.json({
      user: {
        email: auth.user.email,
        firstName: auth.user.firstName,
        lastName: auth.user.lastName,
      },
      orgName,
    });
  } catch {
    return NextResponse.json({ user: null });
  }
}
