# Live Vera voice test

Place a real phone call where Vera (OpenAI Realtime) runs the KYC questionnaire
over a Twilio call, bridged via Media Streams. One command once creds are set.

## 1. Credentials → `.env`

| Var | Where to get it | Needed for |
|---|---|---|
| `OPENAI_API_KEY` | platform.openai.com → API keys (must have Realtime access) | Vera's voice (`gpt-realtime-2`) |
| `TWILIO_ACCOUNT_SID` | Twilio Console dashboard | Telephony |
| `TWILIO_AUTH_TOKEN` | Twilio Console dashboard | Telephony |
| `TWILIO_PHONE_NUMBER` | A **voice-capable** Twilio number (E.164, e.g. `+1815…`) | The "from" number |

Optional (for the SMS half / OTP): `TWILIO_MESSAGING_SERVICE_SID`,
`TWILIO_VERIFY_SERVICE_SID`. Not required for the voice call itself.

## 2. One-time setup

```bash
ngrok config add-authtoken <your-ngrok-token>   # free at ngrok.com
npm run db:up && npm run db:seed                 # Postgres + demo cases
```

> **Twilio trial accounts** can only call **verified** numbers — verify your own
> phone in the Twilio Console first (Phone Numbers → Verified Caller IDs).

## 3. Place the call

```bash
./scripts/voice-test.sh +1<your-phone>            # calls you, runs case_demo_bob
# or a specific case (must be in QUESTIONNAIRE_SENT):
./scripts/voice-test.sh +1<your-phone> case_demo_bob
```

The script starts ngrok, boots channels with the public URL, and places an
outbound call. **Pick up** — Vera discloses recording, then walks you through the
questionnaire. When you finish, she calls `submit_questionnaire`, which records
the answers on the case (`recordAnswers(VOICE)`) and saves the transcript.

Watch `/tmp/voice-live.log` (the script tails it) for: `stream start`, transcript
turns, `✅ voice answers recorded`, `📝 transcript saved`.

## 4. Verify it worked

The case advances `QUESTIONNAIRE_SENT → QUESTIONNAIRE_DONE` and the dashboard
shows the answers + call transcript. Quick DB check:

```bash
docker exec trustline-postgres psql -U trustline -d trustline -c \
  "select status from \"Case\" where id='case_demo_bob';
   select channel, answers from \"QuestionnaireResponse\" where \"caseId\"='case_demo_bob';"
```

## Gotchas

- **ngrok free interstitial:** if Twilio fails to fetch TwiML, the free ngrok
  warning page is intercepting. Use a paid ngrok domain, or run
  `ngrok http 4000 --request-header-add "ngrok-skip-browser-warning: 1"`.
- **No audio / immediate hangup:** check `OPENAI_API_KEY` has Realtime access and
  `voice:live` shows in `GET /health`.
- **Call never rings:** trial account + unverified destination, or
  `TWILIO_PHONE_NUMBER` isn't voice-capable.
- **`recordAnswers` rejected:** the case isn't in `QUESTIONNAIRE_SENT`. Use
  `case_demo_bob`, or dispatch a fresh case first (`POST /dispatch/:caseId`).
