# Scan: dm-Enrichment bei unbekanntem Barcode — Implementierungsplan, Rev. 6 (2026-09-17)

## 1. Outcome and source context

Today roughly half of all scan attempts end in "Danke dir – das ist neu für uns!" (attempt log
2026-08-17 → 2026-09-13: 41 attempts, 18 unknown). A live probe of the official dm MCP server
(`https://mcp.dm.de/mcp`, tool `getProductDetails`, parameter `gtins`) resolved every dm-stocked
control barcode with name, brand, image URL, description and the full ingredient list in roughly
200 ms, and 3 of the 7 real user misses. The misses it cannot resolve are structural (Rossmann
private labels, superseded barcode generations, brands dm does not stock).

Source context: brainstorm session 2026-09-16, probe report `dm MCP as a barcode resolver —
16 September 2026`. The probe's raw responses are committed as fixtures under
`plans/scan-dm-enrichment/evidence/dm-probe/` (`results.json`, `inventory.json`, `probe.mjs`) so T1
does not depend on any session scratchpad.

**Outcome:** when a scanned barcode is missing from our catalog but known to dm, the user sees the
real product (image, name, brand) on the unknown sheet instead of a bare barcode, confirms the
suggested category with one tap where the dm name makes it unambiguous, and the intake submission
carries dm's identity, ingredient text and image URL as a provenance-tagged draft, so the operator
confirms instead of researching from scratch.

**Constraints:** no verdict is produced from dm data (no provisional verdict in this slice); no dm
data is written to `products` or any catalog table; the existing operator review and guarded publish
stay the only path into the catalog; dm data is accepted only when the returned GTIN equals the
scanned GTIN after canonicalisation; dm being slow or down never breaks a scan (fail-open to today's
behaviour); our server sends dm nothing but the GTIN; the dm product image is never loaded by the
user's browser directly from dm (see §4, image privacy). A lookup alone is not an intake
submission: only the user's category confirmation creates a `product_submissions` row. Resolve-side
and submit-side lookup outcomes are measured server-side without putting barcode, product identity,
ingredients, or user ID in PostHog.

**Non-goals:** provisional/"Vorläufig" verdicts (parked, needs Nick's ruling); Rossmann automation
(no sanctioned interface); automatic property derivation from ingredients; changes to the verdict
sheet, the shelf/session concepts, the pending sheet, or the catalog schema; caching dm responses
across requests; enrichment for quarantined catalog products (true misses only).

**Done when:** on `/scan` in a verified environment with the flag on and a real dm call, manual EAN
entry of `4001638530378` shows the identified Weleda product with "Benutzt du es als Shampoo?",
tapping "Ja, als Shampoo" creates a `product_submissions` row whose `intake_history` carries the
`retailer_enrichment` entry and whose `brand_text` / `product_name_text` are prefilled; a worker
packet built for that submission contains the enrichment section; the automated commands in §9 pass;
a dm timeout, a 404 session expiry, a malformed response and the flag being off each yield today's
plain unknown sheet; lookup outcomes, duration and user-journey events are verifiably recorded under
the contracts in §4. A controlled production smoke creates one QA-account test submission. If its
acceptance and safety checks pass, the flag may remain on for a monitored public trial; a failed
smoke or breached guardrail turns it off. No product is published as part of this test.

## 2. Chosen direction

On a true catalog miss (identifier lookup missed, not quarantined, no open submission) the resolve
route asks dm for the exact GTIN under a configurable absolute deadline (initially 1.5 s,
to be calibrated before the smoke). A hit is attached to the existing
`unknown_product` result as `identified` (name, brand, proxied image URL, dan, suggested category) and
rendered as a product row on the unknown sheet with the identified copy; when the dm name maps to
exactly one category the sheet asks for a one-tap confirmation, otherwise it shows today's grid. The
submit route re-fetches the enrichment server-side by GTIN, runs catalog matching on the original
scan input only, and, once matching has fallen through, prefills `brand_text` / `product_name_text`
from dm and appends the full enrichment as a provenance-tagged `intake_history` entry. This reuses
the single `product_submissions` staging table (also used by other intake sources), the existing
research queue, and the guarded approval path into `products`; it does not create a dm-only product
table. A separate, additive telemetry migration is required for reliable outcome/latency
measurement and retention.
The Codex research worker loads that entry into a dedicated packet section. Everything sits behind
`SCAN_RETAILER_ENRICHMENT_ENABLED=true`. The MCP transport is the official
`@modelcontextprotocol/sdk` Streamable HTTP client, instantiated per enrichment operation; only the
TOON table parser is ours.

## 3. Scope and non-goals

Changes: `src/lib/scan/enrichment/*` (new), `src/lib/scan/types.ts`, `src/lib/scan/verdict-labels.ts`,
`src/lib/observability/scan.ts` (rate-limited warning helper), `src/app/api/scan/resolve/route.ts`,
`src/app/api/scan/submit/route.ts`, `src/lib/product-intake/submissions.ts`,
`src/components/scan/scan-unknown-flow.tsx`, `src/components/scan/scan-product-thumb.tsx` (proxied
image variant), `next.config.*` (image remote pattern for `products.dm-static.com`),
`src/lib/scan/scan-analytics.ts`, `src/lib/analytics/events.ts`,
`src/lib/analytics/destinations/posthog.ts` (+ emitters in `scan-flow.tsx`),
`src/lib/scan/resolve-event-log.ts`, a new additive migration for
`scan_resolve_events` and submit-side lookup telemetry with a 30-day raw / 12-month aggregate
retention path, `docs/scan-attempt-log.md`,
`scripts/product-intake/codex-research-worker.ts`, `docs/product-intake-research-ops.md`,
`docs/local-qa-access.md`, `package.json` (new dependency `@modelcontextprotocol/sdk`).

Must remain unchanged: catalog tables, `product_identifiers`, the verdict core, the pending sheet,
rate limits, the eligibility and quarantine gates, R8 (no invented usage
data), R9 (ean-only client contract), `packages/product-intake-core` (the worker loads
`intake_history` through its own existing direct query, see T6).

## 4. Target map (exact interfaces)

Shared exact values (authoritative, referenced by tasks):

```ts
// src/lib/scan/enrichment/types.ts
export type RetailerEnrichment = {
  source: "dm"
  fetchedAt: string                // ISO
  gtin: string                     // canonicalizeGtin(scanned) — 14-digit string; equality with the dm row is on this
  dan: string                      // dm product number, 7 digits
  productName: string
  brand: string | null             // raw dm value ("WELEDA"); display title-casing happens in the UI only
  imageUrl: string | null          // raw dm CDN URL; server-side/operator use, proxied for the client (see below)
  productUrl: string | null
  ingredientsText: string | null   // dm field nonFoodIngredients, verbatim
  description: string | null
  keyBenefits: string | null
  suggestedCategory: PersonalPlanCategory | null   // suggestCategoryFromRetailerName(productName), recomputed on submit
}

// client-facing subset on ScanUnknownProductResult (src/lib/scan/types.ts) — EXACT key set, nothing else
identified?: {
  source: "dm"
  dan: string
  productName: string
  brand: string | null
  imageUrl: string | null          // same raw URL; rendered ONLY through next/image (proxy), never a bare <img>
  suggestedCategory: PersonalPlanCategory | null
}

// src/lib/scan/enrichment/suggest-category.ts — deterministic keyword map on the dm productName,
// word-boundary + case-insensitive; returns a category only when exactly one distinct category matches.
//   shampoo:          Shampoo (excluded when Trockenshampoo / Tiefenreinigung / Peeling / Detox / 2in1 / "&" combos match)
//   conditioner:      Conditioner, Spülung, Balsam
//   mask:             Maske, Kur, Haarkur, Treatment
//   leave_in:         Leave-in, Leave in, Sprühkur, Sprühpflege
//   oil:              Öl, Oil, Haaröl
//   heat_protectant:  Hitzeschutz, Heat Protect
//   dry shampoo key:  Trockenshampoo, Dry Shampoo
//   deep-cleansing key: Tiefenreinigung, Clarifying, Detox
//   scalp_care:       Kopfhaut-Serum, Kopfhaut-Peeling, Scalp
//   Tönung / Color / Farbe → null (W2)

// intake_history entry appended by submitScanProductIntake (src/lib/product-intake/submissions.ts)
{ at: string; source: "retailer_enrichment"; retailer: "dm"; enrichment: RetailerEnrichment }

// env flag (src/lib/scan/enrichment/flag.ts, same style as entitlements/flag.ts)
SCAN_RETAILER_ENRICHMENT_ENABLED === "true"
// configurable server-side cap; initial 1500 ms is a safety hypothesis, not the launch target
SCAN_RETAILER_ENRICHMENT_TIMEOUT_MS = 1500
// parse as a finite integer in [1, 10000] ms; invalid values use the safe 1500 ms default
// ONE wall-clock deadline per operation: connect + initialize + initialized notification + call + retry

// src/lib/scan/enrichment/resolve-enrichment.ts — returned for every eligible lookup,
// including disabled/failed calls; the caller persists the result independently of consent
type RetailerLookupOutcome =
  | "disabled" | "hit" | "not_found" | "timeout" | "session_expired"
  | "transport" | "malformed" | "gtin_mismatch" | "unexpected" | "invalid_gtin"
type RetailerLookupResult = {
  enrichment: RetailerEnrichment | null
  outcome: RetailerLookupOutcome
  durationMs: number | null             // total elapsed wall time; null if no outbound call
  deadlineMs: number | null             // actual cap used; null if no outbound call
}

// observability (src/lib/observability/scan.ts): low-cardinality, rate-limited
// standalone Sentry warning for unexpected/transport/malformed/GTIN-mismatch/session-expired
// failures; normal not_found and timeout stay in server telemetry, not Sentry alerts.
// A breadcrumb may supplement the warning but is not by itself a reported Sentry event.
// Use fixed message and low-cardinality reason; never attach raw exception (which may
// embed request URLs), GTIN, user ID, name, raw response, ingredient text or product URL.

// consented PostHog only (events.ts + posthog.ts + scan-flow.tsx; no identifiers/product text)
scan_not_found: {
  identified: boolean
  suggestedCategory: PersonalPlanCategory | null
  scanInteractionId: string             // fresh random ID for this sheet, no barcode/user encoding
  msToUnknownSheetReady: number         // request start to result dispatch, including camera confirmation delay
}
scan_submission_created: {
  category: PersonalPlanCategory
  suggestedCategory: PersonalPlanCategory | null
  selectionPath: "one_tap" | "grid"
  scanInteractionId: string             // same ID; success means pending response, not necessarily a new insert
  msConfirmationToPending: number       // category tap to successful pending response
}

// server-only telemetry: new additive migration, not a product-submission/catalog migration
// scan_resolve_events gains dm_lookup_outcome/duration_ms/deadline_ms, set on every
// eligible true miss after the open-submission check (disabled included; null otherwise).
// scan_submit_dm_lookup_events: one row per eligible submit-side lookup, route implied,
// outcome/duration/deadline/timestamp only; no user ID, GTIN, product or submission ID.
// scan_dm_lookup_daily_aggregates: day + route + outcome + deadline + duration bucket
// with count and duration sum; private retention aggregates both raw sources before
// deleting them after 30 UTC days, drops daily aggregates after 12 months.

// copy (src/lib/scan/verdict-labels.ts) — FINAL per Nick's rulings 2026-09-16
SCAN_UNKNOWN_IDENTIFIED_HEADLINE = "Gefunden – jetzt prüfen wir es."
SCAN_UNKNOWN_IDENTIFIED_SUBLINE  = "Passt es zu deinem Haar? Das Ergebnis kommt in den Chat."
SCAN_UNKNOWN_CONFIRM_QUESTION    = (label) => `Benutzt du es als ${label}?`   // article-free for all ten category labels
SCAN_UNKNOWN_CONFIRM_CTA         = (label) => `Ja, als ${label}`
SCAN_UNKNOWN_CONFIRM_OTHER       = "Wofür anderes"                          // reveals today's grid in place
// variant B (no suggestion): same identified row/headline/subline + SCAN_UNKNOWN_QUESTION
// "Wobei benutzt du es?" + today's grid; pending sheet unchanged.
// Layout constraint (Nick): variant A fits the half-height sheet without scrolling at 375×812.
// Brand display: title-case when dm returns the brand fully upper-cased ("WELEDA" → "Weleda").

// image proxy contract (next.config.ts `images.remotePatterns`, alongside the existing tophair/filesafe entries)
{ protocol: "https", hostname: "products.dm-static.com", pathname: "/images/**" }
// - exact host, https only, pathname-restricted, no wildcard host (Next.js guidance: an over-broad pattern turns the
//   optimizer into an open image proxy / SSRF primitive that third parties can use to run up the Vercel bill)
// - validate each dm image URL before putting it in `identified`: exact scheme/host/path,
//   no credentials or nonstandard port; invalid URL => imageUrl null and safe placeholder.
// - Next follows up to three redirects by default; set images.maximumRedirects: 0,
//   and regression-check all existing optimized remote-image consumers (Next image docs:
//   https://nextjs.org/docs/app/api-reference/components/image#maximumredirects).
//   Confirm config parsing in the pinned Next 16 installation before treating this as enforced.
//   The initial allowlist alone is not a complete redirect guarantee.
// - CSP img-src remains same-origin for this image: do not add the dm host to img-src.
// - ScanProductThumb `proxied` variant: next/image with width={size} height={size}, quality default, no `unoptimized`;
//   the browser then requests /_next/image?url=…&w=96 — dm sees only the Vercel optimizer, never the user
// - Vercel bills image optimization per transformation; count unique source/width/quality variants
//   in real QA rather than asserting negligible cost from a speculative traffic estimate.
// - dm's URL already carries its own h_320,w_320 transform; we pass it through unchanged as the source
```

dm wire facts (probe, verified): JSON-RPC 2.0 over Streamable HTTP at `https://mcp.dm.de/mcp`;
`initialize` (protocolVersion `2025-06-18`) returns `mcp-session-id`; responses arrive as SSE or JSON;
`tools/call` `getProductDetails` `{ gtins: number[] }` returns `result.content[0].text` as a JSON
string `{ instruction, result }` whose `result` is a TOON table
`[N]{dan|gtin|productName|brand|found|errorMessage|productUrl|image|…|nonFoodIngredients|…}:` with one
`|`-separated row per requested GTIN (`found=false` + `Product not found` for unknown codes; string
values may be double-quoted). The 27-column header order is in the committed fixture. The SDK client
handles `notifications/initialized`, the `MCP-Protocol-Version` header, SSE framing and JSON-RPC id
correlation; we handle session expiry (404 → one re-initialise + retry inside the same deadline).
The SDK is not yet installed in this worktree: verify the pinned version's transport hooks and
initialization/notification lifecycle with T2's fake-fetch tests during implementation, and
adapt the injection boundary if its actual API differs. The hard deadline is the invariant.

Measurement decisions (no numeric success target until measured):
- **Primary coverage:** exact dm hits / eligible true catalog misses with the feature enabled,
  from server-side outcomes. Exclude pending-submission, quarantined, invalid and disabled
  attempts from that denominator; report their counts separately. Also report ordinary dm
  not-found, timeout and unexpected failure shares. Missing dm outcome on an eligible
  completed resolve row is a telemetry defect, not a dm not-found.
- **Experience:** among analytics-consenting users only, distinct
  `scanInteractionId` values with `scan_submission_created` / those with
  `scan_not_found`, split by identified/suggested variant. This means successful
  category-confirmation-to-pending response, not unique database inserts or research
  completion. Diagnostic: one-tap acceptance and category override when the submitted
  category differs from the suggestion. An accepted suggestion is not proof of correctness.
- **Latency/guardrails:** total dm operation duration (connect through close/retry),
  p50/p95 and timeout share by route and configured cap over raw 30-day events; after
  retention, use the 12-month histogram as an approximate distribution, not an exact p95.
  Compare consented client request-to-unknown-sheet-ready time with a same-build flag-off baseline;
  this includes the intentional camera confirmation delay and is not a paint timing. Compare
  confirmation-tap-to-pending time, submission success/failure, two-call cost and image-optimizer
  transformations against the same-build flag-off behavior. Consent bias applies
  to PostHog, not the service-role server denominator.
- **Operator quality:** on the first reviewed dm-assisted submissions, compare dm brand/name,
  category suggestion, ingredient text and image candidate with the independently
  researched/reviewed fields and existing review-decision records. Record corrections
  and source conflicts in the normal intake workflow; do not automatically promote dm
  text or treat user acceptance as a quality label. No additional dm-only intake table
  or automatic catalog writer is justified now.

## 5. Decision coverage

Decision coverage: **confirmed for implementation and a monitored public trial after smoke** (Rev. 6).

Confirmed with Nick (2026-09-16): build this slice first — dm lookup on catalog miss, identified
product on the unknown sheet, prefilled intake draft, no provisional verdict, no Rossmann automation;
the five-step flow; dm data stored only inside the intake submission with provenance, not in the
catalog, until dm confirms reuse terms; the generation-mismatch rule (no ingredient list from a
different GTIN is ever linked to a scanned code); prefill the category from the dm name and confirm
with one tap (variant A) when sure, today's grid (variant B) when not, A must fit the half-height
sheet; headline framing "we found it, but we still need to check it" (exact wording delegated: "just
a better copy is needed"); the confirmation asks what the product is USED as ("Benutzt du es als
Shampoo?"). Defaults accepted without objection: brand title-casing, 24-hour promise unchanged.
Image privacy (Codex V4): Nick chose option 1, proxy dm images through the Next image optimizer
("Option one sounds like the best practice"), verified against Next.js and Vercel guidance (§4 image
proxy contract). Nick, 2026-09-17, confirmed that a category tap ("Ja, als Shampoo" or a grid
card), not merely viewing the dm-assisted sheet, creates the submission; dm-assisted unknowns
reuse the shared `product_submissions` staging table and the existing guarded review path. He
approved fuller measurement for later refinement; the 1.5 s cap is provisional and the real cap
is chosen from measured total lookup times/timeout and hit tradeoffs after implementation. He
approved a real production QA submission rather than isolated-only QA. On 2026-09-17 he revised
the rollout: after a successful smoke the flag may stay on publicly for a monitored trial; if it
works well he may choose to leave it enabled. He will discuss ongoing dm data/image reuse with
dm via an influencer contact; trial approval is not a conclusion about those terms or approval to
publish a product.

Inherited from evidence or contract: exact canonical-GTIN acceptance (probe: same DAN, different
GTIN, different formulation; `canonicalizeGtin` is what `identifier-lookup.ts` already uses); EAN
2-source rule W5 (`docs/scan-db-expansion-playbook.md`: dm counts as the single retailer source only
for dm-exclusive brands); guarded publish only via Nick's explicit handoff
(`docs/product-intake-research-ops.md` Core Rule); R7 quarantined products are not resolvable via
scan (so no enrichment for them either); R8 no invented usage data; R9 ean-only client contract;
resolve/submit rate limits unchanged; dm's instruction not to send personal data (only the GTIN
leaves our server); MCP 2025-06-18 lifecycle and transport requirements (official SDK client).

Implementation defaults: `@modelcontextprotocol/sdk` Streamable HTTP client created per operation
(no module-level session state); enforce an outer absolute deadline covering the SDK notification
and cleanup, not only a signal passed to `connect`/`callTool`; dm draft stored in `intake_history`
without a product-submission schema change; additive telemetry migration and retention update;
consented `scan_not_found` / `scan_submission_created` properties with an ephemeral interaction ID;
submit re-fetches server-side
instead of trusting client identity; matching runs on the original scan input, dm identity is
applied only after matching falls through (Codex V2); server log for every eligible lookup outcome,
standalone rate-limited Sentry warning only for unexpected failures (a breadcrumb alone is
insufficient); `suggestedCategory` lives on `RetailerEnrichment` and is recomputed on submit (V8);
enrichment guarded to true misses (V11); worker loads `intake_history` via its existing direct
submission query, with a pure parser for tests (V6); validated image URL and worker GTIN;
flag name `SCAN_RETAILER_ENRICHMENT_ENABLED`.

Explicit scope/latency tradeoffs for this handoff: retain both resolve and submit lookup
measurement plus the private 12-month aggregate. Nick asked to collect enough data for later
refinement; a one-row smoke is not a representative cap or quality sample, and the durable
pipeline supports the monitored public trial. Both resolve and category-confirmation submit
use the same measured, configurable cap initially; the second call is on the critical path, so
the tap may wait up to that cap before the pending sheet. Calibrate both routes and the
tap-to-pending experience; if a shared cap proves unsuitable, a separate submit cap is a later
measured change, not an assumed launch default.

Open consequential assumptions (all `parked out of scope`, none affect implementation/smoke):
- **dm terms for ongoing public/commercial display and storage** — `parked out of scope` for
  implementation. Nick explicitly accepts a temporary public trial while seeking clarification
  via the influencer contact; do not treat the official MCP page or the trial as a legal
  conclusion about image/persistent reuse. Revisit this before deciding to leave the feature
  enabled indefinitely.
- **Public-trial checkpoint and duration** — `resolve before production activation`, not before
  implementation: name the operator and review date or observation threshold, plus the
  rollback owner. The implementation stays default-off with an immediate flag-off path.
- **"Vorläufig" provisional verdict** — `parked out of scope`; separate future slice.

Undiscussed consequential assumptions affecting this handoff: none; the telemetry and
confirm-tap latency tradeoffs above are explicit implementation choices under Nick's measurement
and bounded-test direction, not evidence of an optimal numeric cap.

Coverage acknowledgement: Nick, 2026-09-16: "Yeah, I think that sounds like a good flow. In step
two, we just need to line up a bit on what the copy and the framing towards the user are, but it's
okay. Let's make a plan to build that slice." Later the same day: category prefill with confirmation;
the three copy/interaction rulings; "Don't start yet. Just finalize the plan." Nick, 2026-09-17:
"we need to be tracking this correctly" for later refinement; "build this and then realistically
measure" the appropriate timeout; "If DM fails we still have our fallback existing unknown product
sheet. We trust the data"; "let's base it on this confirmation action"; approved production testing
and a temporary flag-on/flag-off window; "ok finalize the plan then pls". Nick then revised the
rollout on 2026-09-17: "we can keep it on and public also for a while, do some testing. If it works
well we can perhaps even leave it online right away" and authorized implementation with
sub-agents.

Internal revalidation: Rev. 6 changes only the release/measurement horizon from Rev. 5. It
reconciles Nick's later rulings with the existing
`product_submissions`/research-job/catalog boundary, current analytics event type/mapper, scan
attempt retention, SDK lifecycle, and production QA access; §11 records the review findings.
Earlier Rev. 4 = Rev. 3 + image-privacy ruling; Rev. 3 incorporated copy rulings and Codex
review V1–V12/S1–S2. On 2026-09-17, implementation and a read-only pre-release benchmark
were rechecked against those decisions in worktree `codex/scan-dm-enrichment` (base e7b93c67).
No new consequential implementation choice emerged. The public-trial checkpoint/rollback owner
remains a separate activation decision, and migration-first deployment remains mandatory.

## 6. Designed user journey

Actor: signed-in member with scan access, on `/scan`, flag on.

1. Scans (or types) a barcode not in our catalog. Resolving state as today ("Produkt wird geprüft …").
2. **dm knows the exact GTIN:** unknown sheet opens with a product row (proxied dm image, product
   name, title-cased brand), headline "Gefunden – jetzt prüfen wir es.", subline "Passt es zu deinem
   Haar? Das Ergebnis kommt in den Chat.", barcode line as today. Then:
   - **2a, category suggested** (name maps to exactly one category): question "Benutzt du es als
     Shampoo?", primary button "Ja, als Shampoo", secondary "Wofür anderes" which reveals today's grid
     in place (without the suggested card). Fits the half-height sheet without scrolling.
   - **2b, no suggestion:** question "Wobei benutzt du es?" and the category grid exactly as today.
3. Taps "Ja, als …" or a category card → submitting state on that control while the server
   performs a second dm lookup (bounded by the configured cap, then fail-open) → pending sheet as
   today ("Eingereicht!", "Meist innerhalb von 24 Stunden – wir melden uns im Chat.") →
   "Weiter scannen". The submitted category is always the user's confirmed choice; the suggestion is
   stored on the enrichment entry for later accuracy checks. Measure tap-to-pending time; this
   tap is the only creation trigger for the `product_submissions` row; viewing/closing the sheet or opening "Wofür anderes" creates
   no submission. Server-side resolve attempts are still measured independently.
4. **dm does not know it / dm slow / session expired / malformed / flag off / quarantined catalog
   product:** unknown sheet exactly as today. No error is shown for an enrichment failure.
5. Re-scan of the same code while the submission is open: pending sheet as today.

Operator side: the submission appears in the research queue with `brand_text` / `product_name_text`
prefilled from dm, and the worker packet carries a `retailer_enrichment` section (identity candidate,
verbatim ingredient text with dm product URL as source, image URL as image candidate, suggested
category). Review, image finalization and guarded publish are unchanged. If exact matching during
submit discovers an already-catalogued eligible product, link/use that product rather than insert
a duplicate submission. A dm failure still allows the original plain-sheet category submission.

## 7. Planning evidence

`plans/scan-dm-enrichment/evidence/unknown-identified.html` (rendered HTML; no PNG is currently
retained): today's sheet, variant A
(category recognised, one confirmation), variant B (dm knows it, category unclear, grid). Questions
answered: does the identified variant read as "found, not yet judged" without implying a verdict;
is one-button confirmation clearer than a pre-highlighted grid. Status: **approved by Nick
2026-09-16** (A when sure, B when not; final copy per §4 rendered). Operator-side change: no
user-facing evidence required (internal contract, no surface/copy/timing change).

## 8. Ordered tasks

**T1 — TOON parser + committed dm fixtures.** Commit the probe artefacts under
`plans/scan-dm-enrichment/evidence/dm-probe/` and extract `tests/fixtures/dm-mcp/details-all-gtins.txt`
(the TOON `result` string) and `tests/fixtures/dm-mcp/tools-list.json`. `src/lib/scan/enrichment/toon.ts`:
`parseToonTable(text: string): Array<Record<string, string>>` handling the `[N]{a|b|c}:` header,
`|`-separated rows, double-quoted values containing `|`, empty cells, CRLF, escaped quotes; a row with
the wrong width throws `ToonParseError`. Tests `tests/scan-dm-toon.test.ts`: parses 10 rows,
`found` true/false, Balea row fields, quoted URL with `?`/`&` intact, ingredient text verbatim,
CRLF input, wrong-width row throws. Produces: `parseToonTable`, `ToonParseError`. Done when tests
green via `npm run test:node -- tests/scan-dm-toon.test.ts` (or the equivalent shim invocation).

**T2 — dm MCP client on the official SDK.** Add `@modelcontextprotocol/sdk` (pinned).
`src/lib/scan/enrichment/dm-mcp-client.ts`: `createDmMcpClient(deps: { endpoint?: string;
fetch?: typeof fetch; deadlineMs: number; now?: () => number }) => { getProductDetails(gtins:
string[]): Promise<DmProductDetailsRow[]> }`. Per call: new `Client` + `StreamableHTTPClientTransport`
(fetch injected for tests), `connect` (initialize + initialized notification handled by the SDK),
`callTool getProductDetails` with `gtins` as numbers, parse `content[0].text` → JSON `{ result }` →
`parseToonTable`, close. Enforce one absolute monotonic wall-clock deadline with an outer timeout
around the entire operation and best-effort abort/transport close on expiry; passing one
`AbortSignal` only to SDK `connect` and `callTool` is insufficient because `connect` also sends
`notifications/initialized` outside those request options. A 404 (expired session) permits exactly
one re-connect + retry inside the same remaining budget; never reset the timer. Every failure throws
`DmMcpError` with `reason` ∈ timeout | session_expired | transport | malformed. Consumes T1. Tests
`tests/scan-dm-mcp-client.test.ts` with a fake fetch replaying fixture bodies: happy path (SSE and
JSON framings), 404 → one retry then success, 404 twice → session_expired, cumulative delay
exceeding the deadline across connect + notification + call → timeout, a stalled initialized
notification must settle by the hard deadline with no late result/resource leak, malformed TOON →
malformed, two concurrent operations do not share state. Done when tests green.

**T3 — Enrichment resolver + category suggestion.** `src/lib/scan/enrichment/resolve-enrichment.ts`:
`resolveRetailerEnrichment(scannedValue: string, deps: { client; flag: () => boolean; now: () =>
string; reportUnexpected; route: "resolve" | "submit" }): Promise<RetailerLookupResult>`.
Rules: flag off → `disabled` without a call; `canonicalizeGtin(scannedValue)` (null →
`invalid_gtin` without a call);
accept only `found === "true"` **and** `canonicalizeGtin(row.gtin) === canonical scanned`; map fields
per §4 (empty → null); compute `suggestedCategory` and validate the optional image URL. Every
eligible call returns an outcome plus measured total duration and actual deadline; catch even
unexpected exceptions and return the plain-sheet result. Standalone, rate-limited Sentry warning
only for unexpected/transport/malformed/GTIN-mismatch/session-expired failures; no identifiers or
payload in the warning. `src/lib/scan/enrichment/suggest-category.ts`:
`suggestCategoryFromRetailerName(name: string): PersonalPlanCategory | null` per §4, test-first.
Consumes T2. Tests `tests/scan-dm-enrichment.test.ts`: hit; `found=false` → `not_found` with no
Sentry; row GTIN differs → `gtin_mismatch` + one warning; EAN-13 vs GTIN-14 spellings of the same
code match; EAN-8 canonicalises; invalid check digit → `invalid_gtin` without a call; timeout →
plain result and no Sentry; malformed/transport/unexpected errors → plain result and rate-limited
warning; invalid/unconfigured image URL → null image, not a broken sheet; flag off → `disabled`
and no fetch; invalid timeout env values use the safe default. `tests/scan-dm-suggest-category.test.ts`:
every dm name in the fixture, the nine explicitly mapped category keys, and bondbuilder → null;
negatives ("Trockenshampoo" → dry-shampoo key, "Shampoo
& Spülung 2in1" → null, "Tönung" → null). Done when tests green.

**T3b — durable measurement contract + additive migration.** Add nullable
`dm_lookup_outcome`, `dm_lookup_duration_ms`, `dm_lookup_deadline_ms` to
`scan_resolve_events` with bounded outcome and nonnegative-duration checks. Resolve rows outside
eligible true misses keep these null; after the open-submission check an eligible miss records
even `disabled`. Create service-role-only, RLS-protected `scan_submit_dm_lookup_events` with
timestamp/outcome/duration/deadline only (no user ID, barcode, name, payload, or submission ID);
one row for each submit-side eligible lookup, including failures. Create service-role-only
`scan_dm_lookup_daily_aggregates` keyed by UTC day, route (resolve/submit), outcome, configured
deadline, and latency bucket; store count and duration sum. Buckets are 0–249, 250–499, 500–999,
1000–1499, 1500–1999, 2000–2999, 3000–4999, 5000+ ms, plus `not_called` for disabled/invalid.
Update the existing private retention function to aggregate both raw sources idempotently *before*
deleting rows older than 30 complete UTC days, then delete aggregate rows older than 12 months.
Keep the existing scanner aggregate and its GTIN/attempt semantics intact. Document source,
grain, legacy-null interpretation, and queries in `docs/scan-attempt-log.md`. Existing
`product_submissions` needs no new column; its source-labelled `intake_history` is the dm draft,
not a telemetry store. Consumes T3's outcome enum. Tests: disposable-Postgres migration/security
and two-run retention proof (no duplicate counts, no lost submit event, exact boundary days),
plus `tests/scan-resolve-event-log.test.ts` for outcome persistence and fail-open logging. Never
apply the migration to production merely to run planning or local tests. Done when new schema,
rollup, retention, and read restrictions are proven locally.

**T4 — Resolve route + unknown sheet.** (a) `src/lib/scan/types.ts`: `identified?` with the exact key
set in §4. (b) `src/app/api/scan/resolve/route.ts`: new dep `resolveRetailerEnrichment`; call it only
on a true miss (`!hit`, not on the quarantined branch) after the open-submission check; attach
`identified` when the result contains an enrichment and persist its outcome/duration/deadline in
the same deferred terminal attempt-log update, including a fail-open fallback. The existing
terminal outcome remains `unknown_product` and a dm failure never becomes a scan failure. Consume
T3b's migrated schema; do not deploy a writer before the migration. (c) Analytics:
extend the typed `AppEventMap` and the exhaustive PostHog destination mapper, not only the
`scan_not_found` emitter. Generate a fresh `scanInteractionId` for each unknown-sheet instance;
emit the exact §4 properties on `scan_not_found` and reuse that ID on
`scan_submission_created` only after a successful pending response. Measure
`msToUnknownSheetReady` from the start of the resolve request to result dispatch (including
any intentional camera-confirmation delay), and `msConfirmationToPending` from category
tap to successful pending response; the latter event must distinguish one-tap vs grid,
and suggestion override is selected category ≠ suggested category; opening
"Wofür anderes" alone is not an override. Keep consent gating and do not send GTIN, identity,
ingredients or user ID. (d) `verdict-labels.ts`: the constants in §4.
(e) `next.config.ts`: the `images.remotePatterns` entry exactly as in §4 (https, exact host,
pathname `/images/**`); `ScanProductThumb` gains a `proxied` variant using `next/image` with explicit
width/height for validated dm URLs (existing catalog thumbs stay the unoptimized `<img>`). Use a
placeholder on absent/invalid URL; set `images.maximumRedirects: 0`, verify the pinned Next
version recognizes it at config load, and regression-check existing optimized remote-image
consumers. Keep CSP `img-src` same-origin (do not add dm). Do not promise zero proxy abuse from
the initial URL pattern alone. A test asserts the
identified sheet never renders a bare `<img>` whose `src` host is `products.dm-static.com`. (f) `scan-unknown-flow.tsx`: product row (proxied thumb, name, title-cased brand) above
the headline, identified copy; variant A when `suggestedCategory` is set (question, coral primary
"Ja, als {label}", secondary "Wofür anderes" revealing the grid without the suggested card); variant B
otherwise. The server submit payload remains `{ category }`; keep the one-tap/grid path in client
analytics state. Consumes T3 and T3b. Tests: extend
`tests/scan-resolve-route.test.ts` (identified attached on hit incl. suggestedCategory; plain unknown
on no-hit/timeout; quarantined hit never calls enrichment; injected dependency throwing never
breaks the response; exact outcome persisted on the existing attempt row);
extend `tests/scan-resolve-anti-leak.test.ts` (assert the exact `identified` key set and search the
raw response JSON for the fixture's ingredient, description, key-benefit and product-URL strings);
extend `tests/scan-flow-ui.test.tsx` (variant A renders and submits the suggested category; "Wofür
anderes" reveals the grid without the suggested card; variant B renders the grid; plain sheet
unchanged; brand title-casing; viewing/closing without category tap creates no submission);
`tests/scan-analytics.test.ts` and destination-mapper tests (consent off => no events, ID join,
one-tap/override and timing fields survive mapping, no identifier leakage); run the existing
`tests/scan-flow.spec.ts` event-count assertion. Done when tests green and variant A
fits at 375×812 without scrolling (Playwright check in ready-check).

**T5 — Submit route + intake history.** `src/app/api/scan/submit/route.ts`: new dep
`resolveRetailerEnrichment` (route `submit`, same configurable deadline, fail-open); write one
privacy-safe `scan_submit_dm_lookup_events` outcome/duration/deadline row for each eligible
submit-side call, regardless of a later insert outcome, using a fail-open writer with rate-limited
warning on telemetry failure. Pass only `enrichment` into
`submitScanProductIntake`. `src/lib/product-intake/submissions.ts`:
`SubmitScanProductIntakeParams.enrichment?: RetailerEnrichment | null`; `matchProductIntake` runs on
the ORIGINAL input (client brand/name, which scan never sends) so dm identity can never produce a
text match; only after the identifier-and-text match has fallen through, prefill `brand_text` /
`product_name_text` on the insert row from the enrichment when the client sent none, and append the
`retailer_enrichment` entry after the existing scan entry. Keep the existing one-open-scan
submission dedupe: concurrent retries reuse the winner; never overwrite that winner's provenance
or imply two newly created submissions. Never touches `user_product_usage`,
`products`, `product_identifiers`. Consumes T3 and T3b. Tests (submissions suite or
`tests/scan-pending-submission.test.ts`): history entry written with `suggestedCategory`; prefill only
when fields empty; a second canonical-GTIN guard at persistence rejects accidental mismatch;
no enrichment → byte-identical row to today; regression: GTIN misses but dm
brand/name exactly equal a catalog product → still `pending_submission`, never `already_in_catalog`;
submit timeout still inserts the plain row and records a timeout; only a confirmed eligible catalog
match returns `already_in_catalog`; concurrent duplicate submit does not create another row.
Done when tests green.

**T6 — Research worker seed + docs.** `scripts/product-intake/codex-research-worker.ts`: extend the
worker's existing direct `product_submissions` query (the one that already fetches the scanned
identifier) to also select `intake_history`; use a pure, unit-tested
`scripts/product-intake/retailer-enrichment-packet.ts` parser/builder to add a
top-level `retailer_enrichment` section to the research packet (identity candidate, verbatim
ingredient text + `productUrl` as source, image URL candidate, suggested category) — the existing
brand-resolution context stays for canonical brand enforcement only. Prompt rules: identity needs ≥1
further source unless the brand is dm-exclusive (W5). Enforce in the packet builder, not only its
prompt, that `canonicalizeGtin(enrichment.gtin) === canonicalizeGtin(submission.scanned_identifier_value)`
and otherwise omit enrichment and report a throttled low-cardinality warning (generation rule).
`docs/product-intake-research-ops.md`: section
"Retailer enrichment (dm)" (provenance, storage boundary, generation rule, image proxy, open terms
question). `docs/local-qa-access.md`: `SCAN_RETAILER_ENRICHMENT_ENABLED`,
`SCAN_RETAILER_ENRICHMENT_TIMEOUT_MS`, initial/default-off and measured-cap protocol.
Consumes T5. Tests in `tests/product-intake-research-jobs.test.ts` cover matching/mismatching
fixture submissions and warning sanitization/throttling. Done when tests green.

## 9. Verification

Automated, exact commands:

```bash
npm run ci:verify
```

```bash
npm run test:node
```

Focused during implementation (same shim, single files):
`node --import ./tests/server-only-register.cjs --import tsx --test tests/scan-dm-toon.test.ts`
and likewise for `scan-dm-mcp-client`, `scan-dm-enrichment`, `scan-dm-suggest-category`,
`scan-resolve-route`, `scan-resolve-anti-leak`, `scan-flow-ui`, `scan-analytics`,
`scan-resolve-event-log`, `scan-resolve-events-migration`,
`scan-pending-submission`, `product-intake-retailer-enrichment`; add a focused
submit-telemetry test and a disposable-Postgres retention/security test.

Manual pre-release (worktree dev server via `npm run dev:worktree`, read-only resolve calls or
mocked submit; local dev points at production Supabase and must not silently create a row):
manual EAN `4001638530378` → identified Weleda sheet, "Benutzt du es als Shampoo?";
`4262391991626` → conditioner suggestion and "Wofür anderes" grid; negative
`4068134087058` → plain sheet; flag off → plain sheet, no outbound call; forced 1 ms cap →
plain sheet, server outcome `timeout` without a standalone Sentry alert. Playwright at
375×812: variant A sheet has no vertical scroll; category choice is the only submit trigger.
Network capture: product image is served from `/_next/image` and no browser request goes to
`products.dm-static.com`; invalid/redirected image fails safely. Validate existing remote images
after setting the zero-redirect cap.

Latency calibration before the production smoke: run a small representative, labelled QA sample
of dm-stocked, non-dm, and recent miss GTINs at the provisional 1500 ms cap and at a longer cap
that reveals hits censored by 1500 ms. Measure end-to-end lookup duration on both routes,
timeout/hit mix, same-build flag-off unknown-sheet baseline and confirmation-tap-to-pending time;
choose and record the initial production cap from the tradeoff, rather than claiming 1500 ms is
optimal. The one-row smoke is a functional proof, not a representative latency sample. Inspect
the first live outcomes and latency before retaining the flag for public traffic.

Pre-release evidence (2026-09-17): [read-only dm and server-path benchmark](scan-dm-enrichment/evidence/prelaunch-latency.md)
found 8 of 10 current dm-page GTINs, with two `not_found`, no timeouts, and a 339 ms median
dm operation at the 1500 ms cap. This is a small local sample, not production user-visible
latency or a final cap decision. The live telemetry migration is unapplied; do not exercise
the real production-backed HTTP route or claim complete scan-to-sheet/submit timing before
the guarded migration-first rollout and QA smoke above.

Controlled production smoke (only after implementation verification, review, separately authorized
deployment and telemetry-migration apply): verify the current flag is off and record flag/cap;
if unexpectedly on, pause and resolve the live state before the test. Enable the dm flag for a short
QA window. Preflight the QA account and `4001638530378` read-only: verify the barcode is still a
true catalog miss with no open submission for that account; if not, choose another labelled exact
dm GTIN and record it, rather than changing existing rows. Use the QA account, confirm the
identified sheet and "Ja, als Shampoo" → pending sheet. Read-only SQL verifies exactly one new
`product_submissions` row from this QA action with
`source='scan'`, matching scanned identifier, user-confirmed category, dm-sourced
`intake_history` and prefilled texts; re-enter → pending sheet. Verify the research-job queue
entry exists and run the pure packet builder in dry mode (no job claim/publish) to see its
`retailer_enrichment` section; compare server resolve/submit outcomes and durations with the
consented PostHog event mapping using the QA interaction ID, without sending GTIN to PostHog.
Record the QA account, submission ID and operator disposition in a private QA receipt; do not
delete, reject, or publish the row automatically. **If the smoke fails, turn the flag off
immediately and verify both persisted flag state and a plain-sheet resolve without a dm call.**
If the smoke passes, inspect early lookup outcomes, latency, submit success, image behavior and
unexpected warnings. The named release owner may keep the flag on for the public trial only after
recording its checkpoint and rollback owner; document the decision and current flag state.
At the checkpoint, use actual traffic, operator corrections and the dm-use conversation to decide
continue, adjust the cap, or switch off. Any guardrail breach (scan or submit failure attributable
to enrichment, identity mismatch, privacy leak, or sustained timeout/latency regression) triggers
flag-off and verified fallback while diagnostics are preserved. Nick's QA approval covers the test
submission; it does not approve a catalog publish.

Migration/live state: additive telemetry migration required. Before any separately authorized
production apply, check current migration state, run security/retention tests on disposable
Postgres, apply schema before deploying writers, and verify new columns/RLS/cron/retention with
read-only post-apply checks. No production schema mutation in the planning turn.
Evidence-sensitive review: rendered variant A/B vs approved HTML mockup; inspect actual mobile
sheet and production-smoke screenshots.

## 10. Review and handoff

Worktree `.worktrees/scan-dm-enrichment`, branch `codex/scan-dm-enrichment`, base e7b93c67.
Gates: per-task review, Codex whole-branch review (read-only) before push, `ready-check` with the
manual checks above, then `ship-it` only on explicit request. Rollout: default off; after separately
authorized deploy and migration, enable for the smoke in §9 and, if it passes, a measured public
trial with a named checkpoint/rollback owner. Do not promise indefinite activation before the
dm-use conversation and a meaningful QA/latency/quality readout; negligible current traffic is
not proof of safety or value. Risks: dm format drift
(fail-open + server outcome + actionable warning); dm data/image reuse terms (unresolved, no legal
conclusion); actual cap may add up to that much delay on each of resolve and submit; two dm calls
per completed submission with unknown vendor quota; new dependency `@modelcontextprotocol/sdk`;
Next image redirects and billable transformations need bounded behavior and actual measurement.
Artifacts: this plan, HTML mockup and dm-probe fixtures → commit with the eventual PR; no PNG
currently exists. Transient counterpart report and scratchpad copies → discard after findings
are incorporated. Stop point: review-ready plan in this turn; implementation, commit/push/PR,
merge, deployment, production migration apply, smoke execution, public flag activation and catalog
publication remain separate execution actions. Product-journey sign-off: Nick's 2026-09-16
mockup/copy approval plus 2026-09-17 confirmation-action ruling, unchanged by this revision.

## 11. Counterpart review ledger (read-only)

| ID | Type | Evidence | Decision | Plan change | Revalidation |
| --- | --- | --- | --- | --- | --- |
| V1 | defect | `normalize.ts:34` vs `:52`; `identifier-lookup.ts:38` uses `canonicalizeGtin` | accepted | §4/T3: canonical GTIN-14 via `canonicalizeGtin` on both sides; spelling tests | verified in repo |
| V2 | defect | `submissions.ts:986–1014`, `product-matching.ts:420+` text match after identifier miss | accepted | T5: match on original input; prefill only after fall-through; regression test | verified |
| V3 | defect | MCP 2025-06-18 lifecycle/transport; module-level session in Rev. 1 | accepted | §2/T2: official SDK client per operation, one deadline, 404 retry, concurrency test | spec-verified |
| V4 | scope/product | `scan-product-thumb.tsx:25` bare `<img>` → user IP to dm | decided by Nick (proxy) | §4 image proxy contract; T4(e); §9 network assertion; §10 cost risk | confirmed 2026-09-16 |
| V5 | defect | `observability/scan.ts:13,63`: no `enrichment` route, no breadcrumb API | accepted | §4: standalone sanitized warning, optional breadcrumb, no GTIN/user id | verified |
| V6 | defect | `product-intake-core/repository.ts:304` lacks `intake_history`; worker packet not pure | accepted | T6: extend worker's direct query; pure parser + builder with tests | verified |
| V7 | defect | anti-leak suite searches raw JSON (`:278,:311`) | accepted | T4: exact key-set assertion + raw-value search | verified |
| V8 | defect | `suggestedCategory` persistence contradiction | accepted | §4: field on `RetailerEnrichment`, recomputed on submit | — |
| V9 | defect | budget vs multi-request lifecycle; env override undefined | accepted | T2: one absolute deadline + cumulative test; §4 env override read by factory | — |
| V10 | scope/product | `CATEGORY_COPY` has no articles | resolved by Nick's ruling | copy is article-free ("Benutzt du es als …?"); ten-label test | — |
| V11 | scope/product | resolve route `:336` shared miss/quarantine branch | accepted as default | true misses only; route test | verified (R7) |
| V12 | defect | `package.json:20,48` | accepted | §9 exact commands | verified |
| S1 | defect hypothesis | fixtures lived only in a scratchpad | accepted | §1/T1: probe artefacts committed under evidence/dm-probe | — |
| S2 | tradeoff hypothesis | unknown dm quota, two calls per submission | accepted | §10 risk recorded, no capacity claim | — |

Claude Code read-only plan review (2026-09-17, `high`): **approve with revisions, no technical
blocker**. Current Codex pass checked the findings against the route's synchronous submit
response, the existing consented event mapper, CSP configuration and plan scope. The review
report is transient and not a repository artifact.

| ID | Type | Evidence | Decision | Plan change | Revalidation |
| --- | --- | --- | --- | --- | --- |
| C1 | UX/latency tradeoff | `submit/route.ts:82` awaits submission; server re-fetch is required for trusted draft | accepted and made explicit | §5/§6/§9: shared bounded cap initially, second call on tap critical path, measure tap-to-pending | route checked |
| C2 | scope tradeoff | T3b dual raw sources + daily rollup for initially one-row smoke | retain deliberately | §5: Nick's data-for-refinement direction; this is future calibration infrastructure, not statistical proof from smoke | no new product table |
| C3 | implementation caveat | SDK not yet installed; exact transport API untested | accepted | §4/T2: pin and prove lifecycle/deadline with fake fetch at implementation | test gate |
| C4 | privacy/config | `next.config.ts` CSP img-src; Next redirect option | accepted | §4/T4: keep dm absent from CSP; test pinned-version config parse and zero redirects | CSP checked; config unproven until install |
| C5 | specification/test | variant B could be read as plain sheet; existing event-count Playwright assertion | accepted | §4/T4: identified row/copy in B; existing spec included | spec checked |
| C6 | scope suggestion | defer submit telemetry and 12-month rollup to future activation | declined | Nick explicitly asked for broad measurement to refine the cap and quality, and has since approved a monitored public trial; §5 states maintenance weight | implement/test still required |

Rev. 6 rollout correction is Nick's explicit new direction, not a reviewer recommendation:
retain a successful smoke's flag-on state for a monitored public trial rather than mandating
flag-off. The technical plan and approved sheet journey are unchanged. No second counterpart
review was run merely for this release-condition correction; whole-branch review remains required
before publication.

Implementation note (2026-09-17): this repository has no tracked `.env.example` and ignores
`.env*`. Rev. 6 documents the two new flags in `docs/local-qa-access.md` instead of creating
a one-off ignored env template.
