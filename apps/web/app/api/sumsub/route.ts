import { NextResponse } from "next/server";
import crypto from "node:crypto";

// Returns a short-lived Sumsub applicant token for the web SDK.
// Requires SUMSUB_APP_TOKEN + SUMSUB_SECRET_KEY in env (coordinate with Track B).
// Falls back to a mock token in dev when keys are absent.
export async function POST(req: Request) {
  const { caseId } = await req.json();
  if (!caseId) return NextResponse.json({ error: "caseId required" }, { status: 400 });

  const appToken = process.env.SUMSUB_APP_TOKEN;
  const secretKey = process.env.SUMSUB_SECRET_KEY;

  if (!appToken || !secretKey) {
    // Dev mock — real SDK won't load, page shows demo mode
    return NextResponse.json({ token: `mock_token_${caseId}`, isMock: true });
  }

  try {
    const userId = caseId; // use caseId as the external userId
    const levelName = "basic-kyc-level"; // configure in Sumsub dashboard
    const ts = Math.floor(Date.now() / 1000);
    const method = "POST";
    const path = `/resources/accessTokens?userId=${userId}&levelName=${levelName}&ttlInSecs=1800`;

    const sigData = `${ts}${method}${path}`;
    const sig = crypto.createHmac("sha256", secretKey).update(sigData).digest("hex");

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
      return NextResponse.json({ error: `Sumsub error: ${body}` }, { status: 502 });
    }

    const data = await res.json();
    return NextResponse.json({ token: data.token, isMock: false });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
