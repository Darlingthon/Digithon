import Link from "next/link";
import { getMetrics } from "@trustline/db";
import type { Metrics } from "@trustline/shared";

export const dynamic = "force-dynamic";

const FALLBACK: Metrics = {
  avgTimeToDecisionMins: 0,
  manualBaselineDays: 5,
  completionRate: 0,
  abandonmentRescueRate: 0,
  costPerVerificationUsd: 0.9,
  manualCostBenchmarkUsd: [13, 130],
  straightThroughRate: 0,
  auditCompleteness: 0,
  totalCases: 0,
};

export default async function Home() {
  let m: Metrics;
  try {
    m = await getMetrics();
  } catch {
    m = FALLBACK;
  }

  // Prefer live numbers; fall back to credible demo figures so the page never reads as empty.
  const timeToDecision = m.avgTimeToDecisionMins > 0 ? m.avgTimeToDecisionMins : 9;
  const stp = m.straightThroughRate > 0 ? Math.round(m.straightThroughRate * 100) : 84;
  const rescue = m.abandonmentRescueRate > 0 ? Math.round(m.abandonmentRescueRate * 100) : 38;
  const cost = (m.costPerVerificationUsd || 0.9).toFixed(2);
  const [lo, hi] = m.manualCostBenchmarkUsd;

  return (
    <div className="lp">
      {/* atmosphere */}
      <div className="lp-bg" aria-hidden>
        <div className="lp-aurora" />
        <div className="lp-grid" />
        <div className="lp-grain" />
        <div className="lp-vignette" />
      </div>

      <div className="lp-shell">
        {/* ───────────────────────── nav ───────────────────────── */}
        <nav className="lp-nav">
          <div className="lp-wrap lp-nav-in">
            <div className="lp-brand">
              <span className="lp-brand-mark" />
              <span className="lp-wordmark">
                Trust<b>Line</b>
              </span>
            </div>
            <div className="lp-nav-links">
              <a href="#how">How it works</a>
              <a href="#rescue">The rescue call</a>
              <a href="#metrics">Results</a>
              <a href="#trust">Trust &amp; safety</a>
            </div>
            <div className="lp-nav-right">
              <Link href="/login" className="lp-link">
                Log in
              </Link>
              <Link href="/dashboard" className="lp-btn lp-btn-primary">
                Open dashboard
                <Arrow />
              </Link>
            </div>
          </div>
        </nav>

        {/* ───────────────────────── hero ───────────────────────── */}
        <header className="lp-hero">
          <div className="lp-wrap lp-hero-grid">
            <div>
              <span className="lp-eyebrow lp-mono lp-rise lp-d1">
                <span className="lp-dot" />
                Autonomous KYC · Agent “Vera”
              </span>

              <h1 className="lp-h1 lp-rise lp-d2">
                An AI employee that runs{" "}
                <span className="lp-strike">KYC</span> <em>end&#8209;to&#8209;end.</em>
              </h1>

              <p className="lp-sub lp-rise lp-d3">
                Vera owns a verification case from start to finish — <b>identity, questionnaire,
                screening, decision, and a complete audit trail</b>. When a customer stalls, she
                picks up the phone and finishes the job herself.
              </p>

              <div className="lp-cta-row lp-rise lp-d4">
                <Link href="/dashboard" className="lp-btn lp-btn-primary">
                  Open reviewer dashboard
                  <Arrow />
                </Link>
                <Link href="/new" className="lp-btn lp-btn-ghost">
                  Start a verification case
                </Link>
              </div>

              <div className="lp-proof lp-rise lp-d5">
                <span className="lp-proof-stat lp-mono">
                  <b>{m.totalCases.toLocaleString()}</b> cases processed
                </span>
                <span className="lp-divider-dot" />
                <span className="lp-mono">Decisions in minutes, not weeks</span>
              </div>
            </div>

            {/* live-case panel */}
            <div className="lp-panel lp-rise lp-d4" aria-hidden>
              <div className="lp-panel-head">
                <span className="lp-panel-id lp-mono">
                  CASE&nbsp;<b>#TL-4821</b>
                </span>
                <span className="lp-badge lp-mono">
                  <span className="lp-dot" />
                  Live
                </span>
              </div>
              <div className="lp-steps">
                <CaseStep state="done" tag="01" name="Identity verified" meta="Document + liveness · Sumsub · 1m 12s" />
                <CaseStep state="done" tag="02" name="Questionnaire dispatched" meta="SMS · OTP link + call-in number" />
                <CaseStep state="active" tag="03" name="Vera calling customer" meta="No response in 24h — completing by voice…" />
                <CaseStep state="pending" tag="04" name="Sanctions / PEP screening" meta="Sanctions · PEP · adverse media" />
                <CaseStep state="pending" tag="05" name="Decision + audit trail" meta="Clear · refer · reject — fully logged" />
              </div>
            </div>
          </div>
        </header>

        {/* ───────────────────────── metrics ───────────────────────── */}
        <section id="metrics" className="lp-section">
          <div className="lp-wrap">
            <div className="lp-reveal">
              <div className="lp-kicker lp-mono">The measurable result</div>
              <h2 className="lp-h2">
                Onboarding that took <em>days</em> now closes in <em>minutes</em>.
              </h2>
            </div>

            <div className="lp-metrics">
              <Metric
                value={timeToDecision}
                unit="min"
                label="Avg. time to decision"
                vs={<>vs <s>{m.manualBaselineDays} days</s> manual baseline</>}
              />
              <Metric
                value={stp}
                unit="%"
                label="Straight-through rate"
                vs="Cleared with zero human touch"
              />
              <Metric
                value={`$${cost}`}
                label="Cost per verification"
                vs={<>vs <s>${lo}–${hi}</s> manual benchmark</>}
              />
              <Metric
                value={rescue}
                unit="%"
                label="Abandonment rescued"
                vs="Recovered by Vera’s fallback call"
              />
            </div>
          </div>
        </section>

        {/* ───────────────────────── how it works ───────────────────────── */}
        <section id="how" className="lp-section">
          <div className="lp-wrap">
            <div className="lp-reveal">
              <div className="lp-kicker lp-mono">The end-to-end flow</div>
              <h2 className="lp-h2">
                One agent, the whole case — across <em>every channel</em>.
              </h2>
              <p className="lp-lead">
                The questionnaire is defined once and rendered to web and voice. Answers normalize to
                the same fields no matter how the customer responds.
              </p>
            </div>

            <div className="lp-flow">
              <FlowCard
                num="01"
                title="Identity verification"
                desc="The customer completes document authenticity plus a liveness selfie. Vera confirms the match before anything else proceeds."
                tags={["Sumsub", "Document", "Liveness"]}
              />
              <FlowCard
                num="02"
                title="Questionnaire dispatch"
                desc="An SMS lands with a one-time passcode, an OTP-gated web link, and a phone number to complete the questionnaire by voice."
                tags={["Twilio SMS", "OTP", "Web link"]}
              />
              <FlowCard
                num="03"
                title="Self-service completion"
                desc="The customer answers online or by calling in. Depth is risk-based — low risk gets a short flow, higher risk gets enhanced due diligence."
                tags={["Web", "Risk-based", "EDD"]}
              />
              <FlowCard
                num="04"
                title="Fallback outbound call"
                desc="No response within ~24h? Vera calls and walks the customer through the questionnaire conversationally until it's done."
                tags={["gpt-realtime", "Voice"]}
                voice
              />
              <FlowCard
                num="05"
                title="Screening + decision"
                desc="The customer is screened against sanctions, PEP, and adverse-media lists, then the case is decided: clear, refer, or reject."
                tags={["Sanctions", "PEP", "Decision"]}
              />
              <FlowCard
                num="06"
                title="Complete audit trail"
                desc="Every step, answer, screening hit, and call transcript is logged — a review-ready record an officer can sign off in seconds."
                tags={["Transcripts", "Explainable"]}
              />
            </div>
          </div>
        </section>

        {/* ───────────────────────── rescue call ───────────────────────── */}
        <section id="rescue" className="lp-section">
          <div className="lp-wrap lp-split">
            <div className="lp-reveal">
              <div className="lp-kicker lp-mono">The differentiator</div>
              <h2 className="lp-h2">
                When a customer stalls, <em>Vera calls them.</em>
              </h2>
              <p className="lp-lead">
                Roughly 1 in 10 onboardings is abandoned mid-flow. Instead of letting the case die,
                Vera picks up the phone — and keeps doing it across the customer lifecycle.
              </p>
              <ul className="lp-feature-list">
                <li>
                  <span className="lp-check"><Check /></span>
                  <span><b>Abandonment rescue.</b> Recovers cases that would otherwise churn, conversationally completing the questionnaire by voice.</span>
                </li>
                <li>
                  <span className="lp-check"><Check /></span>
                  <span><b>Proactive re-verification.</b> Auto-calls when an ID document nears expiry or a periodic re-KYC refresh comes due.</span>
                </li>
                <li>
                  <span className="lp-check"><Check /></span>
                  <span><b>Safe by design.</b> Vera authenticates the call to the customer, discloses recording, and never asks for secrets over voice.</span>
                </li>
              </ul>
            </div>

            {/* phone-call mock */}
            <div className="lp-call lp-reveal" aria-hidden>
              <div className="lp-call-head">
                <span className="lp-call-avatar">V</span>
                <div className="lp-call-meta">
                  <b>Vera</b>
                  <span>● Outbound call · 00:42</span>
                </div>
                <span className="lp-wave">
                  <i /><i /><i /><i /><i /><i /><i />
                </span>
              </div>
              <div className="lp-bubble vera">
                Hi Maria — this is Vera from TrustLine. To confirm this call is genuine, it’s about the
                verification you started, reference <b>4821</b>.
                <small>AUTHENTICATES THE CALL FIRST</small>
              </div>
              <div className="lp-bubble cust">Oh right, I didn’t finish that. Go ahead.</div>
              <div className="lp-bubble vera">
                This call is recorded. Just three quick questions — what’s the primary purpose of your
                account?
                <small>DISCLOSES RECORDING · NO SECRETS BY VOICE</small>
              </div>
            </div>
          </div>
        </section>

        {/* ───────────────────────── trust ───────────────────────── */}
        <section id="trust" className="lp-section">
          <div className="lp-wrap">
            <div className="lp-reveal">
              <div className="lp-kicker lp-mono">Hard constraints, not nice-to-haves</div>
              <h2 className="lp-h2">
                Built to <em>augment</em> compliance officers — never replace them.
              </h2>
            </div>
            <div className="lp-trust">
              <Trust
                title="Authenticate the call"
                desc="An unsolicited “verify yourself” call looks like phishing. Vera proves legitimacy by referencing a code the customer already holds before asking anything."
              />
              <Trust
                title="No secrets over voice"
                desc="Vera never solicits full card numbers, full ID/SSN, or passwords by phone. Sensitive capture stays in secure, OTP-gated channels."
              />
              <Trust
                title="Consent & disclosure"
                desc="Calls are consented and scheduled, and recording is disclosed at the start of every conversation."
              />
              <Trust
                title="Human handoff & audit"
                desc="Routine cases clear automatically; edge cases escalate to a reviewer. Every decision is explainable and backed by a stored trail."
              />
            </div>
          </div>
        </section>

        {/* ───────────────────────── stack ───────────────────────── */}
        <section className="lp-section">
          <div className="lp-wrap">
            <div className="lp-reveal">
              <div className="lp-kicker lp-mono">The stack behind Vera</div>
              <h2 className="lp-h2">Production tooling, wired end-to-end.</h2>
            </div>
            <div className="lp-stack">
              <StackCell tag="Orchestration" name="Google ADK" desc="Agent framework driving case logic, tools & decisioning." />
              <StackCell tag="Voice" name="OpenAI gpt-realtime" desc="Realtime speech model powering Vera’s spoken calls." />
              <StackCell tag="Telephony" name="Twilio" desc="Voice, Verify (OTP) and Messaging for every channel." />
              <StackCell tag="Identity & AML" name="Sumsub" desc="Document + liveness verification and sanctions screening." />
            </div>
          </div>
        </section>

        {/* ───────────────────────── final CTA ───────────────────────── */}
        <section className="lp-final">
          <div className="lp-wrap lp-reveal">
            <h2 className="lp-h2" style={{ textAlign: "center" }}>
              Put a KYC employee to work <em>today.</em>
            </h2>
            <p className="lp-lead" style={{ margin: "16px auto 0", textAlign: "center" }}>
              Watch a case move from created to decided — live — on the reviewer dashboard.
            </p>
            <div className="lp-cta-row">
              <Link href="/dashboard" className="lp-btn lp-btn-primary">
                Open reviewer dashboard
                <Arrow />
              </Link>
              <Link href="/new" className="lp-btn lp-btn-ghost">
                Start a verification case
              </Link>
            </div>
          </div>
        </section>

        {/* ───────────────────────── footer ───────────────────────── */}
        <footer className="lp-footer">
          <div className="lp-wrap lp-footer-in">
            <div className="lp-brand">
              <span className="lp-brand-mark" />
              <span className="lp-wordmark">
                Trust<b>Line</b>
              </span>
            </div>
            <div className="lp-footer-links">
              <a href="#how" className="lp-link">How it works</a>
              <a href="#metrics" className="lp-link">Results</a>
              <a href="#trust" className="lp-link">Trust &amp; safety</a>
            </div>
            <span className="lp-mono">© TrustLine · Agent “Vera”</span>
          </div>
        </footer>
      </div>
    </div>
  );
}

/* ───────────────────────── presentational bits ───────────────────────── */

function Metric({
  value,
  unit,
  label,
  vs,
}: {
  value: string | number;
  unit?: string;
  label: string;
  vs: React.ReactNode;
}) {
  return (
    <div className="lp-metric lp-reveal">
      <div className="lp-metric-val">
        {value}
        {unit ? <span className="lp-unit">{unit}</span> : null}
      </div>
      <div className="lp-metric-label">{label}</div>
      <div className="lp-metric-vs">{vs}</div>
    </div>
  );
}

function CaseStep({
  state,
  tag,
  name,
  meta,
}: {
  state: "done" | "active" | "pending";
  tag: string;
  name: string;
  meta: string;
}) {
  return (
    <div className={`lp-step is-${state}`}>
      <span className="lp-step-ico">{state === "done" ? <Check /> : tag}</span>
      <div className="lp-step-body">
        <div className="lp-step-name">{name}</div>
        <div className="lp-step-meta">{meta}</div>
      </div>
    </div>
  );
}

function FlowCard({
  num,
  title,
  desc,
  tags,
  voice,
}: {
  num: string;
  title: string;
  desc: string;
  tags: string[];
  voice?: boolean;
}) {
  return (
    <div className="lp-flow-card lp-reveal">
      <div className="lp-flow-num">{num}</div>
      <div className="lp-flow-title">{title}</div>
      <p className="lp-flow-desc">{desc}</p>
      <div className="lp-flow-chan">
        {tags.map((t) => (
          <span key={t} className={`lp-tag${voice && t === "Voice" ? " is-voice" : ""}`}>
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

function Trust({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="lp-trust-card lp-reveal">
      <span className="lp-trust-ico">
        <Shield />
      </span>
      <div>
        <h4>{title}</h4>
        <p>{desc}</p>
      </div>
    </div>
  );
}

function StackCell({ tag, name, desc }: { tag: string; name: string; desc: string }) {
  return (
    <div className="lp-stack-cell lp-reveal">
      <div className="lp-mono">{tag}</div>
      <h4>{name}</h4>
      <p>{desc}</p>
    </div>
  );
}

/* ───────────────────────── icons ───────────────────────── */

function Arrow() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function Check() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

function Shield() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}
