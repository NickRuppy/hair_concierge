# Handoff: Shampoo-Wave Research (~50 SKUs)

Self-contained brief for the research agent/session doing the shampoo wave. Everything referenced lives in THIS worktree.

## Where to work

- Worktree: `/Users/nick/AI_work/hair_conscierge/.worktrees/db-expansion-scan` (branch `codex/db-expansion-scan`, based on current main)
- You may CREATE/EDIT only: `plans/scan-db-expansion/research/shampoo-manifest-*.json` and `plans/scan-db-expansion/research/shampoo-research-notes-*.md`. Read anything. Do NOT commit; do NOT touch the selection ledgers, templates, src/, or supabase/. No database writes of any kind — research output is files only.
- Browsing is read-only (decline non-essential cookies, no logins).

## What to research

The shampoo products in, combined (~54 total; skip any marked parked/excluded):

1. `plans/scan-db-expansion/selection-batch1-draft.json` → `pilot` items with `category_key: "shampoo"` (8)
2. same file → `backlog` items with `category_key: "shampoo"` (31)
3. `plans/scan-db-expansion/shampoo-wave-extension.json` (15; pending Nick's skim — ask before including if unconfirmed)

Take names, sizes, EANs, and source URLs from those files as the starting point. Work in **sub-batches of ~15 products per manifest file** (`shampoo-manifest-01.json`, `-02.json`, …) so review and apply can be staged.

## Output contract (the law)

- Schema: `src/lib/product-intake/expansion-manifest.ts` (zod). Worked example of a finished, honest manifest: `plans/scan-db-expansion/research/mask-manifest.json` + `mask-research-notes.md` — match their structure and evidence discipline.
- Referee (run after every sub-batch, iterate to PASS):
  `npm run products:intake:expansion:validate -- --manifest plans/scan-db-expansion/research/shampoo-manifest-01.json`
- Hard rules baked into the schema: `origin: "curated"`, `is_chaarlie_recommended: false` (anything else fails), EANs must pass the GS1 check digit, every EAN needs ≥1 source URL; single-source/unverified EANs stay in the manifest but marked `cross_source_agreement: false` + `excluded_from_apply: true` — NEVER invent digits.

## Per product

- `final.category_specs` for shampoo per `src/lib/product-intake/category-validators.ts`: per-thickness rows with `shampoo_bucket`, `scalp_route`, `cleansing_intensity` (required non-null) — judged from INCI + claims + texture. When evidence is mixed, choose the conservative value and explain in `field_rationales` (repo rule: never present weak evidence as a hard rule).
- `thickness_eligibility` (non-empty) + `concern_eligibility`.
- Protocol stamp — templates in `plans/scan-db-expansion/protocol-templates.md`:
  - `TPL-SHAMPOO-STD` for every generic shampoo (marketing claims like repair/volume/moisture/curl do NOT change the template),
  - `TPL-SHAMPOO-TARGETED` only for scalp-condition claims (urea, sensitive scalp, oily scalp),
  - `TPL-SHAMPOO-DANDRUFF` for anti-dandruff products (cosmetic framing ONLY — never paraphrase medical language like "Pilzinfektion"/"ärztlicher Rat" into copy; flag such products in the notes instead).
  - Each stamp needs `product_source` (packaging text or manufacturer URL quote confirming the usage fits). Deviations (Nick's ruling 2026-09-02): packaging can NEVER override Chaarlie's application guidance — application-style differences are ignored, not flagged. `deviation` is reserved for STRUCTURAL mismatches only: the product doesn't belong in this category at all (e.g. a leave-in sold as shampoo). Flag those; stamp everything else with the standard template unchanged.
- `candidate_image`: official packshot URL + source page. QUALITY BAR (Nick 2026-09-02): a straight-on shot of the retail packaging ALONE — no before/after photos, texture smears, infographics/claim overlays, applicators, or angled lifestyle shots — and at least 800px on the product's shorter axis (check the page's srcset for the largest variant; dm's media CDN serves large sizes). Sub-bar images get flagged by the pipeline and bounce back.
- `evidence[]`: one row per authority fact — `fact_key`, `fact_value`, `source_label`, `source_url`, `source_type` (`manufacturer` | `retailer` | `professional_authority`), `checked_at`, and **`source_text` (strongly preferred: the verbatim quote backing the fact)** — schema-optional, but products whose evidence has no quote and no derivable fallback are parked at apply time.
- `price_eur` + `net_content_value/unit` where the retailer shows them.
- Missing EANs (several Rossmann-only items): try the product page's Syndigo content-sync tag / URL number (mod-10 validate, record source) — the method is documented in the selection ledger's EAN notes.

## Notes file (one per sub-batch)

Per product: sources used, per-field confidence (solid / inferred / guessed-conservative — be honest), deviations, open questions for Nick. Header must state: research DRAFT, not approved data.

## Duplicate guard

If a product turns out to already exist in the live catalog (same brand + formulation), do NOT create it as new — record it under `existing_product_updates` (add the newly found EAN to the existing product) and flag it in the notes. Known prior case: "Elvital Glycolic Gloss Shampoo" already exists as the catalog row "Ultimate Shampoo" (rename queued).

## Definition of done

Every sub-batch manifest passes the validator (or remaining failures are documented as data-unavailable), notes files are complete, and a final summary lists: products researched, EAN coverage, deviation count, excluded products, and open questions. Nothing is applied to any database — apply is a separate, human-gated step.
