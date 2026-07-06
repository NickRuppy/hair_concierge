Review complete. The file settled (mtime stable at 19:24:33). Here is the report.

---

# Code Review — `scripts/product-intake/review-app.ts`

## ⚠️ Review caveat (read first)

This file was **being actively rewritten during the review**. Concrete evidence:
- My first read returned an 859-line version with no `applySignedUploadUrls` and no “Standard-Entscheidung” copy; the on-disk file is now **942 lines** (mtime `19:24:33`, ~20 s before I checked).
- A first test run hit a **real failure** — `not ok 4 - review app explains broken images and final image metadata` (`/Standard-Entscheidung/` not found) — because I caught the file mid-edit.
- Running processes confirm a concurrent session: `tsx scripts/product-intake/review-app.ts --port=3908` (pid 34580, live server) and `tee … claude-product-intake-review-app-ux.md` (a UX review in flight).

**Current state:** the file has settled and `tests/product-intake-review-app.test.ts` passes **8/8**. Everything below is reviewed against the 942-line version. Re-verify before merging, since the artifact moved under me.

---

## Findings (by severity)

### 1. Medium — Non-final decisions silently inject an empty `final` block into draft payloads
`patchPayloadForDecision` calls `ensurePayloadProduct()` and `ensurePayloadFieldRationales()` **unconditionally, before** the status guards (`review-app.ts:251-252`). For a `needs_image_work` / `pending` decision neither branch runs, but those two `ensure*` calls have already mutated the payload:

```ts
function ensurePayloadProduct(payload) {
  if (!isRecord(payload.final)) payload.final = {}   // :237
  if (!isRecord(final.product)) final.product = {}   // :239
}
```

`prepare-research.ts:207-226` emits **draft-only** payloads (`{ draft: { product, … } }`, no `final`). The “Bildarbeit offen lassen” button (`needs_image_work`) is *designed* to be used on such incomplete packages (`:853-856`). When the reviewer clicks it, `saveImageFinalizationDecision` writes the mutated payload (`:365-371`), persisting a spurious `final: { product: {}, field_rationales: {} }` to `payload.json`.

Consequence: the empty `final.product` then **shadows `draft.product`** everywhere the code prefers final over draft:
- Detail render: `detail.payload?.final?.product || detail.payload?.draft?.product` (`:804`) → resolves to `{}`.
- `imageAssets()` candidate-image fallback (`:152-157` region) → `draft.product.image_url` becomes unreachable.

Visible impact is currently muted (brand/name fall through to `submission.*`, and the seeded draft product has no `image_url`), and `approve-package.ts` would reject the empty `final` downstream, so no bad approval. But it’s an unintended write to the review artifact and a latent shadowing bug. Recommend early-returning from `patchPayloadForDecision` for `pending`/`needs_image_work` (and skipping the `payload.json` write when nothing changed).

### 2. Low–Medium — No-image reason is hardcoded, dropping reviewer signal
The no-image save path hardcodes `reason: "not_needed_for_v1"` (`:921`) and the previous `<select id="no-image-reason">` is gone (grep: 0 occurrences). Every “Ohne Bild fortfahren” decision now records `not_needed_for_v1` in `image-finalization.json` regardless of the true reason (`no_exact_match`, `low_confidence`, `source_unclear`, …). Validation still passes (it’s a valid `NO_IMAGE_REASONS` value), so this isn’t a crash — but it erases audit signal that the schema explicitly supports (`image-finalization.ts:8-14`). Confirm this is intentional; if so it’s fine, otherwise restore the reason selector.

### 3. Low — Missing test coverage for the new/risky paths
`tests/product-intake-review-app.test.ts` covers approved + no-image saves and the happy refresh path, but not:
- **Non-final saves** (`needs_image_work` / `pending`) — exactly the path that triggers Finding #1. A test saving `needs_image_work` against a **draft-only** payload would catch the empty-`final` injection.
- **Validation-rejection** — e.g. `approved_asset` with a non-`product-images` `public_url` should `throw` (`validateFinalDecision` → `image-finalization.ts:91-103`); currently unverified.
- **Refresh failure** — `withFreshSignedUploadUrls` catch path setting `image_refresh_error` (`:466-471`) is untested (only the success path via `applySignedUploadUrls` is covered).

### 4. Low / Residual — Localhost-only security posture
The server binds `127.0.0.1` (`main`, end of file) and data is semi-trusted (reviewer-prepared packages), so these are low-risk, but worth noting:
- **`escapeHtml` does not sanitize URL schemes.** `source.url` and `product.image_url` are interpolated into `href` attributes (`:847`, `renderSources`); a `javascript:` URL stored in research data would survive escaping and execute on click. (`<img src>` is not exploitable this way.)
- **Content-type-agnostic body parsing → residual localhost CSRF.** `readRequestJson` parses the body as JSON regardless of `Content-Type` (`:386-393`), and the POST writes files (`:421-439`). A cross-origin `text/plain` `fetch` avoids the CORS preflight, so a malicious page could drive the write — but only if it can guess the victim’s absolute package path, which is impractical. Path traversal itself is correctly blocked by `resolvePackagePath` (prefix + `sep` check, `:73-80`), and writes stay within the research root.
- **Per-request client init.** `withFreshSignedUploadUrls` calls `createSupabaseClientFromEnv()` on every `GET /api/package` (`:455`), which re-runs `loadLocalEnv()` + `initProductIntakeScriptSentry()` each time (`cli.ts:82-96`) — minor overhead / repeated Sentry init.

---

## What’s solid
- Path traversal is correctly contained (`resolvePackagePath` uses `!== root && !startsWith(`${root}${sep}`)`, avoiding the `research-evil` prefix trap); all reads/writes stay inside the research root.
- `validateFinalDecision` runs **before** the `Promise.all` writes (`:366-371`), so a rejected decision leaves both files untouched (atomic-ish).
- `applySignedUploadUrls` is purely functional — it shallow-copies `submission`/`image_review` and rebuilds `image_assets` without mutating the input (`:200-234`).
- `image_refresh_error` is properly typed on `ReviewPackageDetail` (`:36`), so the catch-path return is type-clean.
- Refresh failures degrade gracefully (stale URLs + surfaced warning at `:807-808`) rather than 500-ing the detail view.

## Residual risk
Highest-confidence concrete bug is **Finding #1** (empty-`final` injection on non-final saves). Beyond that, the dominant risk is **instability of the artifact itself**: it changed during this review and the test suite was momentarily red. Re-run `tests/product-intake-review-app.test.ts` (and ideally `npm run ci:verify` for the typecheck on the new `applySignedUploadUrls`/`image_refresh_error` code) against the final committed state before merging.
