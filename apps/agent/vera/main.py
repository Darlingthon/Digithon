"""Vera ADK agent and Brain Track tools."""

from __future__ import annotations

import os

from .state_machine import CaseStatus, assert_transition

try:
    from dotenv import load_dotenv

    load_dotenv("../../.env")
except ModuleNotFoundError:
    pass

VERA_INSTRUCTION = """
You are Vera, an AI KYC officer for TrustLine. You own a verification case from
start to finish: identity verification, a risk-based questionnaire across web
and voice channels, AML screening, and a clear decision — with a complete audit
trail.

Always drive a case through the pipeline in THIS exact order — never skip or
reorder a step (the case state machine will reject out-of-order calls):
  1. start_case
  2. mark_idv_done        (IDV MUST be done before the questionnaire)
  3. dispatch_questionnaire
  4. record_answers
  5. run_screening
  6. decide
If a tool returns "Illegal case transition", you skipped a step — call the
missing earlier step first, then continue. When asked to run a whole case, do
all six steps yourself in order without stopping to ask.

Hard trust & safety rules (never violate):
- On a phone call, authenticate the call to the customer (reference a code they
  already have) BEFORE asking anything. An unsolicited "verify yourself" call
  looks like a scam.
- Disclose that the call is recorded at the start.
- Never solicit secrets by voice (full card/ID/SSN numbers, passwords).
- Clear routine cases automatically; escalate edge cases to a human reviewer.
- Every decision must be explainable and backed by the stored audit trail.
""".strip()


# ─────────────────── Case-action tools ───────────────────
# Mirror of the CaseActions TS contract in @trustline/shared. These tools write
# to Postgres and append audit events so ADK, Channels, and Frontend share state.

def start_case(entity_name: str, phone: str | None = None, email: str | None = None) -> dict:
    """Create a new KYC case and move it to IDV_PENDING."""
    from . import repository

    return repository.start_case(entity_name, phone=phone, email=email)

def advance_case(case_id: str, current: str, target: str) -> dict:
    """Advance a case to a new state, enforcing the legal transition."""
    assert_transition(CaseStatus(current), CaseStatus(target))
    return {"caseId": case_id, "status": target}


def mark_idv_done(case_id: str, passed: bool) -> dict:
    """Record IDV result (Track C / Sumsub) and advance the case."""
    from . import repository

    return repository.mark_idv_done(case_id, passed)


def dispatch_questionnaire(case_id: str) -> dict:
    """Trigger SMS/OTP + link dispatch (Track B) and advance the case."""
    from . import repository

    return repository.dispatch_questionnaire(case_id)


def record_answers(case_id: str, channel: str, answers: dict) -> dict:
    """Persist normalized questionnaire answers from web or voice."""
    from . import repository

    normalized_channel = "VOICE" if channel.upper() == "VOICE" else "WEB"
    return repository.record_answers(case_id, normalized_channel, answers)


def run_screening(case_id: str) -> dict:
    """Run AML screening (sanctions / PEP / adverse media) — issue #3."""
    from . import repository

    return repository.run_screening(case_id)


def decide(case_id: str) -> dict:
    """Reach an explainable decision: CLEAR | REFER | REJECT — issue #3."""
    from . import repository

    return repository.decide(case_id)


def build_agent():
    """Construct the ADK agent. Imported lazily so the module loads without ADK."""
    from google.adk.agents import Agent  # type: ignore

    return Agent(
        name="vera",
        # Override with GOOGLE_MODEL env. gemini-3-flash-preview is the most
        # capable model on the AI Studio FREE tier (all Pro models are paid-only).
        model=os.environ.get("GOOGLE_MODEL", "gemini-3-flash-preview"),
        instruction=VERA_INSTRUCTION,
        tools=[
            start_case,
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
        print("    State machine + DB-backed tools are ready. To run the real agent:")
        print("      cd apps/agent && python3.11 -m venv .venv && source .venv/bin/activate")
        print("      pip install -e . && adk run vera")
        # Prove the stubs + state machine work even without ADK.
        demo = advance_case("case_demo", CaseStatus.CREATED.value, CaseStatus.IDV_PENDING.value)
        print(f"    Sanity: advanced demo case -> {demo}")


if __name__ == "__main__":
    main()
