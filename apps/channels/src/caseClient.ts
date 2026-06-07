import { createMockCaseActions, type CaseActions } from "@trustline/shared/fixtures";
import { config } from "./config.js";

// The spine: Channels calls CaseActions on the Brain — it never mutates case
// state directly. Until Brain exposes its HTTP API, fall back to the in-memory
// mock so #4 is demoable end-to-end. Set BRAIN_URL to switch to the real agent.

const mock = createMockCaseActions();

async function brainPost(path: string, body: unknown) {
  const res = await fetch(`${config.brainUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Brain ${path} -> ${res.status}`);
  return res.json();
}

export const caseActions: Pick<CaseActions, "dispatchQuestionnaire"> = {
  async dispatchQuestionnaire(caseId: string) {
    if (config.brainUrl) return brainPost(`/cases/${caseId}/dispatch`, {});
    return mock.dispatchQuestionnaire(caseId);
  },
};
