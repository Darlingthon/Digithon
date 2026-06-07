import { dispatchQuestionnaire as brainDispatch } from "@trustline/db";
import { config } from "./config.js";

// The spine: Channels advances cases through the Brain's case actions, never by
// ad-hoc state writes. The Brain logic lives in @trustline/db (shared), so we
// call it in-process — same as the voice bridge uses recordAnswers/transcript.
// Set BRAIN_URL to route through a remote Brain HTTP API instead.

async function brainPost(path: string, body: unknown) {
  const res = await fetch(`${config.brainUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Brain ${path} -> ${res.status}`);
  return res.json();
}

export const caseActions = {
  async dispatchQuestionnaire(caseId: string): Promise<{ status: string }> {
    if (config.brainUrl) {
      return brainPost(`/api/cases/${caseId}/actions/dispatch-questionnaire`, {});
    }
    return brainDispatch(caseId);
  },
};
