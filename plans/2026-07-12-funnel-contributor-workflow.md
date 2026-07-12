# Funnel Contributor Workflow

**Goal:** Let a non-engineering co-founder create coherent landing/offer funnel packages from a fork, preview them, and submit a bounded draft PR while Nick retains final production approval and tracking/payment integrity.

**Chosen direction:** Code-based funnel variants in the existing repository, contributed through fork PRs. Keep the shared quiz and sticky package attribution. Do not add random assignment or a CMS in this slice.

## Current State

- `src/lib/funnel/packages.ts` records `landingVariant` and `offerVariant`, but `/lp/[slug]` always renders `src/app/page.tsx`.
- Result pages always render `QuizResultOfferPage`; `offerVariant` is retained for reporting but does not select UI.
- Fork PRs receive no repository secrets. Deterministic CI runs with placeholders; live Supabase, AI, and provider-backed Clawpatch checks skip green.
- `main` requires four status checks but currently has no required PR review, stale-review dismissal, code-owner enforcement, or conversation-resolution rule.
- The repository is public and personal-account owned. A fork contributor needs no collaborator role and cannot merge upstream PRs.

## Constraints

- Preserve the shared quiz, signed sticky attribution, package-key semantics, Stripe/PayPal metadata, and existing analytics events.
- Package keys are immutable after traffic. Internal IDs and paths stay English; visible copy remains German.
- Fork PR workflows must remain on `pull_request`; never use `pull_request_target` or expose production secrets to fork code.
- Price tests and provider price/plan IDs remain engineering-owned.
- Keep `main` admin bypass available because Codex and Nick publish through the same GitHub account; outside contributors still cannot merge.
- Treat the contributor boundary as CI-enforced for fork PRs, not only documented. Legitimate shared-code changes are taken over into an owner branch.

## Non-goals

- No visual CMS or page builder.
- No random A/B traffic allocation.
- No Meta activation or new campaign creative.
- No production deploy, collaborator invitation, commit, push, or PR in this implementation run.

## Implementation

### 1. Make variant selection real

- Move package definitions to structured JSON under `src/funnels/` so the generator can update them safely.
- Keep `src/lib/funnel/packages.ts` as the typed and validated access boundary.
- Add statically generated landing and client-safe offer registries under `src/funnels/landing/` and `src/funnels/offers/`.
- Make `/lp/[slug]` own `LandingTracking` unconditionally, then resolve and render only the package's landing body. Contributor components cannot remove attribution bootstrap.
- Resolve the latest package linked to a lead on the server and pass only the serializable `offerVariant` ID into `ResultPageClient`.
- Make `ResultPageClient` construct the shared `ResultOfferPricing` checkout slot once and pass that slot into the selected client-safe offer component. Contributor offer variants may arrange approved content and the shared slot but do not copy or edit Stripe/PayPal wiring.
- Fail closed for unknown variant IDs instead of silently showing the default.

### 2. Add a deterministic funnel generator

- Add `scripts/funnels/new-package.mjs` and a package script:

  ```bash
  npm run funnel:new -- --key scalp_offer_b --slug scalp-offer-b --landing default --offer scalp-offer-b --channel meta
  ```

- Parse and rewrite JSON through `JSON.parse`/`JSON.stringify`; do not patch TypeScript with ad hoc text replacement.
- Reuse an existing landing or offer variant when its ID exists. Otherwise create a safe wrapper copied from the default experience and regenerate static imports.
- Reject duplicate package keys/slugs, invalid identifiers, missing arguments, and attempts to overwrite an existing variant.
- Default new packages to `placeholder`; the PR checklist requires an explicit final status decision before launch.
- Treat these as human-authored files:
  - `src/funnels/packages.json`
  - `src/funnels/landing/<variant>.tsx`
  - `src/funnels/offers/<variant>.tsx`
- Treat these as generator-owned files that contributors must not hand-edit:
  - `src/funnels/landing/registry.generated.ts`
  - `src/funnels/offers/registry.generated.ts`
- Add a check mode that regenerates in memory and fails CI when either registry is stale.

### 3. Bound the contributor workflow

- Add `.agents/skills/funnel-variant-creator/SKILL.md` for Claude Code/Codex with the allowed workflow, owned files, non-goals, and required checks.
- Add `docs/funnel-contributions.md` with fork, branch, generator, local preview, draft PR, Vercel authorization, review, and activation instructions.
- Add the named `.github/PULL_REQUEST_TEMPLATE/funnel.md` template so funnel PRs get the required hypothesis, package/slug, preview/screenshots, tracking/payment, command, and fork-live-check fields without cluttering unrelated engineering PRs.
- Add `.github/CODEOWNERS` assigning `@NickRuppy` as owner. The repository is small enough that whole-repo ownership is clearer than a partial list.
- Add an always-present `funnel-contributor-scope` CI job. For fork PRs it rejects changes outside `src/funnels/**`, `public/images/funnels/**`, and `docs/funnel-briefs/**`; owner branches remain unrestricted. Keep the check inline/base-owned enough that deleting contributor files cannot turn a failure into a pass.

### 4. Add regression coverage

- Extend package tests for structured validation, duplicate prevention, and unknown variants.
- Add renderer contract tests proving two packages can share one landing or one offer independently.
- Add generator tests in a temporary fixture proving create, reuse, duplicate rejection, and generated-registry stability.
- Add source-level governance tests for CODEOWNERS, PR template, no `pull_request_target`, and the documented fork-secret boundary.
- Run focused funnel tests, `npm run test:node`, and `npm run ci:verify`.

### 5. Apply GitHub governance separately

After the CODEOWNERS file is merged to `main`, update branch protection to:

- require one approving review;
- require code-owner review;
- dismiss stale approvals;
- require conversation resolution;
- retain strict required status checks and blocked force-push/deletion;
- retain admin bypass for the owner account;
- keep the existing four required CI contexts until security/Vercel contexts are proven stable on a real fork PR.
- add `funnel-contributor-scope` to required contexts only after its exact check name has completed successfully on the implementation PR.

Do not claim the code-owner rule is active before CODEOWNERS exists on the base branch. Vercel fork previews remain owner-authorized and must not receive production secrets.

## Verification

- A generated package selects its declared landing and offer components.
- Existing `default_organic` and `scalp_check_placeholder` behavior remains valid.
- Landing/offer tracking envelopes and payment metadata are unchanged.
- A fork PR can pass deterministic CI without repository secrets; skipped live checks are visible in the PR checklist.
- Unknown or drifted package/variant definitions fail tests/build rather than silently falling back.
- Claude plan review has no unresolved blocker before implementation continues.

## Stop Line

Stop after implementation, local verification, ready-check, and final code review. Do not stage, commit, push, open/merge a PR, deploy, change Vercel access, or change GitHub branch protection without a separate publication/settings handoff.
