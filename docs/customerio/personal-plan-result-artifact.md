# Personal-plan result email

## Customer.io object

- EU workspace: `219516`
- Transactional message: `9`
- Template: `76`
- Name: `personal_plan_result_artifact`
- Layout: `1`
- State after implementation: `draft`
- **State observed 2026-08-27: `active`, `has_sent_message: true`** — see "Sync is manual now" below
- Source copy: inactive legacy message/template `8/41`
- Active legacy message/template `7/40` remains unchanged
- Link tracking: enabled
- Send to unsubscribed: enabled (transactional)
- Message retention: disabled by the App API request

Canonical repository sources:

- `docs/customerio/personal-plan-result-artifact-template.html`
- `docs/customerio/personal-plan-result-artifact-plain-text-template.txt`
- `public/images/emails/personal-plan-before-after.jpg`

Fingerprints of the canonical repository sources (what an `--apply` would push).
Updated 2026-08-27 with the retired-ceremony copy correction:

- HTML SHA-256:
  `2392be0d7fb53e9037886fbc4f5513ecaf55024fd5722ec84f06562bcff00ac3`
- Plain text SHA-256:
  `48462236e91d35c129978ea336eff9e0a8be59115e0a6728fb59d1a16de0b4a5`

Fingerprints read back from live message/template `9/76` on 2026-08-27 — i.e. what
subscribers currently receive, still the pre-correction copy:

- HTML SHA-256:
  `c14c4d5e97cd6fb1020a174e1df891660d03e5795fe61d5d26c28e317ae5c62c`
- Plain text SHA-256:
  `4a8f9dd8756d36212ee8965779aa8c7fc6299bfa4c83da74f4b3b74947284785`

The previous HTML pin (`bbc86b79…`, dated 2026-07-30) was stale: the template was
changed and applied again in PR #295 without re-pinning. The live read-back above
matched this repository's HTML byte-for-byte before the 2026-08-27 edit, so the
repository was — and remains — the accurate source of truth.

## Sync is manual now

The guarded apply path in `scripts/customerio-personal-plan-result-email.ts` no
longer runs against message `9`. `assertPersonalPlanMessage` requires
`state: "draft"` and `has_sent_message: false`; the message is now `active` and has
sent, so both `--apply` and the read-only preview abort with
`Personal-plan Customer.io message identity/settings check failed`. That guard is
correct — it exists to stop an automated write to a live, already-sending
transactional message — so it must not be relaxed to push a copy change.

Applying a copy correction to the live email is therefore an explicit operator
step: back up the current template, update message `9` / template `76` from the two
canonical files, and re-pin the live read-back fingerprints above.

Subject:

```text
Dein persönlicher Haarplan ist bereit
```

Preheader:

```text
Wir haben dein Haarprofil analysiert. Dein persönlicher Plan wartet auf dich.
```

## Runtime contract

Production must configure:

```text
CUSTOMERIO_APP_API_KEY
CUSTOMERIO_PERSONAL_PLAN_RESULT_TRANSACTIONAL_MESSAGE_ID=9
NEXT_PUBLIC_SITE_URL=https://chaarlie.de
```

The result reveal calls `/api/quiz/personal-plan-result-artifact` without blocking navigation. The
server atomically claims only `quiz_kind = personal_plan`, loads the attached prepared artifact,
and sends the transactional message once.

Message data:

```text
lead_id
profile_line
comparison_image_url
primary_message       { kind, label }
diagnostic_rows[]     { id, title, today_label, summary }
plan_fit_statement
cta_label
result_url
```

The CTA is:

```text
https://chaarlie.de/result/<leadId>?entry=result_email&focus=personal_plan_complete_plan#personal_plan_complete_plan
```

`entry=result_email` preserves the existing result-entry attribution. Customer.io link tracking is
enabled on message `9`.

The payload deliberately excludes the locked plan, products, application order, cadence,
diagnostic scores, raw quiz free text, consent values and claim tokens.

## Preview and apply

Preview:

```bash
npm run customerio:personal-plan-result-email -- \
  --environment-id 219516 \
  --message-id 9 \
  --template-id 76
```

Apply to the inactive message:

```bash
npm run customerio:personal-plan-result-email -- \
  --environment-id 219516 \
  --message-id 9 \
  --template-id 76 \
  --apply
```

The operator verifies EU authentication, the current template-update schema, exact inactive
message/template pairing, layout/legal-footer content, unsent state, link tracking, full-template
validation, backup and final read-back.

## Release order

1. Merge and deploy the application code and public comparison image.
2. Configure
   `CUSTOMERIO_PERSONAL_PLAN_RESULT_TRANSACTIONAL_MESSAGE_ID=9` in production and redeploy.
3. Verify the deployed route and image.
4. Activate Customer.io message `9`.
5. Complete a real personal-plan quiz with an explicitly approved QA recipient.
6. Verify the lead has `artifact_email_status = sent`, inspect the delivered rich email, inspect
   images-blocked/plain-text behavior, click the CTA, and confirm `entry=result_email` plus the
   `personal_plan_complete_plan` focus plus fragment fallback.

Never activate message `9` before the production application is configured and deployed. Never
change or deactivate legacy message `7` as part of this release.
