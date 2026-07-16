# Customer.io quiz-result email

The repository is the source of truth for the transactional quiz-result email:

- `quiz-result-artifact-template.html` is the exact HTML content fragment.
- `quiz-result-artifact-plain-text-template.txt` is the complete MIME plain-text alternative.
- `scripts/customerio-quiz-result-email.ts` owns the approved subject, preheader, target IDs, guarded diff/apply flow, read-back verification, and rollback files.

Do not paste a second body copy into this directory. Do not add an HTML document wrapper or legal footer to the HTML fragment: Customer.io layout `1` provides the outer `<html>`/`<body>` document and the single unsubscribe, imprint, and privacy footer.

## Live objects

The script deliberately requires the full workspace/message/template tuple on every invocation and rejects any other pairing.

| Target            | EU workspace | Transactional message | Template | Expected name                 | Layout |
| ----------------- | -----------: | --------------------: | -------: | ----------------------------- | -----: |
| Draft staging     |     `219516` |                   `8` |     `41` | `[Copy] quiz_result_artifact` |    `1` |
| Active production |     `219516` |                   `7` |     `40` | `quiz_result_artifact`        |    `1` |

The management API is `https://eu.fly.customer.io`. It is separate from the App API used by the application to send transactional messages.

## Liquid contract

The application sends these `trigger` fields:

```text
lead_id
first_name
headline
intro
signals[]              { label, conclusion }
foundation_products[] { category_label, name, note, image_url, cadence_label, cadence_qualifier }
app_stories[]          { label, headline, body }
cta_label
result_url
```

The template must use `trigger.result_url` for both links. It must not reconstruct the result URL from `lead_id`. User- or data-derived values are HTML-escaped in the HTML fragment. The plain-text alternative uses the already-controlled trigger values without HTML escaping so names, ampersands, and the attributed result URL do not turn into literal entities such as `&amp;`. Product images are optional: all product meaning remains in live text when an image is missing, blocked, or unsupported.

During the first deployment, the application also sends the legacy `rows`, `main_lever_title`, `main_lever_why`, and `routine_levers` fields so active template `40` remains rollback-compatible. The refreshed template does not render those fields. Remove the transport shim in a separate cleanup after the rollback window closes.

## Canonical metadata

Subject:

```liquid
{% if trigger.first_name != blank %}{{ trigger.first_name }}, deine Haaranalyse ist fertig{% else %}Deine Haaranalyse ist fertig{% endif %}
```

Preheader:

```text
Entdecke, womit deine Pflege beginnt und wie Chaarlie dich im Alltag begleitet.
```

CTA:

```text
Mit Chaarlie starten
```

## Safe operator flow

All commands are dry-run/read-only unless `--apply` is supplied. A preview performs `cio auth status`, reads the current `templates.update` schema, reads the selected template, validates the generated PUT locally through `cio --dry-run`, and prints changed fields and body checksums. It does not update Customer.io or send a message.

The wrapper pins `@customerio/cli@0.0.19` through `npx --yes`. The previously installed `cio 0.0.5` recursively decoded JSON newline escapes and could not safely transport a real multiline `body_plain`. Version `0.0.19` provides `--argjson`; the wrapper binds the merged template from a JSON file into a small jq-style request program. Do not replace that path with the old `--json @request.json` form or flatten the text alternative.

```bash
npm run customerio:quiz-result-email -- \
  --target draft \
  --environment-id 219516 \
  --message-id 8 \
  --template-id 41
```

Customer.io's template update is a full replacement, not a content-only patch. The tool therefore reads the selected template and merges every confirmed writable field before replacing subject, preheader, HTML, and plain text. It preserves the target's name, layout, sender/reply identities, editor, template engine, preprocessor, headers, and other writable metadata. It intentionally omits GET-only fields and the empty live `request_method`, which conflicts with the PUT schema enum. Preview and apply also verify the transactional message's draft/active state, the message-template pairing, and the required legal content in layout `1`. Immediately before a PUT, the tool re-reads the target and aborts if any writable field changed after preview.

Apply to the inactive draft only after reviewing the preview:

```bash
npm run customerio:quiz-result-email -- \
  --target draft \
  --environment-id 219516 \
  --message-id 8 \
  --template-id 41 \
  --apply
```

Before an apply, the tool writes the raw GET response, the exact rollback template, and the update template under ignored `tmp/customerio-quiz-result-email/`. It prints the backup path and exact pinned-CLI rollback command before the PUT, so recovery instructions remain visible even if read-back verification fails. After the PUT, it reads back the template and compares every writable field.

Active apply has a separate confirmation gate:

```bash
npm run customerio:quiz-result-email -- \
  --target active \
  --environment-id 219516 \
  --message-id 7 \
  --template-id 40 \
  --apply \
  --confirm-active
```

The tool never calls a send or audience endpoint. Test sends remain a controlled manual Customer.io operation to named internal inboxes.

## Release gates

1. Deploy the application payload and `entry=result_email` route support first. Keep legacy payload fields during this window.
2. Verify the last 30 days of completed first-party funnel sessions:

   ```sql
   select package_key, offer_variant, count(*) as completed_sessions
   from public.funnel_sessions
   where quiz_completed_at >= now() - interval '30 days'
   group by package_key, offer_variant
   order by completed_sessions desc;
   ```

   Stop if any recent completed session has `offer_variant <> 'app-value-stack'`. The email must not restate an offer different from the result page the user will reopen.

3. Preview and then apply only to inactive template `41`.
4. Render with named and blank-name synthetic fixtures. Confirm no missing Liquid values and that the CTA and visible URL are identical.
5. Complete controlled client QA before touching template `40`.
6. Preview active `40`; review that only subject, preheader, body, and body plain change and that active-specific identity IDs and `premailer` remain.
7. Apply to active `40` only with owner authorization, then use one controlled production transaction and confirm `entry_context=result_email` in PostHog.
8. Monitor delivery, bounce, click, application-error, and return-session signals. Historical message metrics contain earlier revisions and are directional only.
9. Restore the timestamped rollback payload immediately if Liquid data, personalized routing, the text alternative, or client rendering fails.

Do not switch the application to message `8`. It is the staging surface only.

## Compatibility acceptance

Check:

- Gmail web and mobile;
- Apple Mail on iPhone and macOS;
- Outlook web and a Windows/desktop Outlook rendering when available;
- WEB.DE or GMX;
- images blocked;
- dark mode;
- a mailbox configured to select the plain-text MIME part.

The acceptance bar is readable document order, complete live text, and a working personalized URL—not pixel identity. System fonts, square buttons, missing shadows, and absent optional thumbnails are acceptable degradations. The plain-text part is a true alternative for clients or preferences that select it; the HTML itself must remain complete when images or advanced styling fail.
