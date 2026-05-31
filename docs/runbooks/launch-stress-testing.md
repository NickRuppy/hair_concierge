# Launch Stress Testing

Use these checks before inviting a larger beta group. They are designed to start read-only and only create leads or AI/chat traffic when explicitly enabled.

## Setup

Install k6 locally:

```bash
brew install k6
```

Pick a target:

```bash
export K6_BASE_URL="https://chaarlie.de"
```

For preview deployments, use the Vercel preview URL instead. Run write or AI modes against preview first.

## Commands

```bash
npm run stress:smoke
npm run stress:average
npm run stress:spike
npm run stress:safety
npm run stress:soak
```

Profiles:

- `smoke`: 1 virtual mobile user for 1 minute.
- `average`: ramps from 5 to 15 concurrent users.
- `spike`: jumps up to 50 concurrent users.
- `safety`: ramps up to 75-100 concurrent users.
- `soak`: 15 users for 30 minutes by default.

Override soak length when needed:

```bash
K6_SOAK_VUS=10 K6_SOAK_DURATION=45m npm run stress:soak
```

The script includes human-ish pauses between page views. Tune them if a test is meant to model slower or faster browsing:

```bash
K6_THINK_TIME_MIN=4 K6_THINK_TIME_MAX=12 npm run stress:average
```

## Optional Write Paths

By default the script only hits public mobile pages. Enable database-writing quiz lead traffic deliberately:

```bash
K6_WRITE_MODE=1 npm run stress:average
```

Enable the AI-backed quiz analysis path only for a short, intentional run:

```bash
K6_WRITE_MODE=1 K6_AI_MODE=1 npm run stress:smoke
```

To exercise authenticated `/chat`, copy a short-lived browser session cookie from a dedicated paid test user:

```bash
K6_SESSION_COOKIE='sb-...=...; hc_returning=1' npm run stress:smoke
```

To post chat messages and spend OpenAI tokens:

```bash
K6_SESSION_COOKIE='sb-...=...; hc_returning=1' K6_CHAT_MODE=1 npm run stress:smoke
```

Keep `K6_CHAT_MODE` low volume. Do not combine it with `stress:safety` unless OpenAI/Supabase/Vercel limits and cost ceilings have been checked.

## What To Watch During A Run

- Vercel function errors, duration, and cold starts.
- Supabase API/database errors, auth 429s, and connection pressure.
- OpenAI 429s/timeouts and total token spend.
- Stripe and PayPal webhooks if checkout-adjacent flows are being manually tested.
- Sentry errors, release health, and replay-on-error sessions.
- PostHog funnel drop-offs for quiz/result/pricing/chat.

## Stop Conditions

Stop the run if any of these happen:

- sustained `http_req_failed` over 5%;
- p95 request duration above 3s for public pages;
- `x-vercel-mitigated: deny` responses from the Vercel edge;
- repeated 429s from Supabase Auth, quiz APIs, chat, or OpenAI;
- Vercel function timeouts or memory pressure;
- unexpected paid checkout creation or payment-provider side effects.

If Vercel edge mitigation appears during a local run, pause testing from that IP and rerun with slower think time or a distributed runner. A single laptop can look more bot-like than 15 real mobile users because all traffic comes from one source IP with perfectly repeated paths.

## Manual Companion Checks

Run these manually on mobile Safari/Chrome before and after load:

- landing -> quiz -> result -> pricing;
- checkout test subscription -> welcome -> password or magic link -> onboarding/chat;
- close browser/app after chat, reopen `/chat`, verify login/resume behavior;
- logout/login again for the same paid test user;
- expired/duplicate auth link behavior;
- cancellation or failed-payment entitlement behavior in Stripe test mode.
