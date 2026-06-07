"""Case state machine — Python mirror of packages/db/src/index.ts.

Keep these two in sync: this is the same canonical lifecycle the whole system
shares. Track A owns advancing cases through it.
"""

from enum import Enum


class CaseStatus(str, Enum):
    CREATED = "CREATED"
    IDV_PENDING = "IDV_PENDING"
    IDV_DONE = "IDV_DONE"
    QUESTIONNAIRE_SENT = "QUESTIONNAIRE_SENT"
    QUESTIONNAIRE_DONE = "QUESTIONNAIRE_DONE"
    SCREENING = "SCREENING"
    DECIDED = "DECIDED"
    REVERIFY_DUE = "REVERIFY_DUE"
    REVERIFY_SENT = "REVERIFY_SENT"
    NEEDS_REVIEW = "NEEDS_REVIEW"


# Legal transitions — mirror of CASE_TRANSITIONS in packages/db.
TRANSITIONS: dict[CaseStatus, list[CaseStatus]] = {
    CaseStatus.CREATED: [CaseStatus.IDV_PENDING],
    CaseStatus.IDV_PENDING: [CaseStatus.IDV_DONE, CaseStatus.NEEDS_REVIEW],
    CaseStatus.IDV_DONE: [CaseStatus.QUESTIONNAIRE_SENT],
    CaseStatus.QUESTIONNAIRE_SENT: [CaseStatus.QUESTIONNAIRE_DONE, CaseStatus.NEEDS_REVIEW],
    CaseStatus.QUESTIONNAIRE_DONE: [CaseStatus.SCREENING],
    CaseStatus.SCREENING: [CaseStatus.DECIDED, CaseStatus.NEEDS_REVIEW],
    CaseStatus.DECIDED: [CaseStatus.REVERIFY_DUE],
    CaseStatus.REVERIFY_DUE: [CaseStatus.REVERIFY_SENT],
    CaseStatus.REVERIFY_SENT: [CaseStatus.IDV_PENDING, CaseStatus.QUESTIONNAIRE_SENT],
    CaseStatus.NEEDS_REVIEW: [CaseStatus.SCREENING, CaseStatus.DECIDED],
}


def can_transition(src: CaseStatus, dst: CaseStatus) -> bool:
    return dst in TRANSITIONS.get(src, [])


def assert_transition(src: CaseStatus, dst: CaseStatus) -> None:
    if not can_transition(src, dst):
        raise ValueError(f"Illegal case transition: {src} -> {dst}")
