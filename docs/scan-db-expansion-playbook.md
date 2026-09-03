# Scan-DB-Expansion Playbook

How to add **scannable, non-recommended** products to the catalog — the proven recipe from the
pilot (14 products, 2026-09-02) and wave 2 (38 products + 1 rename, 2026-09-03), plus the retro
learnings and the selection method for future waves.

**Program state (2026-09-03):** 287 verdict-capable products (235 → 287 in one day, +22 %).
Record PRs: #509 (pilot infra + research), #510 (preflight fixes), #511 (wave 2).
Engine shampoo wave (54 SKUs) still in flight in `.worktrees/db-expansion-scan`.

**Owning rules (do not duplicate — read these):**

- Contract & validator: `src/lib/product-intake/expansion-manifest.ts`
- Protocol templates + rulings ledger (P1–P9, R-A–R-E, W1–W6): `plans/scan-db-expansion/protocol-templates.md`
- Program plan of record: `plans/2026-09-01-scan-db-expansion-pilot.md`
- Research-engine spec (external engine lane): `plans/scan-db-expansion/research/shampoo-research-handoff.md`
- Readiness oracle: `src/lib/scan/catalog-readiness.ts`

---

## 1. The recipe

Every wave runs the same eight steps. Nothing ships without step 7 at 100 %.

### Step 0 — Selection (see §3)

Pick 30–40 SKUs for the wave, per category, from the ranked signals in §3. Selection-stage
categories are **provisional** (retailer shelf placement); research corrects them (ruling R-A).

### Step 1 — Worktree + research manifests

- `npm run worktree:new -- <slug>`; **verify the worktree base equals the fetched `origin/main` tip**
  (a stale base has silently happened before).
- One manifest per category under `plans/scan-db-expansion/research/`, written by research
  subagents on **cheaper models** (opus for domain judgment, sonnet for mechanical work — never
  the main session's model). The main session briefs, reviews, and integrates.
- Non-negotiables baked into the contract, enforced by the validator:
  - `is_chaarlie_recommended: false` always — promotion is Nick's manual per-product call.
  - **Verbatim `source_text` quotes on every evidence row, captured during research.**
    (Pilot lesson: retro-transcribing 80 quotes was the single most expensive rework.)
  - **EAN 2-source rule (R-B):** same digits in ≥2 independent sources, or one physical scan.
    Exception (W5): retailer-exclusive private labels (Balea, Isana …) accept the single
    retailer source. Everything else single-source → `excluded_from_apply` and parked.
  - **Category by formula, not marketing (W1).** Toning/direct-dye products are out of scope (W2).
  - **Current shelf name/formula (W6)** — rebrands recorded as-current with a monitor note.
- Validate: `npm run products:intake:expansion:validate -- --manifest <path>` until PASS.

### Step 2 — Images (the human-heavy step)

- Batch: `scripts/product-images/batch-run.ts` (Vision cutout → padded retry → deshadow), then a
  **self-contained (base64) contact sheet** for Nick's review. Preview renders ≥480 px wide
  (`sips --resampleWidth`, never `-Z`).
- Known traps (all hit at least once):
  - Source bar ≥800 px min dimension. dm CDN accepts `h_`/`w_` params to raise resolution;
    Rossmann needs `fit=bounds&canvas=` or aspect ratios get squeezed.
  - Deshadow eats warm/amber products — the coverage-collapse guard rejects >15 % silhouette
    loss; fall back to plain-alpha cutouts. (Proposal for wave 3: tighten 15 % → ~5 %.)
  - Cartons/multi-object shots need a bottle-only source asset, not a crop rescue.
- Nick reviews the sheet, flags rejects, approves the rest. Finalize via
  `products:images:finalize-approved` → `upload-package-image.ts --apply --confirm`
  (storage-only writes). Gate false-positives on dark bottles are overridden **with a documented
  human review**, never silently.

### Step 3 — Preflight

`scripts/product-intake/expansion/preflight.ts` over the merged manifest + supplement.
**Parking is normal, not failure** — incomplete items park; the wave ships at 100 % of what
remains. Never lower the bar to ship a parked item.

### Step 4 — Nick's data review

Publish a review artifact (tables of all properties, confidence-flagged fields called out,
open decisions as numbered questions). Nick rules; rulings are appended to the ledger in
`plans/scan-db-expansion/protocol-templates.md`. **Assert every ruling-driven manifest edit**
(a spelling mismatch once made an edit silently no-op; only the preflight park caught it).

### Step 5 — Approval migration

Seal the batch: registry row in `scan_expansion_approved_batches` via a migration —
`batch_id`, **sha256 fingerprint of the raw batch JSON bytes**, `reviewed_head` (the exact
worktree HEAD Nick reviewed), `reviewed_by`, `item_count`. No fingerprint match, no apply.

### Step 6 — Apply

`scripts/product-intake/expansion/apply.ts` — guards: `SCAN_EXPANSION_EXECUTION_ENABLED=true`
+ `--confirm` + clean worktree + `HEAD == --reviewed-head`. One product per transaction through
the canonical intake approval boundary (`apply_scan_expansion_batch_v1`); **replay-idempotent**,
so reruns are safe.

- **GTIN overlap with an open user submission** (happened both waves — these are real demand
  signals): use the payload-stash bracket (stash the submission's identifiers → apply →
  restore), then `link-existing` if categories match. On a category mismatch, **leave the
  submission open for the review cockpit** — never force category surgery from the pipeline.
- Catalog duplicates surface here too; resolve as a rename/attach to the existing row, not a
  second product.

### Step 7 — Oracle verify + record PR

`scripts/product-intake/expansion/verify.ts` must report **100 % strict scan-ready** for the
wave. Then push the branch and open the record PR (manifests, rulings, approval migration,
verification trail). Merge is Nick's separate "merge it"; the products are already live —
the PR is the durable record.

---

## 2. What we learned (pilot + wave 2 retro)

1. **The guards are the product.** Every single wave, at least one guard caught a real issue:
   catalog duplicates, open user submissions, a silently no-oped ruling edit, single-source
   EANs, a defective prod function body (caught by the byte-exact convergence digest). Speed
   comes from trusting the pipeline *because* the guards are strict — don't relax them to go
   faster.
2. **Quotes at research time, not review time.** Verbatim evidence capture during research is
   nearly free; reconstructing it afterwards cost hours and produced three drifted quotes.
3. **Images are the bottleneck and the only step that truly needs a human eye.** Everything
   else is automated end-to-end. The open automation question for the main wave: better
   sources (retailer CDN parameters solved most quality issues) beat better post-processing.
4. **Park, don't negotiate.** 100 %-of-what-ships with parking beat any "≥90 % is fine"
   threshold. Parked items lose nothing — they rejoin the next wave.
5. **30–40 SKUs is the right wave size.** One research fan-out, one image batch, one review
   round, one evening from selection to live.
6. **Shelf placement lies; formula decides** (R-A, W1). Expect ~10 % recategorizations per wave.
7. **User submissions overlap with expansion picks** — twice already. That confirms the
   selection signal and means the bracket procedure is a standing part of apply, not an edge
   case.
8. **Research on cheaper models, main session orchestrates.** Four research agents per wave at
   ~200k tokens each must not run on the orchestrator's model.

---

## 3. Selecting the next products

Ranked signals, best first:

1. **Scan misses** — `scan_resolve_events` ranking (`docs/scan-attempt-log.md`). Real users
   scanning real products we can't answer. Thin while scan is in stealth (~10 events), becomes
   the primary signal at launch: *every miss is a selection vote.*
2. **Open user submissions** — explicit product requests in the intake queue.
3. **Retailer bestsellers per category** — dm + Rossmann bestseller/top-rated lists, private
   labels weighted up (Balea, Isana: huge shelf share, retailer-exclusive, cheap to verify
   under W5).
4. **Novelty quota** — small fixed slice (10–20 % of a wave) from "newest at Rossmann/dm", so
   the catalog tracks the shelf.
5. **Coverage gaps** — categories/thickness cells where the verdict engine has thin
   alternatives (coverage matrix), so scans in that cell get useful answers.

Standing exclusions: toning/direct-dye (W2, no treatment exists), scalp serums (category not
opened), professional/salon-only distribution (not scannable in a drugstore context).

**Queue after the current lanes** (engine shampoo wave 54 + conditioner backlog):
next wave = top scan misses + open submissions + bestseller refill of the thinnest coverage
cells, sized 30–40, same recipe as above.
