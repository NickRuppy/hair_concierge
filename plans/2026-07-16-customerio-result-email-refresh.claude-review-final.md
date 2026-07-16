I've grounded the plan's claims against the codebase. Here is the verdict report.

---

**Verdict:** Approve with revisions — two defects to fix before handoff, three tradeoffs needing an owner decision. This is the strongest of the three plan revisions; most of its codebase claims verified exactly, which is unusual and worth saying plainly.

## What I verified as correct

After two prior review rounds, the plan's grounding largely holds. Confirmed against code: all ten test paths in the verification block exist (`tests/customerio-quiz-result-template.test.ts` is correctly the one new file); `npm run ci:verify` exists (`package.json:20`) and `tsx --test` matches the repo's own `test:node` convention (`package.json:42`); `buildQuizOfferPreview` returns exactly three signals and exactly two non-suggested products (`src/lib/quiz/offer-preview.ts:241-267`); `OfferPreviewCadence` really is `{label, qualifier?}` (`src/lib/quiz/offer-preview-types.ts:21-24`), so the `cadence_label`/`cadence_qualifier` mapping is sound; the hero contract matches the offer page byte-for-byte (`src/funnels/offers/app-value-stack.tsx:33-34`); the `unlock-plan` anchor exists (`app-value-stack.tsx:79`); `packages.json` is exactly as described; and product images are absolute Supabase URLs and all `.webp`, so the WebP risk note is accurate and no relative-URL trap exists.

Two claims I want to positively confirm because they de-risk the plan: adding `result_email` to `OfferEntryContext` (`src/lib/analytics/events.ts:12`) is safe — there is no `Record<OfferEntryContext, …>` exhaustive map and no DB constraint; PostHog passes it through as a bare value (`src/lib/analytics/destinations/posthog.ts:20`). And the repo's HTML template is indeed a full `<!DOCTYPE html>` document carrying its own imprint/privacy footer, so the "fragment under layout 1, no second footer" instruction is grounded.

## Hard technical defects

**1. The mandatory legacy shim loses its only test guard — `plans/…refresh.md:240-249` vs `tests/quiz-result-artifact-email.test.ts:82-118`**

§2 says the first deploy **must retain** `rows`, `main_lever_*`, and `routine_levers`, because live template `40` still renders from them. §7 then instructs rewriting `tests/quiz-result-artifact-email.test.ts` to assert eight things — none of which cover those legacy fields. A subagent following §7 literally deletes the existing `assert.deepEqual(payload.messageData.rows, …)` and `routine_levers` assertions at lines 91-117. That removes the regression guard during exactly the window when every production email depends on those fields: drop them and the suite stays green while live mail renders blank. Fix: add one line to §7 stating the legacy-field assertions stay until the §9.10 cleanup, and that the cleanup commit removes both together.

**2. The signed-off mockup is not in the repository**

The plan's visual gate rests on `shared-core-email-mockup.html` (`plans/…refresh.md:8`), and the Handoff section mandates "a fresh implementation worktree based on the then-current `origin/main`". That file exists only at `/private/tmp/shared-core-email-mockup.html` and in Codex's visualization cache — not in git. The implementer will have no access to the approved design, and `/tmp` is ephemeral. This repo's convention is to commit these (`docs/mockups/product-card-drawer-revised-mockup.html`, `docs/mockups/paypal-offer-payment-mockup.html`). Fix: commit it to `docs/mockups/` and add it to the Target File Map.

## High-confidence issue

**The "stories live in one file" claim is wrong — `src/components/quiz/offer-product-story.tsx:1-26`**

Plan line 99 says the three capability stories are local constants inside `app-value-stack-proof.tsx`. There is a second, fully divergent copy using the *same three* `product_story_chat` / `product_story_routine` / `product_story_products` tracking IDs with different kicker/title/body, rendered by `quiz-result-offer-page.tsx:227` for the `default` offer variant. The plan names the right file, so extraction should still land correctly — but an implementer who greps the tracking IDs finds two candidates and has to guess. State which copy is canonical and that `offer-product-story.tsx` is intentionally left alone.

## Tradeoffs — owner decisions, not defects

**A. The email is offer-variant-blind. Decide: accept the one-time manual gate, or add a guard.**
`buildQuizResultArtifactEmailPayload` takes no funnel or variant input (`src/lib/customerio/quiz-result-artifact.ts:10-16`), so it always restates app-value-stack content. But `resolveOfferVariantForSession` returns the *stored session's* variant (`src/lib/funnel/packages.ts:80`), which can be `default` — rendering a materially different page (different stories, different CTA). The plan's mitigation (line 161) is a pre-activation traffic check on `scalp_check_placeholder`. That is a one-time human check with no test or runtime guard, so any future package with a non-app-value-stack variant silently reintroduces the mismatch. **Your call:** accept the manual gate as sufficient for a two-package world, or make the payload variant-aware.

**B. No success metric. Decide: accept this as a quality fix, or name the number.**
The plan is explicit and honest (line 53) that this is content-consistency, not an experiment, and that `entry_context=result_email` is observational only. That is a defensible position the prior review raised and this revision answered — but it means there is no defined outcome that would make this work "worked." **Your call:** ratify "no lift claim, quality fix only," or define what should move.

**C. The activation gate has no procedure.**
Line 161 stops activation unless you "verify that the placeholder package has no production quiz-completion traffic" — but names no query, table, or dashboard. A stop-gate without a method gets guessed or skipped. **Your call:** specify the source (Supabase funnel sessions vs. PostHog) or downgrade it to a judgment call you personally make.

## Smaller notes

- **Byte-identical preheader is under-specified.** §4 requires the `preheader_text` field and the hidden block to be "byte-identical," but the existing hidden block carries invisible padding entities (`&#8199;&#65279;` repeated) that exist for good inbox-preview reasons. Say the comparison is on visible text excluding padding, or the §7 test will fail or the padding gets stripped.
- **`ready-check` is a Codex phase, not a Claude Code skill** (`AGENTS.md:10-15`). If a Claude session executes this, CLAUDE.md mandates `branch-gate` before `executing-plans`, which the Handoff section omits.
- **Cosmetic drift is now locked in:** the `default` variant keeps its hardcoded "Vollständige Routine freischalten" (`quiz-result-offer-page.tsx:221`) while app-value-stack moves to "Mit Chaarlie starten" — consistent with the stated scope, but it compounds tradeoff A.
- `tests/result-offer-page.test.tsx:176` asserts exactly three `Routine freischalten` occurrences; §7 covers this, just don't miss the count.

## What I could not verify

Every live Customer.io claim — workspace `219516`, message `7`/template `40`, layout `1`, and the `PUT /v1/environments/{id}/templates/{id}` field shape — is external state I cannot reach: the Customer.io MCP servers are unauthenticated and this session is non-interactive, so I cannot run the OAuth flow. The `cio` CLI is installed (v0.0.5 at `/Users/nick/.local/bin/cio`), but I did not invoke it, per the read-only constraint. The plan handles this correctly by making the schema preflight a blocking first step (§6) and requiring a re-read before implementation — that mitigation is the right shape, and the §6 apply path genuinely must not be written until it runs.

## Bottom line

Fix the two defects — restore the legacy-field assertions in §7, and commit the mockup — and this is ready for handoff. Both are one-line-to-one-commit changes, not re-shapes. Then make an explicit call on tradeoff A (variant-blindness), because it is the only one where "decide later" quietly becomes "decide never": the plan's gate is a human check with no code behind it, and the failure mode is sending someone an email describing a page they won't see. Tradeoffs B and C are already argued honestly in the plan and just need your ratification.

Want me to spec the variant-aware guard for tradeoff A so you can compare it against the manual gate?
