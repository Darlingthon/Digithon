"""Postgres-backed case actions for Vera.

Keep SQL small and explicit. Prisma remains schema owner; this module lets the
Python ADK agent execute the same Brain actions without a Node server hop.
"""

from __future__ import annotations

import json
import os
import uuid
from contextlib import contextmanager
from typing import Any

import psycopg
from psycopg.rows import dict_row

from .state_machine import CaseStatus, assert_transition


QUESTIONNAIRE_ID = "consumer-kyc"


@contextmanager
def db():
    url = os.getenv("DATABASE_URL")
    if not url:
        raise RuntimeError("DATABASE_URL missing")
    with psycopg.connect(url, row_factory=dict_row) as conn:
        yield conn


def start_case(entity_name: str, phone: str | None = None, email: str | None = None) -> dict[str, Any]:
    with db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                insert into "Entity" ("id", "type", "fullName", "phone", "email", "createdAt", "updatedAt")
                values (%s, 'PERSON', %s, %s, %s, now(), now())
                returning "id"
                """,
                (new_id(), entity_name, phone, email),
            )
            entity_id = cur.fetchone()["id"]
            cur.execute(
                """
                insert into "Case" ("id", "entityId", "status", "riskTier", "reason", "createdAt", "updatedAt")
                values (%s, %s, 'IDV_PENDING', 'LOW', 'ONBOARDING', now(), now())
                returning "id"
                """,
                (new_id(), entity_id),
            )
            case_id = cur.fetchone()["id"]
            append_audit(cur, case_id, "CASE_CREATED", "system", {})
            append_audit(cur, case_id, "CASE_STARTED", "vera", {"status": "IDV_PENDING"})
            conn.commit()
    return get_case_summary(case_id)


def mark_idv_done(case_id: str, passed: bool) -> dict[str, Any]:
    target = CaseStatus.IDV_DONE if passed else CaseStatus.NEEDS_REVIEW
    with db() as conn:
        with conn.cursor() as cur:
            current = get_status(cur, case_id)
            assert_transition(current, target)
            cur.execute(
                """
                insert into "IdvCheck" ("id", "caseId", "provider", "status", "livenessPass", "createdAt", "updatedAt")
                values (%s, %s, 'sumsub', %s, %s, now(), now())
                """,
                (new_id(), case_id, "PASSED" if passed else "FAILED", passed),
            )
            update_status(cur, case_id, target)
            append_audit(cur, case_id, "IDV_PASSED" if passed else "IDV_FAILED", "vera", {})
            conn.commit()
    return get_case_summary(case_id)


def dispatch_questionnaire(case_id: str) -> dict[str, Any]:
    return transition(case_id, CaseStatus.QUESTIONNAIRE_SENT, "QUESTIONNAIRE_SENT", {"questionnaireId": QUESTIONNAIRE_ID})


def record_answers(case_id: str, channel: str, answers: dict[str, Any]) -> dict[str, Any]:
    with db() as conn:
        with conn.cursor() as cur:
            current = get_status(cur, case_id)
            if current not in (CaseStatus.QUESTIONNAIRE_SENT, CaseStatus.REVERIFY_SENT):
                raise ValueError(f"Case {case_id} is not waiting for questionnaire answers")
            cur.execute(
                """
                insert into "QuestionnaireResponse"
                  ("id", "caseId", "questionnaireId", "channel", "answers", "complete", "createdAt", "updatedAt")
                values (%s, %s, %s, %s, %s::jsonb, true, now(), now())
                """,
                (new_id(), case_id, QUESTIONNAIRE_ID, channel, json.dumps(answers)),
            )
            update_status(cur, case_id, CaseStatus.QUESTIONNAIRE_DONE)
            append_audit(cur, case_id, "QUESTIONNAIRE_COMPLETED", "vera" if channel == "VOICE" else "customer", {"channel": channel})
            conn.commit()
    return get_case_summary(case_id)


def run_screening(case_id: str) -> dict[str, Any]:
    with db() as conn:
        with conn.cursor() as cur:
            current = get_status(cur, case_id)
            if current == CaseStatus.QUESTIONNAIRE_DONE:
                assert_transition(current, CaseStatus.SCREENING)
                update_status(cur, case_id, CaseStatus.SCREENING)
            cur.execute('select e."fullName" from "Case" c join "Entity" e on e.id = c."entityId" where c.id = %s', (case_id,))
            name = cur.fetchone()["fullName"].lower()
            hits = {
                "SANCTIONS": "testsanc" in name or "sanction" in name,
                "PEP": "testpep" in name or " pep" in name,
                "ADVERSE_MEDIA": "mockmedi" in name or "adverse" in name or "crime" in name,
            }
            cur.execute('delete from "ScreeningResult" where "caseId" = %s', (case_id,))
            for kind, hit in hits.items():
                cur.execute(
                    """
                    insert into "ScreeningResult" ("id", "caseId", "type", "hit", "details", "provider", "createdAt")
                    values (%s, %s, %s, %s, %s::jsonb, 'sumsub_mock', now())
                    """,
                    (new_id(), case_id, kind, hit, json.dumps({"agent": "python", "source": "sandbox-name-rule"})),
                )
            append_audit(cur, case_id, "SCREENING_HIT" if any(hits.values()) else "SCREENING_CLEAR", "vera", hits)
            conn.commit()
    return get_case_summary(case_id)


def decide(case_id: str) -> dict[str, Any]:
    with db() as conn:
        with conn.cursor() as cur:
            current = get_status(cur, case_id)
            if current not in (CaseStatus.SCREENING, CaseStatus.NEEDS_REVIEW):
                raise ValueError(f"Case {case_id} must be SCREENING or NEEDS_REVIEW before decision")
            cur.execute('select type, hit from "ScreeningResult" where "caseId" = %s', (case_id,))
            hits = {row["type"]: row["hit"] for row in cur.fetchall()}
            cur.execute('select "riskTier" from "Case" where id = %s', (case_id,))
            risk_tier = cur.fetchone()["riskTier"]

            outcome = "CLEAR"
            reasons = ["IDV passed", "Questionnaire complete", "No screening hits"]
            target = CaseStatus.DECIDED
            automated = True
            if hits.get("SANCTIONS"):
                outcome, reasons = "REJECT", ["Sanctions screening hit"]
            elif hits.get("PEP") or hits.get("ADVERSE_MEDIA") or risk_tier == "HIGH":
                outcome = "REFER"
                reasons = ["Enhanced review required"]
                target = CaseStatus.NEEDS_REVIEW
                automated = False

            if current != target:
                assert_transition(current, target)
                update_status(cur, case_id, target, decided=target == CaseStatus.DECIDED)
            upsert_decision(cur, case_id, outcome, reasons, automated)
            append_audit(cur, case_id, "ESCALATED_TO_REVIEW" if outcome == "REFER" else "DECISION_MADE", "vera", {"outcome": outcome, "reasons": reasons})
            conn.commit()
    return get_case_summary(case_id)


def transition(case_id: str, target: CaseStatus, event_type: str, data: dict[str, Any]) -> dict[str, Any]:
    with db() as conn:
        with conn.cursor() as cur:
            current = get_status(cur, case_id)
            assert_transition(current, target)
            update_status(cur, case_id, target)
            append_audit(cur, case_id, event_type, "vera", data)
            conn.commit()
    return get_case_summary(case_id)


def get_case_summary(case_id: str) -> dict[str, Any]:
    with db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                select c.id, c.status, c."riskTier", c.reason, c."createdAt", c."decidedAt",
                       e."fullName" as "entityName", d.outcome
                from "Case" c
                join "Entity" e on e.id = c."entityId"
                left join "Decision" d on d."caseId" = c.id
                where c.id = %s
                """,
                (case_id,),
            )
            row = cur.fetchone()
            if not row:
                raise ValueError(f"Case not found: {case_id}")
            return dict(row)


def get_status(cur: psycopg.Cursor, case_id: str) -> CaseStatus:
    cur.execute('select status from "Case" where id = %s', (case_id,))
    row = cur.fetchone()
    if not row:
        raise ValueError(f"Case not found: {case_id}")
    return CaseStatus(row["status"])


def update_status(cur: psycopg.Cursor, case_id: str, status: CaseStatus, decided: bool = False) -> None:
    cur.execute(
        'update "Case" set status = %s, "updatedAt" = now(), "decidedAt" = case when %s then now() else "decidedAt" end where id = %s',
        (status.value, decided, case_id),
    )


def append_audit(cur: psycopg.Cursor, case_id: str, event_type: str, actor: str, data: dict[str, Any]) -> None:
    cur.execute(
        'insert into "AuditEvent" ("id", "caseId", type, actor, data, "createdAt") values (%s, %s, %s, %s, %s::jsonb, now())',
        (new_id(), case_id, event_type, actor, json.dumps(data)),
    )


def upsert_decision(cur: psycopg.Cursor, case_id: str, outcome: str, reasons: list[str], automated: bool) -> None:
    cur.execute(
        """
        insert into "Decision" ("id", "caseId", outcome, reasons, automated, "createdAt")
        values (%s, %s, %s, %s::jsonb, %s, now())
        on conflict ("caseId")
        do update set outcome = excluded.outcome, reasons = excluded.reasons, automated = excluded.automated
        """,
        (new_id(), case_id, outcome, json.dumps(reasons), automated),
    )


def new_id() -> str:
    return uuid.uuid4().hex
