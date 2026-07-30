# Personal-plan result email

## Customer.io object

- EU workspace: `219516`
- Transactional message: `9`
- Template: `76`
- Name: `personal_plan_result_artifact`
- Layout: `1`
- State after implementation: `draft`
- Source copy: inactive legacy message/template `8/41`
- Active legacy message/template `7/40` remains unchanged
- Link tracking: enabled
- Send to unsubscribed: enabled (transactional)
- Message retention: disabled by the App API request

Canonical repository sources:

- `docs/customerio/personal-plan-result-artifact-template.html`
- `docs/customerio/personal-plan-result-artifact-plain-text-template.txt`
- `public/images/emails/personal-plan-before-after.jpg`

Read-back fingerprints applied on 2026-07-30:

- HTML SHA-256:
  `bbc86b79f84b6dfd06ba46a03c6f79304600ff8e04e65b21786c6b5c83c37066`
- Plain text SHA-256:
  `4a8f9dd8756d36212ee8965779aa8c7fc6299bfa4c83da74f4b3b74947284785`

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
