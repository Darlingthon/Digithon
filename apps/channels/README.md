# Channels service (Track B)

Twilio SMS/OTP + (next) Vera voice. Node + Express + ws.

## Run

```bash
npm install                      # from repo root
npm run channels:dev             # tsx watch on :4000
```

Works **without Twilio creds** in dry-run mode: SMS/OTP are logged, OTP `123456`
verifies. Set `TWILIO_*` + `TWILIO_VERIFY_SERVICE_SID` + `TWILIO_MESSAGING_SERVICE_SID`
in the root `.env` to go live, and `CHANNELS_PUBLIC_URL` (ngrok) for callbacks.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | liveness + twilio mode |
| POST | `/dispatch/:caseId` `{phone}` | #4 — send OTP + questionnaire link/call-in SMS |
| POST | `/otp/verify` `{caseId,phone,code}` | OTP gate the web app (#6) redeems |
| POST | `/webhooks/sms` | inbound SMS (signature-validated) |
| POST | `/webhooks/sms-status` | delivery status callback |
| POST | `/voice` | #5 placeholder — disclosure + recording (Media Streams bridge TBD) |

## Local Twilio testing

```bash
brew install --cask ngrok
ngrok http 4000                  # set CHANNELS_PUBLIC_URL to the https URL
```

Point your Twilio number's Messaging + Voice webhooks at `${CHANNELS_PUBLIC_URL}`.

## Spine

Channels never mutates case state directly — it calls `CaseActions` on the Brain
(`caseClient.ts`). Until `BRAIN_URL` is set it uses the in-memory mock from
`@trustline/shared/fixtures`. See [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md).
