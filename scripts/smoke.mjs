#!/usr/bin/env node
// TrustLine smoke harness — one command to verify the system is wired up.
// Zero deps (Node 20+ global fetch). Point it at localhost or deployed Cloud Run:
//
//   npm run smoke                        # defaults to localhost
//   WEB_URL=https://web-xxx.run.app \
//   CHANNELS_URL=https://channels-xxx.run.app  npm run smoke
//
// Env:
//   WEB_URL       default http://localhost:3000
//   CHANNELS_URL  default http://localhost:4000
//   AGENT_URL     default http://localhost:8000   (optional — skipped if unreachable)
//   SMOKE_CASE    default case_demo_bob           (must exist / be seeded)
//   SMOKE_PHONE   default +15551230002
//   READONLY=1    skip state-mutating checks (dispatch/OTP)

const WEB = (process.env.WEB_URL ?? "http://localhost:3000").replace(/\/$/, "");
const CHANNELS = (process.env.CHANNELS_URL ?? "http://localhost:4000").replace(/\/$/, "");
const AGENT = (process.env.AGENT_URL ?? "http://localhost:8000").replace(/\/$/, "");
// Dan is seeded in IDV_DONE — the legal state to dispatch the questionnaire.
const CASE = process.env.SMOKE_CASE ?? "case_demo_dan";
const PHONE = process.env.SMOKE_PHONE ?? "+15551230004";
const READONLY = process.env.READONLY === "1";

let pass = 0,
  fail = 0,
  skip = 0;
const rows = [];

function record(group, name, status, detail = "") {
  rows.push({ group, name, status, detail });
  if (status === "PASS") pass++;
  else if (status === "FAIL") fail++;
  else skip++;
}

async function req(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(8000),
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* non-JSON ok */
  }
  return { status: res.status, json };
}

// check(group, name, fn) where fn returns true / throws / returns string detail
async function check(group, name, fn) {
  try {
    const detail = await fn();
    record(group, name, "PASS", typeof detail === "string" ? detail : "");
  } catch (e) {
    record(group, name, "FAIL", e.message);
  }
}

// Returns false if the host isn't reachable at all (so we can SKIP a whole group).
async function reachable(url) {
  try {
    await fetch(url, { method: "GET", signal: AbortSignal.timeout(4000) });
    return true;
  } catch {
    return false;
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  console.log(`\n🔎 TrustLine smoke\n   web=${WEB}\n   channels=${CHANNELS}\n   agent=${AGENT} (optional)\n   mode=${READONLY ? "read-only" : "full"}\n`);

  // ── WEB ──
  if (await reachable(`${WEB}/api/health`)) {
    await check("web", "GET /api/health ok", async () => {
      const { status, json } = await req("GET", `${WEB}/api/health`);
      assert(status === 200 && json?.ok, `status=${status}`);
    });
    await check("web", "GET /api/cases non-empty", async () => {
      const { status, json } = await req("GET", `${WEB}/api/cases`);
      assert(status === 200, `status=${status}`);
      assert(Array.isArray(json?.cases) && json.cases.length > 0, "no cases");
      return `${json.cases.length} cases`;
    });
    await check("web", "GET /api/metrics shape", async () => {
      const { status, json } = await req("GET", `${WEB}/api/metrics`);
      assert(status === 200 && typeof json?.totalCases === "number", `status=${status}`);
      return `${json.straightThroughRate * 100}% STP`;
    });
  } else {
    record("web", "reachable", "SKIP", `${WEB} not up`);
  }

  // ── CHANNELS ──
  if (await reachable(`${CHANNELS}/health`)) {
    await check("channels", "GET /health ok", async () => {
      const { status, json } = await req("GET", `${CHANNELS}/health`);
      assert(status === 200 && json?.ok, `status=${status}`);
      return `twilio=${json.twilio}`;
    });
    if (READONLY) {
      record("channels", "dispatch + OTP flow", "SKIP", "read-only mode");
    } else {
      await check("channels", "POST /dispatch advances case", async () => {
        const { status, json } = await req("POST", `${CHANNELS}/dispatch/${CASE}`, { phone: PHONE });
        assert(status === 200, `status=${status} ${json?.error ?? ""}`);
        assert(json?.status === "QUESTIONNAIRE_SENT", `status=${json?.status}`);
        return json.link;
      });
      await check("channels", "POST /otp/verify wrong → 401", async () => {
        const { status } = await req("POST", `${CHANNELS}/otp/verify`, { caseId: CASE, phone: PHONE, code: "000000" });
        assert(status === 401, `status=${status}`);
      });
      await check("channels", "POST /otp/verify right → verified", async () => {
        const { status, json } = await req("POST", `${CHANNELS}/otp/verify`, { caseId: CASE, phone: PHONE, code: "123456" });
        // 123456 only works in dry-run; against live Twilio this legitimately 401s.
        if (status === 401) return "live Twilio (dry-run code rejected — expected)";
        assert(status === 200 && json?.verified, `status=${status}`);
        return "verified";
      });
    }
  } else {
    record("channels", "reachable", "SKIP", `${CHANNELS} not up`);
  }

  // ── AGENT (optional) ──
  if (await reachable(`${AGENT}/`)) {
    await check("agent", "reachable", async () => {
      const { status } = await req("GET", `${AGENT}/`);
      assert(status < 500, `status=${status}`);
    });
  } else {
    record("agent", "reachable", "SKIP", `${AGENT} not up (optional)`);
  }

  // ── report ──
  console.log("─".repeat(64));
  let group = "";
  for (const r of rows) {
    if (r.group !== group) {
      group = r.group;
      console.log(`\n  ${group.toUpperCase()}`);
    }
    const icon = r.status === "PASS" ? "✅" : r.status === "FAIL" ? "❌" : "⏭️ ";
    console.log(`   ${icon} ${r.name}${r.detail ? `  — ${r.detail}` : ""}`);
  }
  console.log("\n" + "─".repeat(64));
  console.log(`  ${pass} passed · ${fail} failed · ${skip} skipped\n`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("smoke harness crashed:", e);
  process.exit(2);
});
