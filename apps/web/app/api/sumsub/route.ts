import { NextResponse } from "next/server";
import crypto from "node:crypto";

// Returns a short-lived Sumsub WebSDK access token for a case.
// Uses real Sumsub when SUMSUB_APP_TOKEN + SUMSUB_SECRET_KEY + SUMSUB_LEVEL_NAME
// are all set AND the call succeeds. Otherwise falls back to demo mode
// (isMock: true) so the IDV page shows Simulate Pass/Fail instead of hard-failing.
export async function POST(req: Request) {
  const { caseId } = await req.json();
  if (!caseId) return NextResponse.json({ error: "caseId required" }, { status: 400 });

  const appToken = process.env.SUMSUB_APP_TOKEN;
  const secretKey = process.env.SUMSUB_SECRET_KEY;
  const levelName = process.env.SUMSUB_LEVEL_NAME;

  // No creds, or no verification level configured → demo mode.
  if (!appToken || !secretKey || !levelName) {
    return NextResponse.json({ token: `mock_token_${caseId}`, isMock: true });
  }

  try {
    const ts = Math.floor(Date.now() / 1000);
    const method = "POST";
    const path = `/resources/accessTokens?userId=${encodeURIComponent(caseId)}&levelName=${encodeURIComponent(levelName)}&ttlInSecs=1800`;
    const sig = crypto.createHmac("sha256", secretKey).update(`${ts}${method}${path}`).digest("hex");

    const res = await fetch(`https://api.sumsub.com${path}`, {
      method,
      headers: {
        "X-App-Token": appToken,
        "X-App-Access-Ts": String(ts),
        "X-App-Access-Sig": sig,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      const body = await res.text();
      console.warn(`Sumsub token failed (${res.status}): ${body} — falling back to demo IDV`);
      return NextResponse.json({ token: `mock_token_${caseId}`, isMock: true });
    }

    const data = await res.json();
    return NextResponse.json({ token: data.token, isMock: false });
  } catch (err) {
    console.warn(`Sumsub token error: ${err} — falling back to demo IDV`);
    return NextResponse.json({ token: `mock_token_${caseId}`, isMock: true });
  }
}
