import { NextResponse } from "next/server";
import { getSignInUrl, getSignUpUrl } from "@workos-inc/authkit-nextjs";

// authkit-nextjs v4 sets a PKCE cookie inside getSignInUrl/getSignUpUrl, which is
// only allowed in a Route Handler or Server Action (never during a page render).
// So the login page links here instead of calling getSignInUrl() at render time.
export async function GET(request: Request) {
  const intent = new URL(request.url).searchParams.get("intent");
  const url = intent === "sign-up" ? await getSignUpUrl() : await getSignInUrl();
  return NextResponse.redirect(url);
}
