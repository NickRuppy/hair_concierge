# Customer.io Personalized Result Email Refresh — Implementation Plan

**Status:** Local implementation complete; Customer.io rollout pending owner authorization

**Date:** 2026-07-16

**Implementation base:** rechecked against fresh `origin/main` at `d869f81`; the intervening commit only added the `$bug` workflow and did not touch result, offer, analytics, or Customer.io code
**Live Customer.io reference:** EU workspace `219516`; active transactional message `7` / template `40`; inactive copy `8` / template `41`

**Implementation receipt:** The application payload, shared copy, email HTML/plain-text sources, return attribution, guarded operator workflow, documentation, and regression tests are implemented in the isolated task worktree. Focused tests, read-only previews of both live targets, a 320px rendered-email check, and `npm run ci:verify` pass. No Customer.io template was changed and no message was sent; the release gates below remain intentionally pending.

**Visual and journey sign-off:** The owner reviewed the mockup in HTML, images-blocked, and plain-text modes during this planning session. The durable approved artifact is `docs/mockups/customerio-result-email-shared-core.html`. The approved direction is rich HTML with optional product thumbnails, no app screenshots, the three Chaarlie capabilities explained in text, and a full text-only alternative. The owner also confirmed the recovery journey: quiz completion shows the personalized offer first; the triggered email repeats its core information and returns a user who closed the window to the same personalized offer page.

**Independent plan review:** Claude Code reviewed this plan read-only twice on 2026-07-16. Accepted findings are incorporated below, including sanitized hero input, mandatory rollout compatibility fields and tests, a separate operator guide, exact test paths, stable story tracking IDs, an external-schema preflight, a durable mockup, a reproducible active-package gate, and explicit observational measurement.

## Goal Contract

**Outcome:** Replace the stale quiz-result email with a rich, email-safe restatement of the current personalized offer page. The email should help a quiz completer who closed the browser understand the same starting point again and return to the same personalized offer page to continue toward purchase.

**In scope:**

- reuse the current offer page's personalized hero, three signals, two foundation product examples, cadence, and three Chaarlie capability stories;
- update the shared offer/email CTA to `Mit Chaarlie starten` while leaving price-specific checkout buttons unchanged;
- preserve the existing transactional trigger, claim/idempotency, Customer.io App API delivery, and personalized result URL;
- ship a rich HTML version that retains all essential meaning when images or CSS fail;
- ship a complete multipart plain-text alternative;
- add explicit email-return attribution without creating a new destination;
- make the repository the canonical source for the Customer.io subject, preheader, HTML, plain text, and update payload;
- stage, test, activate, verify, monitor, and document rollback for the live Customer.io update.

**Out of scope:**

- redesigning the offer page beyond the already-approved shared CTA label;
- screenshots, testimonials, FAQ, guarantees, plan prices, discounts, urgency, or checkout controls inside the email;
- a new recommendation calculation, email-specific product selection, or a separately maintained email narrative;
- changes to quiz completion timing, lead claiming, transactional consent behavior, billing, or payment providers;
- unrelated Customer.io campaigns or lifecycle emails.

**Done when:** The app and email derive their content from the same builders; the active email renders the approved hierarchy with the approved subject/preheader and CTA; image-off, limited-CSS, and plain-text variants retain the complete meaning and working personalized URL; the return visit reaches the existing personalized offer page through `?focus=unlock-plan&entry=result_email` and records `entry_context=result_email`; focused tests and repository checks pass; controlled live test sends pass in the named clients; and live template read-back matches the committed source.

**Stop conditions:** Do not activate the live template if the app payload is not deployed first, the Customer.io render shows missing Liquid data, the personalized URL does not resolve to the correct lead's result page, the plain-text part is absent, or any essential content disappears when images are blocked.

## Product Decisions Locked

### Designed user journey — confirmed

```text
Quiz completion
  -> personalized offer page
  -> transactional result email with the same core information
  -> CTA returns to that same personalized offer page
  -> user can resume and purchase there
```

The email is a recovery touchpoint, not a second funnel or a different offer. It repeats enough of the personalized value to be useful after the original window has been closed, then returns the user to the canonical result page.

1. A user completes the quiz and immediately sees the canonical personalized offer page built from their stored answers.
2. Quiz completion triggers the existing idempotent transactional result email. The subject uses their sanitized first name when available and the approved non-personalized fallback otherwise.
3. In a capable email client, the user sees the same personalized hero, three care signals, two foundation product examples, and three concise explanations of how Chaarlie helps—without app screenshots, pricing, urgency, testimonials, or checkout controls.
4. If images are blocked or WebP is unsupported, the optional thumbnails may disappear but every product name, explanation, cadence, and action remains live text. If CSS is limited, the content remains readable in document order. If the client selects plain text, the complete equivalent content and personalized URL are present in the MIME text alternative.
5. The user selects `Mit Chaarlie starten` or copies the visible result URL. Both open the same personalized `/result/{leadId}` page with `focus=unlock-plan` and `entry=result_email`.
6. The result page scrolls to the existing Chaarlie/unlock explanation, retains the lead's stored funnel package and offer variant, and records the return as `entry_context=result_email`.
7. The user can continue to the existing pricing and checkout flow there. The email itself never creates a parallel purchase path.

**Journey sign-off:** Confirmed by the owner in this planning session, including the recovery purpose, same-page destination, screenshot-free product explanation, optional-image degradation, complete plain-text fallback, subject, preheader, and CTA.

This is a content-consistency and recovery-quality change, not a controlled conversion experiment. There is no clean causal before/after baseline because the active message already contains multiple historical revisions. After rollout, use `entry_context=result_email` to observe return sessions and their pricing, checkout, and purchase follow-through; do not claim lift without a separate experiment.

### Subject, preheader, and CTA

- Subject with a usable first name: `{Vorname}, deine Haaranalyse ist fertig`
- Subject fallback: `Deine Haaranalyse ist fertig`
- Customer.io Liquid subject:
  `{% if trigger.first_name != blank %}{{ trigger.first_name }}, deine Haaranalyse ist fertig{% else %}Deine Haaranalyse ist fertig{% endif %}`
- Preheader: `Entdecke, womit deine Pflege beginnt und wie Chaarlie dich im Alltag begleitet.`
- Shared offer/email CTA: `Mit Chaarlie starten`
- The email CTA uses the app-provided `trigger.result_url`; never rebuild the URL in Liquid from `lead_id`.

### Email hierarchy

1. Chaarlie brand header and short greeting.
2. Exact shared personalized hero headline and intro from the current offer page.
3. `Deine Pflegebasis` with all three shared signals.
4. The same two non-suggested foundation product examples with category, name, note, and cadence.
5. Honest disclosure: these are examples from the product database, not final product recommendations.
6. Compact `Deine Routine ist erst der Anfang.` bridge.
7. The three shared Chaarlie capability stories as text only:
   - `Deine Routine auf einen Blick.` — products, order, and application;
   - `Frag Chaarlie zu deinem Haar.` — profile-aware help;
   - `Frag nach Produkten, die zu dir passen.` — price, application, and rationale.
8. One CTA, `Mit Chaarlie starten`, plus the visible copyable personalized URL.
9. Chaarlie sign-off and exactly one legal/footer block.

Do not include the third suggested/locked product, app screenshots, testimonial copy, survey-count claims, pricing, discounts, guarantee copy, FAQ, or urgency. The landing page remains responsible for the complete sales argument and checkout.

### Progressive enhancement and fallbacks

The product thumbnails are optional visual enhancement. Every product's category, name, note, and cadence must be live text outside the image. Use meaningful `alt` text and explicit dimensions; a missing or unsupported WebP thumbnail may leave an empty visual cell but cannot remove any meaning.

Support four levels deliberately:

1. **Full HTML:** table-based, fluid `600px` container, inline CSS, semantic live text, optional product thumbnails.
2. **Images blocked:** identical text hierarchy, product names/notes/cadence visible, image cells collapse or remain decorative.
3. **Limited CSS / older clients:** tables and document order remain readable; borders, rounded corners, web fonts, and multi-column decoration may disappear without changing meaning or CTA access.
4. **Text-only client or preference:** Customer.io sends a real `body_plain` MIME alternative containing the complete result summary, product examples, Chaarlie explanation, CTA label, personalized URL, sign-off, and legal links.

The plain-text alternative is not a rescue mechanism for a client that selects HTML and then partially breaks it. Therefore the HTML itself must remain understandable without images or advanced styles.

## Current-State Findings to Correct

- `src/lib/customerio/quiz-result-artifact.ts` still builds the retired result narrative (`rows`, `main_lever_*`, `routine_levers`) instead of the current `buildQuizOfferPreview()` plus `buildAppValueStackHeroCopy()` output.
- `src/lib/quiz/app-value-stack-copy.ts` owns the shared hero but still exports `Routine freischalten`.
- The canonical app-value-stack product-capability stories are local constants inside `src/components/quiz/app-value-stack-proof.tsx`, so the email cannot reuse their exact copy without extraction. `src/components/quiz/offer-product-story.tsx` contains intentionally different copy for the historical `default` offer and must remain unchanged.
- The active Customer.io HTML contains obsolete launch/discount copy, a hardcoded result URL, `Charlie` spelling, and mixed `customer.first_name` / `trigger.first_name` namespaces.
- The active Customer.io `body_plain` contains a different obsolete discount from the HTML body.
- The repository currently duplicates the HTML in `quiz-result-artifact-template.html` and `.paste.html`, but live Customer.io has drifted from both.
- Active template `40` is a full HTML document while also using layout `1`, which wraps `{{ content }}` in another document and adds a footer. The refreshed template must be a valid content fragment under the existing layout and must not add a second footer.
- The current result link falls into generic `saved_result` analytics. Email returns are not distinguishable from other revisits.

The layout finding is grounded in a live read-only Customer.io check on 2026-07-16: `GET /v1/environments/219516/layouts/1` returned an outer HTML document with `{{ content }}` plus unsubscribe, imprint, and privacy links; the layout-to-template read showed templates `40` and `41`. Re-read this external state immediately before implementation because it can drift, but do not reopen the footer decision unless the live response has changed.

## Technical Design

### 1. Make the offer's display copy reusable

Modify `src/lib/quiz/app-value-stack-copy.ts`:

- change `APP_VALUE_STACK_CTA_LABEL` to `Mit Chaarlie starten`;
- export a typed, readonly `APP_VALUE_STACK_STORIES` array containing the existing `trackingId`, labels, headlines, and bodies;
- preserve the exact `product_story_routine`, `product_story_chat`, and `product_story_products` IDs and keep them typed against the corresponding `OfferSectionId` literals so extracting the copy cannot silently break section-view analytics;
- keep screenshot paths and alt text out of this shared data; the web component maps its existing screenshots by the stable `trackingId`;
- leave `buildAppValueStackHeroCopy()` and its deterministic logic unchanged.

Modify `src/components/quiz/app-value-stack-proof.tsx` to import the shared story copy and associate the existing screenshot metadata locally. This keeps the offer page visually unchanged while making exact copy reuse possible. Do not create a CMS or a second generic content layer.

The CTA change should update the three offer-owned jump CTAs in `src/funnels/offers/app-value-stack.tsx` and the offer lab automatically. The plan-selection/payment buttons rendered by `pricingSlot` retain their current price-specific labels.

### 2. Build one shared personalized email data contract

Refactor `src/lib/customerio/quiz-result-artifact.ts` so one normalized quiz answer set produces:

- `narrative = buildQuizResultNarrative(quizAnswers)`;
- `preview = buildQuizOfferPreview(quizAnswers)`;
- `sanitizedFirstName = firstName(name)` using the existing 60-character sanitation boundary;
- `hero = buildAppValueStackHeroCopy({ name: sanitizedFirstName, narrative, lane: preview.lane })`;
- `foundationProducts = preview.products.filter(product => !product.suggested)`;
- `appStories = APP_VALUE_STACK_STORIES`.

Send this new template contract:

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

Acceptance constraints:

- exactly three signals;
- exactly the two non-suggested foundation products;
- no raw free-text quiz answer;
- all user/data-derived values use Customer.io's `xml_escape` filter in HTML contexts; its `escape` filter is forbidden because it URL-encodes displayed copy. Sanitized values remain unescaped in non-HTML subject/plain-text contexts so apostrophes, ampersands, and URLs do not become literal entities;
- the email hero uses the sanitized first name, while ordinary valid names still produce the exact same hero copy as the offer page;
- no email-specific calculation or independently authored personalization;
- the product disclaimer remains static template copy, not computed data.

For rollout compatibility, the first application deployment **must retain** the existing legacy fields alongside the new fields. They are a transport shim only: the refreshed template must not render them, and no second copy computation may be added. Remove the legacy fields only after the active template and rollback window are verified; record that cleanup explicitly rather than silently carrying both contracts forever.

All currently active funnel packages (`default_organic` and `meta_routine_v1`) resolve to `app-value-stack`. The public-looking `scalp_check_placeholder` package still resolves to the historical `default` offer. Before activation, verify the last 30 days of first-party `public.funnel_sessions` using `quiz_completed_at`, `package_key`, and `offer_variant`:

```sql
select package_key, offer_variant, count(*) as completed_sessions
from public.funnel_sessions
where quiz_completed_at >= now() - interval '30 days'
group by package_key, offer_variant
order by completed_sessions desc;
```

Activation requires zero recent completed sessions whose `offer_variant <> 'app-value-stack'`. If the query is nonzero, stop for an owner decision about retiring, aligning, or making the email variant-aware; do not knowingly send an app-value-stack restatement to a user whose stored session will reopen the historical offer. This bounded manual gate is accepted for the current two-active-package world; a future non-app-value-stack active package must reopen the architecture decision.

### 3. Preserve the canonical return path and identify email returns

Update the URL builder in `src/lib/customerio/quiz-result-artifact.ts` to keep the existing result destination and focus behavior while adding attribution:

```text
/result/{leadId}?focus=unlock-plan&entry=result_email
```

Modify:

- `src/lib/analytics/events.ts` — add `result_email` to `OfferEntryContext`;
- `src/app/result/[leadId]/page.tsx` — resolve `entry=result_email` explicitly before falling back to `saved_result`;
- relevant routing/tracking tests — prove the context reaches offer analytics while `focus=unlock-plan` still scrolls to the existing bridge.

Do not create a new page, route, checkout, or email-only offer variant. The same lead ID, stored quiz answers, funnel package, offer variant, pricing slot, and checkout remain authoritative.

### 4. Replace the Customer.io HTML with an email-safe fragment

Rewrite `docs/customerio/quiz-result-artifact-template.html` as the exact canonical fragment assigned to template `body` under layout `1`.

- Use nested presentation tables, `role="presentation"`, inline styles, fluid widths, and a `600px` maximum.
- Use system font fallbacks; web fonts and rounded corners are optional enhancement.
- Avoid CSS grid/flexbox, JavaScript, background images, SVG-only meaning, screenshot proof, and icon fonts.
- Render the three signals in document order.
- Render the two product examples with a narrow optional image cell and a full live-text cell.
- Give images explicit width/height, `display:block`, useful `alt`, and no informational text baked into the image.
- Render the app stories as simple text rows/cards; do not include the web screenshots.
- Render `trigger.cta_label` as the button text and `trigger.result_url` as both the button target and a visible copyable link.
- Include a bulletproof, functional link even if button styling is stripped. Rounded corners are not an acceptance requirement.
- Set the approved preheader in both Customer.io's `preheader_text` field and a matching hidden preheader block. Their visible text must match exactly; the hidden block may append standard invisible padding entities after that text for inbox-preview control.
- Do not include `<html>`, `<head>`, or `<body>` in the content fragment and do not include another legal footer; layout `1` supplies the outer document and the single unsubscribe/imprint/privacy footer.

Move the existing setup notes and Liquid contract into `docs/customerio/quiz-result-artifact.md`. Rewrite `docs/customerio/quiz-result-artifact-template.html` to contain only the exact canonical fragment, with no operator-comment header. Then delete `docs/customerio/quiz-result-artifact-template.paste.html`. There must be one canonical HTML body plus one separate human-readable operator guide, not two body copies.

### 5. Replace the plain-text fallback with a real multiline alternative

Rewrite `docs/customerio/quiz-result-artifact-plain-text-template.txt` with normal line breaks and the same information order as the HTML body.

It must include:

- conditional greeting;
- hero headline and intro;
- numbered signals;
- both product examples with category, name, note, and cadence;
- the not-final recommendation disclosure;
- all three Chaarlie capability stories;
- `Mit Chaarlie starten` and `{{ trigger.result_url }}`;
- Chaarlie sign-off, business identity, imprint, and privacy URLs.

Remove the pipe-separated workaround. The sync tooling must read the file and JSON-encode it safely, so real newlines are transmitted in `body_plain` without hand-authored JSON escaping.

### 6. Make repository-to-Customer.io synchronization deterministic

Add a small `scripts/customerio-quiz-result-email.ts` operator script and a package script such as `customerio:quiz-result-email`. It wraps the authenticated `cio` CLI; it must not implement a second Customer.io HTTP client or handle raw credentials itself.

External API preflight is a blocking first step. Re-run `cio auth status`, confirm the EU management base is `https://eu.fly.customer.io`, inspect `cio schema templates.update`, and GET template `41`. The 2026-07-16 read-only schema exposed `PUT /v1/environments/{environment_id}/templates/{template_id}` and the live GET exposed `subject`, `preheader_text`, `body`, `body_plain`, `editor`, `template_engine`, and `layout_id`. Do not write the apply path until the current schema and draft template confirm the exact nested request shape. This management API is distinct from the public message-send App API used by `src/lib/customerio/transactional.ts`.

The script should:

- require the explicit Customer.io workspace, message, and template IDs as flags; default configuration may document `219516`, active `7/40`, and draft `8/41`, but must not silently apply to live;
- read the committed HTML and plain-text files plus subject/preheader constants from one config object;
- after schema preflight, construct the exact CLI template update request with the approved subject/preheader, `body`, and `body_plain`, preserving the live editor/template-engine/layout fields;
- default to local preview/diff mode with no network mutation;
- support `--target draft --apply` and `--target active --apply` as separate explicit operations;
- fetch and save the current target template JSON to an ignored timestamped backup before applying;
- reject active apply unless an explicit confirmation flag is present and the target read-back still matches the expected ID/name/layout;
- update only the intended template fields and preserve sender identity, reply-to identity, layout assignment, transactional settings, and message activation state;
- GET the template after mutation and compare subject, preheader, HTML, plain text, editor, template engine, and layout ID byte-for-byte or by stable checksum;
- print an exact rollback command using the saved backup;
- never send a broad audience message.

Keeping the guarded mutation path is intentional. The previous manual paste workflow produced the live/repository drift this task is correcting. Keep this script narrow—one template, the existing CLI, no reusable deployment framework—but make the canonical files actually deployable and verifiable.

Add a small committed sample payload derived from the representative automated-test fixture if the verification endpoint needs event data. Do not put a real email address, API token, or production lead data in the repository.

### 7. Add contract and regression tests

Update `tests/quiz-result-artifact-email.test.ts` to assert:

- hero data equals `buildAppValueStackHeroCopy()` when called with the same sanitized first name;
- signals and foundation products equal `buildQuizOfferPreview()` output;
- only the two non-suggested products are present;
- product image URLs, notes, and cadence are passed without recomputation;
- all three shared app stories are passed exactly;
- CTA is `Mit Chaarlie starten`;
- URL is the encoded personalized result URL with `focus=unlock-plan` and `entry=result_email`;
- the existing first-name sanitation and no-raw-free-text guarantees remain.
- the existing `rows`, `main_lever_title`, `main_lever_why`, and `routine_levers` assertions remain until the rollout-shim cleanup in step 9.10; that cleanup removes the legacy fields and their assertions together.

Update `tests/app-value-stack-copy.test.ts` and `tests/result-offer-page.test.tsx` for the shared CTA and extracted story constants while proving the offer page hierarchy/copy did not otherwise change.

Add `tests/customerio-quiz-result-template.test.ts` to read the canonical template files and assert:

- required new Liquid fields exist and retired result/discount fields do not;
- no `customer.*`, hardcoded lead URL, discount, launch-special, screenshot, testimonial, price, or urgency copy remains;
- HTML has no document wrapper or duplicate unsubscribe/footer;
- product text and CTA exist outside `<img>` elements;
- every `<img>` has non-empty `alt`, width, and height;
- HTML and plain text both contain the three app-story headlines, CTA, and `trigger.result_url`;
- the plain text has real newlines and no pipe-separator serialization;
- the generated update request exactly matches the canonical files and approved subject/preheader.

Update routing/analytics tests for `OfferEntryContext = result_email`. Run the unchanged transactional request/service tests to prove claim, send, status, failure, and EU App API behavior did not regress.

### 8. Render and compatibility QA before live activation

Local/static verification:

- render the HTML with at least a named fixture and a blank-name fixture;
- inspect desktop and approximately `390px` mobile widths;
- inspect an images-blocked capture;
- inspect a CSS-disabled or aggressively stripped representation;
- inspect the plain-text file as delivered text;
- verify the visible URL is selectable and the CTA URL is identical.

Controlled Customer.io verification on inactive template `41`:

- run sync in diff mode;
- export the current draft template;
- apply only to the draft target;
- use Customer.io's test/verify endpoint with synthetic event data;
- send only to controlled inboxes;
- verify Liquid renders no blank labels, `undefined`, raw HTML, or missing URLs.

Required client matrix:

- Gmail web and mobile;
- Apple Mail on iPhone/macOS;
- Outlook web and one Windows/desktop Outlook rendering if available;
- WEB.DE or GMX;
- images blocked;
- dark mode sanity check;
- a client or mailbox configured to show the plain-text part.

Compatibility acceptance is about readable hierarchy and a working CTA, not pixel identity. Record expected cosmetic differences such as square buttons, system fonts, absent shadows, or missing thumbnails.

### 9. Roll out without a mixed-contract window

Release order:

1. Merge/deploy the application payload and `result_email` route support first. During this window, keep the legacy payload keys needed by active template `40`.
2. Confirm a production-like test trigger still renders the old active email correctly and the new fields appear in Customer.io test data.
3. Complete draft-template client QA.
4. Export active template `40` and its current metadata to an ignored backup.
5. Apply the reviewed source to active template `40` in place. Keep transactional message ID `7`, sender identity, layout `1`, settings, and activation unchanged.
6. Read back and checksum the live template.
7. Send one controlled transaction through active message `7`; verify HTML, plain text, personalized return URL, `#unlock-plan` focus, and `entry_context=result_email` in PostHog.
8. Monitor Customer.io delivery/bounce/click metrics and application error logs for the initial traffic window. Compare against the historical baseline only as a directional check because the live message has multiple prior revisions.
9. If validation fails, restore template `40` from the saved backup. The payload superset keeps rollback compatible.
10. After the rollback window closes, remove the unused legacy payload keys in a small follow-up and rerun the focused email/service tests.

Do not switch the production app to message `8`; it is the staging surface only. Updating active template `40` in place preserves the existing trigger identifier, application configuration, and reporting continuity.

## Target File Map

| File                                                           | Planned change                                                      |
| -------------------------------------------------------------- | ------------------------------------------------------------------- |
| `src/lib/quiz/app-value-stack-copy.ts`                         | Shared CTA and app-story copy exports                               |
| `src/components/quiz/app-value-stack-proof.tsx`                | Consume shared story copy; keep screenshots web-only                |
| `src/lib/customerio/quiz-result-artifact.ts`                   | Build current offer-derived email payload and attributed result URL |
| `src/lib/analytics/events.ts`                                  | Add `result_email` entry context                                    |
| `src/app/result/[leadId]/page.tsx`                             | Parse email return context                                          |
| `docs/mockups/customerio-result-email-shared-core.html`        | Durable approved HTML/images-off/plain-text visual reference        |
| `docs/customerio/quiz-result-artifact.md`                      | Operator setup, live IDs, Liquid contract, QA, and rollback guide   |
| `docs/customerio/quiz-result-artifact-template.html`           | Canonical rich HTML fragment                                        |
| `docs/customerio/quiz-result-artifact-plain-text-template.txt` | Canonical multiline plain-text alternative                          |
| `docs/customerio/quiz-result-artifact-template.paste.html`     | Delete duplicate source                                             |
| `scripts/customerio-quiz-result-email.ts`                      | Narrow CLI-backed diff/apply/read-back/rollback tooling             |
| `package.json`                                                 | Add operator command                                                |
| `tests/quiz-result-artifact-email.test.ts`                     | Shared-data payload contract                                        |
| `tests/app-value-stack-copy.test.ts`                           | Shared CTA/story contract                                           |
| `tests/result-offer-page.test.tsx`                             | Web CTA and no-regression assertions                                |
| `tests/customerio-quiz-result-template.test.ts`                | HTML/plain/config/source-of-truth contract                          |
| routing/analytics tests selected during implementation         | `result_email` propagation and focus behavior                       |

## Verification Commands

Focused automated checks:

```bash
npx tsx --test \
  tests/quiz-result-artifact-email.test.ts \
  tests/customerio-transactional.test.ts \
  tests/quiz-result-artifact-route.test.ts \
  tests/quiz-result-artifact-trigger.test.ts \
  tests/app-value-stack-copy.test.ts \
  tests/quiz-offer-preview.test.ts \
  tests/result-offer-page.test.tsx \
  tests/quiz-result-routing.test.ts \
  tests/analytics-tracking.test.ts \
  tests/customerio-quiz-result-template.test.ts
npm run ci:verify
```

Operator checks:

```bash
npm run customerio:quiz-result-email -- --target draft
npm run customerio:quiz-result-email -- --target draft --apply
# Complete controlled inbox QA and record approval.
npm run customerio:quiz-result-email -- --target active
npm run customerio:quiz-result-email -- --target active --apply --confirm-active
```

The exact command-line interface may be adjusted during implementation, but dry-run must remain the default and active mutation must require a distinct explicit confirmation.

Run `ready-check` after repository verification and before claiming implementation readiness. Stop before commit, push, PR creation, Customer.io draft mutation, Customer.io active mutation, or deployment unless each action has been explicitly authorized in the execution turn.

## Handoff and Execution Shape

- Use a fresh implementation worktree based on the then-current `origin/main`; do not reuse the dirty root checkout or this planning worktree automatically.
- Establish the implementation goal contract before edits.
- Execute sequentially or as one tightly coordinated stream. The payload, templates, sync tooling, and rollout compatibility boundary are coupled enough that parallel writers would add integration risk.
- Keep live Customer.io operations as an explicit operator phase after code review and deployment readiness; repository implementation does not itself authorize external mutation.
- Run an independent whole-branch review and `ready-check` before any shipping request.

## Remaining Risks

- Existing product thumbnails are WebP. Older Outlook variants may omit them; the email is intentionally complete without them. Converting the entire product-image catalog to email-specific JPEG/PNG derivatives is deferred unless controlled client QA shows the empty visual cells are unacceptable.
- Customer.io template/layout updates are external state and not transactionally coupled to the app deployment. The payload-superset release order and saved-template rollback are required mitigations.
- Historical Customer.io metrics combine several template revisions. They can flag obvious degradation but cannot provide a clean before/after experiment without a separate analytics design, which is out of scope.
- Layout `1` contains the legal unsubscribe/imprint/privacy footer. The refreshed template intentionally preserves that live behavior and removes only the duplicate inner document/footer.

## Independent Review Disposition

**Accepted:** corrected nonexistent test paths; sanitized the first name before email hero construction; made the legacy payload shim and its assertions mandatory; split operator notes from the one canonical HTML body; preserved typed story tracking IDs; distinguished the canonical app-value-stack stories from the historical default-offer copy; added management-API schema preflight; added a reproducible first-party active-package mismatch gate; decided the hidden preheader behavior; added the durable approved mockup; and replaced separate typecheck/lint/build lines with `npm run ci:verify`.

**Partially accepted:** retained the Customer.io mutation helper, but narrowed it to one TypeScript wrapper around the already-authenticated EU `cio` CLI. A read-only diff plus manual paste was rejected because manual deployment caused the drift this task is meant to prevent.

**Rejected with evidence:** the layout/footer was not unverified—it was read directly from live Customer.io in this session. The visual and journey gates were also already completed through the reviewed HTML mockup and owner sign-off, now recorded at the top of this plan. The broad compatibility matrix remains because fallback behavior in older providers is an explicit owner requirement, not optional polish.

**Deferred:** a clean causal conversion experiment and email-specific JPEG/PNG derivatives. The new `result_email` context provides observational funnel follow-through; image conversion is required only if controlled Outlook QA shows the optional WebP thumbnails create an unacceptable presentation.
