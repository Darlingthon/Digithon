# TrustLine — cost estimate (one demo week)

Estimate for running the stack on **GCP Cloud Run + Cloud SQL** for one week, with
live Twilio + OpenAI voice. Figures are current as of June 2026 (sources at the
bottom). Two buckets: **fixed** (infra running 24/7) and **variable** (per call/SMS).

## Fixed infra — ~$15 / week

| Item | Rate | Weekly |
|---|---|---|
| **Cloud SQL** `db-f1-micro` Postgres + 10 GB | ~$7–10/mo | **~$2** |
| **Cloud Run — channels** (min-instances=1, 1 vCPU, no-CPU-throttle, always-on for the voice bridge + fallback sweep) | $0.000024/vCPU-s | **~$11–13** |
| **Cloud Run — web** (scale-to-zero) | mostly free tier | **~$0–1** |
| **Cloud Run — agent** (scale-to-zero) | mostly free tier | **~$0–1** |
| Artifact Registry image storage | $0.10/GB/mo | **~$0.10** |
| Cloudflare tunnels | free | **$0** |

> The big fixed cost is the **always-on channels instance**. If you don't need the
> 24/7 auto-call sweep, set `--min-instances 0` (scale-to-zero) and the channels
> fixed cost drops to **~$1–2/week** — calls still work, but the "auto-call after
> 24h" sweep only runs while an instance is warm. (Alternative: move the sweep to
> Cloud Scheduler hitting an endpoint.)

## Variable — per usage (the real driver: **voice minutes**)

All-in cost of one **Vera call-minute** ≈ **~$0.45/min**:
- OpenAI `gpt-realtime-2`: $32 / 1M audio-in, $64 / 1M audio-out ≈ **$0.18–0.46/min** (~$0.30 typical with caching)
- Twilio voice to a Bulgarian mobile ≈ **~$0.15/min**

Per **SMS-only** verification (no call): ~**$0.08** (invite + answers-copy SMS ≈ $0.02 + Verify OTP ≈ $0.05).

Sumsub IDV runs in **demo mode → $0** (real IDV would add ~$0.50–1.50 each).

### Scenario: a moderate demo week
50 verification runs, 30 of them with a ~3-minute Vera call (90 call-minutes):

| Item | Calc | Cost |
|---|---|---|
| OpenAI realtime voice | 90 min × ~$0.30 | **~$27** |
| Twilio voice | 90 min × ~$0.15 | **~$14** |
| Twilio SMS + Verify OTP | ~120 SMS + 50 OTP | **~$4** |
| Sumsub (demo mode) | — | **$0** |
| **Variable subtotal** | | **~$45** |

## Bottom line

| Demo intensity | Est. week |
|---|---|
| **Light** (~20 runs, ~30 call-min) | **~$30** |
| **Moderate** (~50 runs, ~90 call-min) | **~$60** |
| **Heavy** (~150 runs, ~300 call-min) | **~$130** |

≈ **$15 fixed + ~$0.45 per Vera call-minute + ~$0.08 per SMS verification.** Voice
minutes dominate — every extra 3-minute call is ~$1.35. Sumsub demo-mode and the
Cloudflare tunnels are free; Cloud SQL is the only meaningful fixed line besides
the always-on channels instance.

### Cheapest-possible demo week
Scale channels to zero between sessions and keep calls short → **~$5–15 fixed +
usage**. Tear down Cloud SQL + Cloud Run when not demoing to stop the meter.

---
Sources: [Cloud Run pricing](https://cloud.google.com/run/pricing) ·
[Cloud SQL pricing](https://cloud.google.com/sql/pricing) ·
[OpenAI API pricing](https://openai.com/api/pricing/) ·
[Twilio Bulgaria SMS](https://www.twilio.com/en-us/sms/pricing/bg) ·
[Twilio Bulgaria Voice](https://www.twilio.com/en-us/voice/pricing/bg)
