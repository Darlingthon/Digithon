"""Vera agent skeleton.

This is a starting point for Track A. It defines the case-action tools Vera
uses to drive a case through the state machine. The tools are currently
in-memory stubs — wire them to Postgres (via the @trustline/db schema) and the
real Sumsub/decision logic in issues #2 and #3.

Runs without google-adk installed (prints guidance) so the scaffold is
verifiable on Python 3.9; install ADK on 3.10+ to run the real agent.
"""

from __future__ import annotations

from .state_machine import CaseStatus, assert_transition

VERA_INSTRUCTION = """
You are Vera, an AI KYC officer for TrustLine. You own a verification case from
start to finish: identity verification, a risk-based questionnaire across web
and voice channels, AML screening, and a clear decision — with a complete audit
trail.

Hard trust & safety rules (never violate):
- On a phone call, authenticate the call to the customer (reference a code they
  already have) BEFORE asking anything. An unsolicited "verify yourself" call
  looks like a scam.
- Disclose that the call is recorded at the start.
- Never solicit secrets by voice (full card/ID/SSN numbers, passwords).
- Clear routine cases automatically; escalate edge cases to a human reviewer.
- Every decision must be explainable and backed by the stored audit trail.
""".strip()


# ─────────────────── Case-action tools (stubs) ───────────────────
# Mirror of the CaseActions TS contract in @trustline/shared. Replace the bodies
# with real DB writes + integration calls.

def advance_case(case_id: str, current: str, target: str) -> dict:
    """Advance a case to a new state, enforcing the legal transition."""
    assert_transition(CaseStatus(current), CaseStatus(target))
    return {"caseId": case_id, "status": target}


def mark_idv_done(case_id: str, passed: bool) -> dict:
    """Record IDV result (Track C / Sumsub) and advance the case."""
    target = CaseStatus.IDV_DONE if passed else CaseStatus.NEEDS_REVIEW
    return {"caseId": case_id, "status": target.value, "idvPassed": passed}


def dispatch_questionnaire(case_id: str) -> dict:
    """Trigger SMS/OTP + link dispatch (Track B) and advance the case."""
    return {"caseId": case_id, "status": CaseStatus.QUESTIONNAIRE_SENT.value}


def record_answers(case_id: str, channel: str, answers: dict) -> dict:
    """Persist normalized questionnaire answers from web or voice."""
    return {"caseId": case_id, "status": CaseStatus.QUESTIONNAIRE_DONE.value, "channel": channel}


def run_screening(case_id: str) -> dict:
    """Run AML screening (sanctions / PEP / adverse media) — issue #3."""
    return {"caseId": case_id, "status": CaseStatus.SCREENING.value}


def decide(case_id: str) -> dict:
    """Reach an explainable decision: CLEAR | REFER | REJECT — issue #3."""
    return {"caseId": case_id, "status": CaseStatus.DECIDED.value, "outcome": "CLEAR"}


def build_agent():
    """Construct the ADK agent. Imported lazily so the module loads without ADK."""
    from google.adk.agents import Agent  # type: ignore

    return Agent(
        name="vera",
        model="gemini-2.0-flash",
        instruction=VERA_INSTRUCTION,
        tools=[
            mark_idv_done,
            dispatch_questionnaire,
            record_answers,
            run_screening,
            decide,
        ],
    )


def main() -> None:
    try:
        agent = build_agent()
        print(f"✅ Vera agent constructed: {agent.name}")
        print("Run with the ADK CLI: `adk run vera` (see apps/agent/README.md)")
    except ModuleNotFoundError:
        print("⚠️  google-adk not installed (needs Python >=3.10).")
        print("    State machine + tool stubs are ready. To run the real agent:")
        print("      cd apps/agent && python3.11 -m venv .venv && source .venv/bin/activate")
        print("      pip install -e . && adk run vera")
        # Prove the stubs + state machine work even without ADK.
        demo = advance_case("case_demo", CaseStatus.CREATED.value, CaseStatus.IDV_PENDING.value)
        print(f"    Sanity: advanced demo case -> {demo}")


if __name__ == "__main__":
    main()
