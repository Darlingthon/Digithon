// ─────────────────────────────────────────────────────────────
// THE questionnaire — defined ONCE, rendered to web (Track C) and voice
// (Track B). Answers normalize to `field` regardless of channel.
// Risk-based: questions tagged `tier` only appear for that tier and above.
// (LOW gets LOW only; MEDIUM gets LOW+MEDIUM; HIGH gets everything = EDD.)
// ─────────────────────────────────────────────────────────────

export type RiskTier = "LOW" | "MEDIUM" | "HIGH";

export type QuestionType = "text" | "boolean" | "single_select" | "number";

export interface Question {
  /** normalized answer field — stable key used everywhere */
  field: string;
  type: QuestionType;
  /** label shown in the web UI */
  label: string;
  /** how Vera asks it out loud on a call */
  voicePrompt: string;
  options?: string[];
  required?: boolean;
  /** minimum risk tier at which this question appears */
  tier: RiskTier;
}

export interface QuestionnaireDef {
  id: string;
  version: number;
  questions: Question[];
}

const TIER_RANK: Record<RiskTier, number> = { LOW: 0, MEDIUM: 1, HIGH: 2 };

export const QUESTIONNAIRE: QuestionnaireDef = {
  id: "consumer-kyc",
  version: 1,
  questions: [
    {
      field: "occupation",
      type: "text",
      label: "What is your occupation?",
      voicePrompt: "Can you tell me your current occupation?",
      required: true,
      tier: "LOW",
    },
    {
      field: "annualIncomeBand",
      type: "single_select",
      label: "What is your annual income?",
      voicePrompt:
        "Which band best describes your annual income: under 50k, 50 to 150k, or over 150k?",
      options: ["<50k", "50k-150k", ">150k"],
      required: true,
      tier: "LOW",
    },
    {
      field: "sourceOfFunds",
      type: "single_select",
      label: "What is the primary source of your funds?",
      voicePrompt: "What is the main source of the funds for this account?",
      options: ["Salary", "Business", "Investments", "Inheritance", "Other"],
      required: true,
      tier: "LOW",
    },
    {
      field: "isPep",
      type: "boolean",
      label: "Are you, or are you closely associated with, a politically exposed person?",
      voicePrompt:
        "Are you, or anyone close to you, a politically exposed person — for example a senior government official?",
      required: true,
      tier: "MEDIUM",
    },
    {
      field: "expectedMonthlyVolume",
      type: "single_select",
      label: "What is your expected monthly transaction volume?",
      voicePrompt: "Roughly how much do you expect to move through the account each month?",
      options: ["<10k", "10k-100k", ">100k"],
      required: true,
      tier: "MEDIUM",
    },
    // ── Enhanced Due Diligence (HIGH-risk only) ──
    {
      field: "sourceOfWealthDetail",
      type: "text",
      label: "Please describe how you accumulated your overall wealth.",
      voicePrompt:
        "For our enhanced checks, could you describe in a sentence or two how you built up your overall wealth?",
      required: true,
      tier: "HIGH",
    },
    {
      field: "foreignAccounts",
      type: "boolean",
      label: "Do you hold accounts or assets in other jurisdictions?",
      voicePrompt: "Do you hold any accounts or significant assets in other countries?",
      required: true,
      tier: "HIGH",
    },
  ],
};

/** Questions to ask for a given risk tier (risk-based depth). */
export function questionsForTier(tier: RiskTier, def: QuestionnaireDef = QUESTIONNAIRE): Question[] {
  return def.questions.filter((q) => TIER_RANK[q.tier] <= TIER_RANK[tier]);
}

/** Normalized answer bag — same shape from web or voice. */
export type Answers = Record<string, string | number | boolean | null>;
