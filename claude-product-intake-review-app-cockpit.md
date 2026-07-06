I now have a complete picture. Let me compile the review.

---

# Code Review — `scripts/product-intake/review-app.ts`

**Scope:** New, untracked local review-app server for product-intake research packages (HTTP UI + file read/write helpers). Reviewed against its dependencies (`cli.ts`, `image-finalization.ts`, `prepare-research.ts`), its downstream consumer (`approve-package.ts`), and its test suite (`tests/product-intake-review-app.test.ts`).

**Overall:** Solid, well-tested for a dev tool. Path traversal is correctly guarded, the rejected-decision-doesn't-corrupt-disk invariant holds, and the happy paths are covered. Findings below are mostly **Low** severity, appropriate to a localhost-only single-reviewer tool. No high-severity correctness bug found.

---

## Findings (by severity)

### 1. Low–Med (Security / defense-in-depth): URL schemes are not validated before rendering into `href`/`src`

The client renders source links, candidate images, and reference images from URLs that originate in the research payload (LLM + web-research derived, plus user-supplied submission text):

- `review-app.ts:1047` `<a ... href="${escapeHtml(source.url)}">`
- `review-app.ts:1062` `<a href="${escapeHtml(asset.url)}">`
- `review-app.ts:1071` `<img src="${escapeHtml(candidate.url)}" ...>`
- `review-app.ts:1100` `<a class="source-pill" href="${escapeHtml(source.url)}">`

`escapeHtml` (`:1028`) escapes `& < > "`, which correctly prevents attribute breakout, but it does **not** restrict the URL scheme. A source URL of `javascript:…` would render as a clickable link that executes script in the page context when the reviewer clicks it. Because the page fetches package JSON and renders it client-side, this is effectively a stored-input → DOM sink.

Mitigating factors that keep this Low: server binds to `127.0.0.1` only (`:1279`), single trusted reviewer, content is mostly machine-generated, and exploitation requires a click. Recommendation: allowlist `http:`/`https:` (and `data:` only for images if needed) before emitting `href`/`src`, falling back to plain text otherwise.

Note `escapeHtml` also doesn't escape `'`, which is fine **only** because every attribute in the template uses double quotes — worth keeping in mind if any single-quoted attribute is added later.

### 2. Low (Logic / dead validation): patch-before-validate neutralizes the `public_url === final.product.image_url` check

In `saveImageFinalizationDecision` the payload is mutated *before* it is validated:

```
const payloadChanged = patchPayloadForDecision(payload, params.decision)  // :526 sets final.product.image_url = decision.public_url
validateFinalDecision(payload, params.decision)                           // :527 reads the just-patched value
```

`validateFinalDecision` (`:390`) passes `finalProductImageUrl: finalProductImageUrl(payload)` — i.e. the value `patchPayloadForDecision` just wrote. So the validator's guard `if (publicUrl !== imageUrl)` (`image-finalization.ts:94`) is tautologically satisfied and can never fire from this caller.

This is **not** a corruption bug — the app's job is to authoritatively set `image_url` from the approved decision, and it persists both files consistently, so `approve-package.ts`'s re-validation (`approve-package.ts:139`) passes on the consistent on-disk state. But it means: (a) that defensive cross-check is bypassed here, and (b) the "approved" test (`product-intake-review-app.test.ts:277`) does not actually exercise the URL-match branch. Consider validating the *decision* against the *pre-patch* payload, or documenting that this caller intentionally overwrites.

### 3. Low (Robustness): `approved_asset` on a draft-only payload silently fabricates a `final` block

`ensurePayloadProduct` (`:343`) and `ensurePayloadFieldRationales` (`:350`) create `payload.final = {}` / `final.product = {}` when absent. The `needs_image_work`/`pending` path is explicitly guarded against this (`patchPayloadForDecision` returns early, `:361`, and the test at `:345` asserts `payload.final === undefined`). But an `approved_asset` (or `no_image_approved_for_now`) decision on a package that only has a `draft` will inject `final.product.image_url` + a rationale into an otherwise draft-only payload, producing a half-formed `final` with no other researched fields. If image approval is only ever expected after research `final` exists this is benign, but there is no guard asserting that precondition.

### 4. Low (Atomicity): non-atomic dual write under `Promise.all`

`:530` writes `image-finalization.json` and `payload.json` concurrently via `Promise.all`. `writeFile` is not atomic, and `Promise.all` does not roll back: if one write fails after the other has begun/completed, the two files can drift (e.g. finalization says `approved_asset` but payload `image_url` wasn't updated). Low impact for a local tool, but a sequential write (payload first, then the marker) or a temp-file-rename would make the on-disk state recoverable.

---

## Test gaps (no failing tests; coverage holes worth noting)

The suite tests the exported helpers directly and is good, but the following are uncovered:

- **HTTP routing layer (`routeRequest`, `:560`) is entirely untested** — body validation (`Expected { packagePath, decision }`), the error→`400` mapping, the `404` branch, and the `/api/package` signed-URL refresh path. All UI correctness flows through this layer.
- **`withFreshSignedUploadUrls` error branch (`:665`)** — the `image_refresh_error` fallback (e.g. missing Supabase env) is never asserted.
- **`savePropertyReviewDecision` merge correctness (`:504`)** — the test saves a single decision; the "preserve previously-saved decisions for other paths" behavior of `decisions[path] = decision` over existing `review.decisions` is not exercised, so a regression that drops sibling decisions would pass.
- **Image candidate statuses** — only `needs_new_candidate` is tested (`:189`); `candidate_approved` and `comment` are not.

---

## Verified-correct (residual-risk callouts)

- **Path traversal is correctly guarded.** `resolvePackagePath` (`:106`) resolves to absolute then enforces containment with the `${root}${sep}` suffix check, which also correctly rejects sibling-prefix paths like `<root>-evil`. All four file-mutating/reading entry points route through it; `listReviewPackages` only reads from root. The `/etc/passwd` and `../` cases are blocked. Server is localhost-bound.
- **Rejected decisions don't corrupt disk.** Because validation throws before any `writeJson`, in-memory mutation from `patchPayloadForDecision` is discarded — confirmed by the test at `:387` asserting `payload.json` is byte-identical after a rejected approval.
- **Unknown / malformed decision statuses are rejected** by `validateFinalDecision` falling through to the validator's final `invalid(...)`.
- **Imports resolve** — `RESEARCH_PACKAGE_ROOT`/`IMAGE_FINALIZATION_FILE` exist in `prepare-research.ts` (`:14`, `:22`); `validateProductIntakeImageFinalization` is exported from `image-finalization.ts`.

No edits made.
