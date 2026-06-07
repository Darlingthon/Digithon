import { NextResponse } from "next/server";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { getCurrentOrg } from "@/lib/session";

export async function GET() {
  try {
    const auth = await withAuth();
    if (!auth.user) return NextResponse.json({ user: null });

    let orgName: string | null = null;
    try {
      const org = await getCurrentOrg();
      orgName = org?.name ?? null;
    } catch {
      // org provisioning failed — non-fatal
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
