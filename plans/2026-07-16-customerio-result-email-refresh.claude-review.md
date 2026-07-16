**Verdict:** Don't ship to subagents yet — two process gates unmet, five hard defects, and one unverified external claim that the whole HTML rewrite rests on.

---

## Lean shape

**Irreducible goal:** A quiz completer who closed the browser gets an email that restates their personalized offer and links back to the same page, and the repo — not the Customer.io UI — is where that content lives.

**Cut or defer:**

- **§6 sync script is the largest un-forced addition.** Dry-run mode, draft/active targets, `--confirm-active`, timestamped backups, byte-for-byte read-back, printed rollback commands, plus a §7 test asserting "the generated update request exactly matches the canonical files" — that is a deploy pipeline for one template that changes maybe twice a year, written against an API whose request shape the plan has not verified (see Prior art). The leaner shape that keeps the actual goal: a **read-only** `GET` + diff script (proves repo vs. live drift, which is the real problem the plan identified at plan:96) and paste-to-apply. That deletes the backup/confirm/rollback/read-back surface entirely and removes the risk of a half-correct mutation script touching a live transactional message.
- **§8's seven-client matrix + four fallback levels.** Defensible for a legal-ish transactional send, but it is hours of manual QA and the plan doesn't say so. Gmail + Apple Mail + images-off covers the large majority; Outlook desktop is the only one where the WebP risk (correctly flagged at plan:362) actually bites.
- **§4's "hidden preheader block if Customer.io preview testing proves both are necessary"** (plan:179) — an undecided branch handed to an implementer. Decide it or drop it.

**Kept, and correctly shaped:** the legacy-field superset in §2/§9 is a clean expand → deploy → contract, with the contract step explicitly scheduled (plan:148, plan:294). That is the right pattern and should survive any re-shape.

**Hard tradeoff the plan is avoiding:** it adds `entry=result_email` attribution but declares measurement out of scope (plan:364) — so after all this work, the plan has no stated way to answer "did the refreshed email do anything?" beyond directional delivery metrics. Forward-looking attribution exists; a baseline does not. Either accept that this is a quality/consistency fix with no success metric, or say what number is supposed to move.

---

## Prior art

- **Schema/contract migration (payload superset):** matches expand → backfill → contract. Invariants present: additive first deploy, template flip second, contract scheduled. **OK** — but see Blocker 5 on the fuzzy verb.
- **External-state deploy with rollback:** matches backup → apply → read-back → restore. Invariants present. Missing invariant: **no verification that the app deploy actually landed before the template flip** — §9.1 says "merge/deploy … first" but §9.2 only confirms the *old* email still renders. A read of the new fields in Customer.io test data is listed but not gated.
- **Customer.io template update endpoint: UNVERIFIED.** The plan specifies `editor=html`, `template_engine=1`, `body`, `body_plain` (plan:209) as if they were known. I could not confirm any of those field names, and public docs surface a different shape — `PUT /v1/transactional/{transactional_id}/content/{content_id}` — with no documented `body_plain`, `editor`, or `template_engine`. Customer.io's App API reference renders client-side, so I could not read the live spec here. This is not a nit: §6, §7's "generated update request exactly matches" test, and the whole §9 rollout are built on these field names.

Sources: [Customer.io App API Reference](https://docs.customer.io/integrations/api/app/), [Set up a transactional email](https://docs.customer.io/journeys/send/transactional/email/), [Transactional API examples](https://docs.customer.io/journeys/send/transactional/api-examples/)

---

## Blockers (will fail or regress as written)

**1. The verification command block fails on its first line — the test file doesn't exist.**
`plans/…refresh.md:326` runs `tests/result-artifact-service.test.ts`. There is no such file. The service is `src/lib/customerio/result-artifact-service.ts`, and its real coverage lives in `tests/quiz-result-artifact-route.test.ts` and `tests/quiz-result-artifact-trigger.test.ts`. `tsx --test` errors on a missing path, so nothing in that block runs. *Fix:* swap in the two real filenames.

**2. First-name sanitation is bypassed by the hero, and the plan's own tests contradict each other.**
`src/lib/customerio/quiz-result-artifact.ts:18-22` strips markup and caps at 60 chars; `src/lib/quiz/app-value-stack-copy.ts:39-41` does neither. Plan:121 says `hero = buildAppValueStackHeroCopy({ name, narrative, lane })` without saying *which* `name`. Pass the raw value and, for the existing fixture `<script>Lea</script> Danger` (`tests/quiz-result-artifact-email.test.ts:113-125`), `headline` becomes `<script>Lea</script>, dein 4-Wochen-Weg zu …` — raw markup in the payload, contradicting the plan's own constraint at plan:145. Meanwhile plan:226 demands "hero data equals `buildAppValueStackHeroCopy()` for the same input" and plan:232 demands "the existing first-name sanitation … remain." Both cannot hold. *Fix:* state that the sanitized first name is passed into the hero builder, and accept that email and web headlines diverge for names containing markup (React already escapes on the web, so this is a contract issue, not an XSS one).

**3. Deleting `.paste.html` doesn't resolve the reason it exists.**
`docs/customerio/quiz-result-artifact-template.html:1-31` is a 31-line HTML comment header; line 30 says explicitly *"quiz-result-artifact-template.paste.html holds the same body without this comment."* Plan:168 makes the documented file "the exact canonical fragment assigned to template `body`" and plan:182 deletes the paste file — so the doc header would now ship inside every email body, and the §7 byte-for-byte test would enshrine it. *Fix:* decide where the setup docs go (sibling `.md`, or accept the comment in the body) before declaring one canonical file.

**4. The layout-1 footer claim is unverified and legally load-bearing.**
Plan:180 instructs removal of the inner legal footer because "layout `1` supplies the outer document and the single unsubscribe/imprint/privacy footer." Nothing in the repo supports this — the current template carries its own Impressum/Datenschutz footer inline, and `docs/customerio/quiz-result-artifact-template.html:26` states the opposite intent: *"Do not include unsubscribe links; this is a requested transactional/service artifact."* If layout 1 does not in fact supply that footer, the refreshed email ships with no imprint (§5 DDG). The plan's rollout only exports the live template at step 4 (plan:288) — after the fragment is already authored. *Fix:* read layout 1's live body as **step zero**, before §4 is written.

**5. "May retain the legacy fields" is a fuzzy verb with a production consequence.**
Plan:148 says the first deploy *"may retain the existing legacy fields"*; plan:285 says *"keep the legacy payload keys."* An implementer following §2 alone can drop `rows` / `main_lever_*` / `routine_levers` — and since app deploy precedes the template flip by design, live template 40 would immediately render blank sections for every real send in that window. *Fix:* "must retain," stated once, in §2.

**6. Process gate: CLAUDE.md's user-facing planning gates are unmet.**
This is copy-heavy user-facing work. `CLAUDE.md` requires a reviewable mockup, confirmed mockup review recorded in the plan, and explicit user-journey sign-off before `executing-plans` or `subagent-driven-development` — and it names ASCII and prose as *not* counting, which is what plan:39-45 and the §"Email hierarchy" list are. The plan's render QA (§8) happens after implementation. Also `ready-check` (plan:350) is an `AGENTS.md` phase (Codex-side); no such skill exists for a Claude subagent, so that instruction resolves to nothing.

---

## High-confidence issues (correctness, not preference)

- **The sync script has no region and no credential.** `src/lib/customerio/transactional.ts:36` defaults to `https://api-eu.customer.io` because the workspace is EU (plan:6 confirms 219516). §6 never names the App API base URL or the env var for the token — a fresh `.mjs` defaulting to `api.customer.io` silently targets the wrong region. Name `CUSTOMERIO_APP_API_KEY` and the EU base explicitly.
- **The story IDs are typed, and the plan doesn't say so.** `src/components/quiz/app-value-stack-proof.tsx:6,14,22` uses `trackingId` values (`product_story_routine`, `product_story_chat`, `product_story_products`) that are members of `OfferSectionId` (`src/lib/analytics/events.ts:32-34`) and feed `data-offer-section` section-view tracking. Plan:107 says keep screenshots local "keyed by a stable story ID" without naming `trackingId` as that key or preserving the `OfferSectionId` link. An extraction that renames or widens it to `string` silently breaks offer-section analytics.
- **`focus=unlock-plan` reaches the anchor; `entry` resolution is as the plan describes.** Verified: `src/app/result/[leadId]/page.tsx:104-110` currently funnels the email link into `saved_result`, `#unlock-plan` exists at `src/funnels/offers/app-value-stack.tsx:79`, and `entry_context` lands in PostHog via `src/lib/analytics/destinations/posthog.ts:20`. No defect — the plan got this one right.
- **The "exactly two non-suggested products" constraint holds.** `src/lib/quiz/offer-preview.ts:245-254` only ever marks the optional extra as `suggested`, so `filter(p => !p.suggested)` is always shampoo + conditioner. Also verified: product `imageUrl`s are already absolute Supabase URLs (`src/lib/quiz/offer-preview-products.ts:12-63`), so no absolutization step is needed, and the WebP risk at plan:362 is real and correctly scoped.
- **CTA singleton claim verified.** `APP_VALUE_STACK_CTA_LABEL` has exactly the three call sites in `src/funnels/offers/app-value-stack.tsx:59,108,160` plus `src/app/labs/offer-page/page.tsx:39`, as plan:112-113 claims. Note `src/components/quiz/quiz-result-offer-page.tsx:221` hardcodes "Vollständige Routine freischalten" and will diverge; `tests/result-offer-page.test.tsx:176` asserts an exact count of 3 and will need updating (the plan does cover this).

---

## Tradeoffs — decisions the owner must make

| # | Decision | Why it can't be defaulted |
|---|---|---|
| 1 | **Build the §6 mutation script, or ship a read-only diff script + manual paste?** | Full tooling is a large share of the plan's effort, targets an unverified API, and mutates a live transactional message. Read-only diff solves the stated drift problem (plan:96) at a fraction of the surface. |
| 2 | **Does the email assume every recipient lands on `app-value-stack`?** | It doesn't today. `src/funnels/packages.json:16` maps `scalp_check_placeholder` → `default` variant, `resolveOfferVariantForSession` (`src/lib/funnel/packages.ts:77-86`) never checks `status`, `/lp/scalp-check` resolves it (`src/app/lp/[slug]/page.tsx:17`), and `funnel_sessions.offer_variant` can pin a lead there (`src/lib/funnel/server.ts:52,62`). Those leads get an email restating a page they'll never see. Options: gate the email on variant, accept the mismatch and say so, or retire the `default` variant. |
| 3 | **Does the transactional result email carry layout 1's unsubscribe footer?** | The current template says explicitly not to include one (`docs/customerio/quiz-result-artifact-template.html:26`); plan:180 embraces it. Both are defensible; they are opposite decisions and the plan doesn't acknowledge the reversal. |
| 4 | **Full seven-client matrix now, or Gmail + Apple Mail + images-off now and Outlook/GMX post-launch?** | §8 is hours of unbudgeted manual QA. |
| 5 | **Accept no before/after baseline?** | Plan:364 rules out a clean experiment and scopes out the analytics design. Fine — but it should be an acknowledged decision, not a footnote. |

---

## Smaller / nice-to-haves

- §7 asserts "no `customer.*`, hardcoded lead URL, discount, launch-special, screenshot, testimonial, price, or urgency copy remains" against the repo files — but the plan's own findings (plan:94-95) say that copy exists **only in live Customer.io**, not in the repo. The test will pass on day one and prove nothing about live. The read-back diff is what catches this; the test is decoration.
- Plan:31 says the return visit reaches the page "at `#unlock-plan`" while the builder uses `?focus=unlock-plan` (`src/lib/customerio/quiz-result-artifact.ts:26`). Different mechanisms; the query param is correct. Tighten the wording so nobody implements a fragment.
- Scripts in this repo are predominantly `.ts` run via `tsx`; `.mjs` is used for build/CI tooling. `.mjs` (plan:203) is defensible but off the dominant convention for API scripts.
- `npm run typecheck && lint && build` (plan:333-335) is exactly `npm run ci:verify`. Use the project's command.

---

## Bottom line

The plan's diagnosis is accurate and its structure is sound — the expand/contract payload shim, the "don't rebuild the URL in Liquid," the WebP risk, the CTA singleton, the two-product invariant, and the `saved_result` attribution gap all check out against the code. What it isn't yet is executable. Fix the six blockers (the dead test path, the sanitation contradiction, the canonical-file/comment-header collision, the unverified layout-1 footer, the "may retain" → "must retain," and the missing mockup/journey gates), verify the Customer.io template-update request shape before a single line of §6 is written, and make the five decisions above — particularly whether the mutation script needs to exist at all. Roughly a third of this plan is deploy tooling for one template; the goal survives without it.

Want me to spec the leaner counter-proposal — read-only drift diff plus manual paste, with the same payload refactor and attribution — so you can compare side by side?
