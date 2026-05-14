# Affiliate Link Backfill — Design

**Date:** 2026-05-13
**Status:** Approved (brainstorming)
**Owner:** Nick

## Goal

Fill `products.affiliate_link` for the ~209 active products that are missing a usable shop URL, so that the product drawer can display its Buy CTA. The drawer derives shop label + disclosure from the URL host, so a plain product URL is sufficient — affiliate-program enrollment is out of scope here.

## Scope

In: 209 active rows with null / empty / non-http(s) `affiliate_link` across Shampoo (51), Leave-in (42), Öle (41), Conditioner Drogerie (40), Maske (35).

Out: Bondbuilder (5) and Trockenshampoo (10) already have links. No schema changes. No affiliate-tagging. No shop-name field — host is derived.

## Mechanism (one paragraph)

Export missing rows → dispatch Claude Code general-purpose subagents (one per category, long poles split) that each research their slice with `WebSearch` + `WebFetch`, verify candidate URLs, and write a CSV → aggregate the per-slice CSVs into a master `results.csv`, an `approved.csv` (high-confidence only), and a `review-queue.csv` (medium + none) → user reviews `approved.csv` → `write-affiliate-links.ts` issues the UPDATEs.

The crucial property: subagents auto-classify but **never write to the DB**. The DB write is its own explicit step against a human-reviewed CSV.

## Pipeline

```
┌─ scripts/export-missing-affiliate-links.ts ──────────────────────────┐
│  reads products → data/affiliate-research/missing.csv                 │
│  + per-category slices: missing-shampoo-a.csv, missing-oele.csv, ...  │
└──────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─ CANARY ─────────────────────────────────────────────────────────────┐
│  Agent(subagent_type=general-purpose) on data/.../missing-canary.csv  │
│  → writes data/.../results-canary.csv                                 │
│  → user inspects, tunes prompt if needed                              │
└──────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─ FULL FANOUT (~15 parallel subagents, ~13-18 rows each) ─────────────┐
│  shampoo-a..d, leave-in-a..c, oele-a..c, conditioner-a..c, maske-a..b │
│  each → data/affiliate-research/results-<slug>.csv                    │
└──────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─ scripts/validate-slice.ts (run after each slice completes) ─────────┐
│  - CSV parses cleanly                                                 │
│  - column header matches schema exactly                               │
│  - row count matches input slice row count                            │
│  - every id from missing-<slug>.csv appears exactly once              │
│  - failure → flag slice for rerun; aggregator refuses to proceed      │
└──────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─ scripts/aggregate-affiliate-research.ts ────────────────────────────┐
│  reads only data/affiliate-research/results-*.csv (no wider scope)    │
│  merges, dedupes by id (keep highest confidence)                      │
│  applies URL gate (parse + HOST_ALLOWLIST/DENYLIST/brand-in-host)     │
│  → results.csv          (every researched row, all confidences)       │
│  → approved.csv         (confidence='high' AND URL gate passes)       │
│  → review-queue.csv     (everything else)                             │
│  → prints summary table: category × confidence + reasons              │
└──────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                  ┌─── MANUAL APPROVAL GATE ───┐
                  │  user reviews approved.csv │
                  └────────────────────────────┘
                              │
                              ▼
┌─ scripts/write-affiliate-links.ts [--dry] ───────────────────────────┐
│  reads approved.csv                                                   │
│  re-validates each URL (parse + host gate)                            │
│  UPDATE products SET affiliate_link = ? WHERE id = ?                  │
│      AND (affiliate_link IS NULL                                      │
│           OR btrim(affiliate_link) = ''                               │
│           OR affiliate_link !~* '^https?://')  -- matches export      │
│  → appends to data/affiliate-research/applied.log                     │
└──────────────────────────────────────────────────────────────────────┘
```

## Subagent contract

**Dispatcher (Claude Code main session, executing the plan):**

For each slice, invokes `Agent` with `subagent_type: "general-purpose"` and a prompt of the form below. All fanout agents (~15) go out in a single message → run in parallel.

**Per-category preference orders:**

| Category | Preference order |
|---|---|
| Shampoo | DM > Rossmann > Müller > brand-direct > Amazon DE |
| Conditioner (Drogerie) | DM > Rossmann > Müller > brand-direct > Amazon DE |
| Maske | DM > Rossmann > Müller > brand-direct > Amazon DE |
| Leave-in | DM > brand-direct > Rossmann > Amazon DE |
| Öle | brand-direct > Amazon DE > DM > Rossmann |

**Host allowlist** (auto-approved at the aggregation gate):

```
www.dm.de, www.rossmann.de, www.mueller.de, www.amazon.de,
www.douglas.de, www.flaconi.de, www.notino.de, www.otto.de
(with or without the www. prefix)
```

**Host denylist** (always rejected — never confidence='high'):

```
idealo.de, geizhals.de, billiger.de, preisvergleich.de,
ebay.de, ebay.com, kleinanzeigen.de, aliexpress.com,
amazon.com (use amazon.de for the DE market)
```

**Brand-direct rule:** A host outside the allowlist passes if its hostname contains the brand name as a substring (lowercased, alphanumeric only — e.g. `olaplex.com` for brand "OLAPLEX", `k18hair.com` for "K18", `sante.de` for "Sante"). Anything else: confidence stays `medium` at best.

**Subagent prompt skeleton** (parameterized per slice):

```
You are researching German online-shop URLs for {N} hair-care products
in category "{CATEGORY}". You are running in parallel with other agents
working on other slices — only research the rows in your input file.

INPUT:  data/affiliate-research/missing-{SLUG}.csv
        columns: id,brand,name,description,category,price_eur
OUTPUT: data/affiliate-research/results-{SLUG}.csv
        columns: id,brand,name,chosen_url,host,confidence,matched_tokens,notes

Shop preference order for this category: {PREFERENCE_ORDER}

ALLOWED TOOLS: WebSearch, WebFetch, Read (only on data/affiliate-research/),
               Write (only to your OUTPUT path above).
FORBIDDEN:     Bash, Edit, ToolSearch, npm/npx, reading .env files, reading
               anything outside data/affiliate-research/, mutating any other
               file, opening a database connection.

For each input row:
  1. WebSearch with query: '{brand} {name} site:{first preferred shop host}'.
  2. If no relevant hit, walk down the preference order, dropping the
     site: filter at the end if needed. Cap: ≤3 search calls per product.
  3. Reject any URL whose path matches: /search, /suche, /s/, /category,
     /kategorie, /c/, /marken, /marke/, /brand/, /b/, or is a brand
     landing page (path ends at the brand slug with no product slug).
  4. For the surviving top candidate URL, WebFetch it.
  5. Verify ALL of:
     - HTTP 200 (or 3xx redirecting within the same host)
     - URL host is in the allowlist OR matches the brand-direct rule
       (hostname contains the brand slug as substring)
     - Host is NOT in the denylist (idealo, geizhals, billiger,
       preisvergleich, ebay, kleinanzeigen, aliexpress)
     - Brand string (case-insensitive, German umlauts normalized) appears
       in the page HTML
     - At least one DISTINCTIVE token from the product name appears in
       <title> or H1. A "distinctive token" is a non-stopword token from
       the name that is NOT a category noun ("Shampoo", "Spülung",
       "Conditioner", "Maske", "Mask", "Öl", "Oil", "Treatment", "Cream",
       "Repair", "Pflege", "Care", "Volume", "Volumen") and is at least
       4 characters long. Record the tokens you matched.
  6. Classify confidence:
       high   = all verification checks pass, distinctive token in <title>/H1
       medium = brand+token present in body but not title; OR only one
                of brand/distinctive-token matched in title; OR host
                is non-allowlisted but matches brand-direct rule
       none   = couldn't find a candidate, denied host, denied path,
                or any verification check failed
  7. Append exactly one row to your output CSV. Quote any field containing
     a comma. Empty fields are empty strings, not the word "null".

HARD RULES
  - Never invent or guess a URL. If not found, write confidence=none with
    chosen_url and host empty.
  - Never write confidence=high for a host on the denylist.
  - Process EVERY row in your input, in order. Skip none.
  - Output row count MUST equal input row count.
  - Do NOT touch the database, run scripts, edit other files, or read
    anything outside data/affiliate-research/.

When done, return a one-paragraph summary: total processed, counts per
confidence bucket, and any patterns worth noting (e.g. "Brand X has no
DM presence — all fell back to Amazon").
```

## Slicing plan

Target slice size: ~15 rows. Smaller slices reduce timeout / drift / CSV-truncation risk and make reruns cheap. Slices are sorted by id within their category and split evenly.

| Stage | Slice | Category filter | Rows |
|---|---|---|---|
| 1 | canary | 8 mixed rows (≥1 per category, varied brand types) | 8 |
| 2 | shampoo-a | Shampoo (rows 1-13 of 51 by id) | 13 |
| 2 | shampoo-b | Shampoo (14-26) | 13 |
| 2 | shampoo-c | Shampoo (27-39) | 13 |
| 2 | shampoo-d | Shampoo (40-51) | 12 |
| 2 | leave-in-a | Leave-in (1-14 of 42) | 14 |
| 2 | leave-in-b | Leave-in (15-28) | 14 |
| 2 | leave-in-c | Leave-in (29-42) | 14 |
| 2 | oele-a | Öle (1-14 of 41) | 14 |
| 2 | oele-b | Öle (15-28) | 14 |
| 2 | oele-c | Öle (29-41) | 13 |
| 2 | conditioner-a | Conditioner missing (1-14 of 40) | 14 |
| 2 | conditioner-b | Conditioner missing (15-27) | 13 |
| 2 | conditioner-c | Conditioner missing (28-40) | 13 |
| 2 | maske-a | Maske (1-18 of 35) | 18 |
| 2 | maske-b | Maske (19-35) | 17 |
| | **Total fanout** | | **209** |

Stage 1: canary runs alone. User inspects `results-canary.csv` and the agent's summary. If verification rules need tuning, edit the prompt skeleton, regenerate canary, repeat.

Stage 2: 15 fanout agents dispatched in a single `Agent` tool-use message → run in parallel. (Canary rows are deduped during aggregation; if canary IDs reappear in a stage-2 slice, aggregator keeps the higher-confidence row.)

**Rerun protocol:** if `validate-slice.ts` flags a slice (CSV malformed, missing IDs, row-count mismatch), dispatcher reruns only that slice. The validator's failure report tells the dispatcher exactly which IDs are missing or duplicated.

## Boundary enforcement

The "auto-classify but never write to DB" property is not just a prompt rule — it's enforced mechanically by what the subagent has access to:

1. **Subagents have no DB credentials.** The TS scripts (`export-`, `aggregate-`, `write-`) read `SUPABASE_SERVICE_ROLE_KEY` from `.env.local`. Subagents are explicitly told not to read `.env*` and not to run scripts. Even if a subagent attempted to import `@supabase/supabase-js`, it has no service-role key in its conversation context to use it with.
2. **Subagents are scoped to `data/affiliate-research/`.** The prompt enumerates ALLOWED TOOLS (WebSearch, WebFetch, Read on that dir only, Write to its single output CSV) and FORBIDDEN tools (Bash, npm/npx, Edit, anything else). The general-purpose agent type has access to more tools than that, so this is a prompt-level discipline — but combined with point 1, the worst a misbehaving subagent could do is corrupt its own output CSV, which the validator catches.
3. **Aggregator is glob-scoped.** `aggregate-affiliate-research.ts` reads from a hard-coded glob `data/affiliate-research/results-*.csv` and rejects any file outside that pattern. It does not accept a `--results-path` flag.
4. **Pre-aggregation diff check.** Before aggregating, dispatcher runs `git status -- data/affiliate-research/` (or just `ls`) and confirms only `results-*.csv` files appeared. If any other file under that dir changed unexpectedly, halt and investigate.
5. **The DB write is a separate command.** `write-affiliate-links.ts` is the only script in the pipeline that opens a service-role Supabase client. It must be invoked explicitly by the user after they review `approved.csv`. It has a `--dry` flag that prints the SQL without executing.

The combination makes the boundary defense-in-depth: even if a subagent ignored the prompt rule, it would lack the credential, lack the right tool, and have its output rejected by the aggregator.

## File layout

```
scripts/
  export-missing-affiliate-links.ts       (new)
  validate-slice.ts                       (new — runs per slice)
  aggregate-affiliate-research.ts         (new)
  write-affiliate-links.ts                (new)
  audit-affiliate-links.ts                (already exists)

data/affiliate-research/                  (gitignored)
  missing.csv
  missing-canary.csv, missing-shampoo-a.csv, ...
  results-canary.csv, results-shampoo-a.csv, ...
  results.csv
  approved.csv
  review-queue.csv
  applied.log
  validation.log                          (one entry per slice validation)
```

Add `data/affiliate-research/` to `.gitignore`.

## CSV schemas

**missing-*.csv** (input to subagents):
```
id,brand,name,description,category,price_eur
```

**results-*.csv** (output from subagents):
```
id,brand,name,chosen_url,host,confidence,matched_tokens,notes
```

- `confidence` ∈ {`high`, `medium`, `none`}.
- `matched_tokens` is a `|`-separated list of distinctive tokens the subagent found in `<title>`/H1 (e.g. `Aqua|Revive`). Empty when no candidate found.
- `notes` is free text from the subagent — used by the human reviewer.

**approved.csv** (input to write-back):
```
id,brand,name,chosen_url,host,matched_tokens,notes
```

A row lands in `approved.csv` only if ALL of the following hold:
1. `confidence = 'high'`
2. `chosen_url` parses as `http(s)://...`
3. host is in `HOST_ALLOWLIST` **or** matches the brand-direct rule (hostname contains the brand slug)
4. host is **not** in `HOST_DENYLIST`
5. `matched_tokens` is non-empty

Everything else goes to `review-queue.csv` with a reason column explaining which gate it failed.

## Verification details

**Category-noun stopword list** (these never count as distinctive tokens):

```
shampoo, spülung, spuelung, conditioner, maske, mask, öl, oel, oil,
treatment, kur, pflege, care, cream, creme, repair, volume, volumen,
hydration, feuchtigkeit, intense, intensiv, daily, täglich, taeglich
```

**Brand-slug normalization for the brand-direct rule:**
- Lowercase, strip non-alphanumeric, normalize umlauts (ö→oe, ä→ae, ü→ue, ß→ss).
- Match by substring against the lowercased hostname.
- Example: brand "OLAPLEX" → slug `olaplex` → matches host `olaplex.com`. Brand "Sante Naturkosmetik" → slug `santenaturkosmetik` AND tries shorter `sante` → matches host `sante.de`.

**Two-stage matching:** brand-slug match tries the full slug first, then progressively shorter prefixes (down to 4 chars). If the brand is "Bali" (too short), it falls below the threshold and only allowlisted hosts can clear the brand-direct gate.

**Path rejection patterns** (regex, case-insensitive on URL path):

```
^/$                              (homepage)
/search\b, /suche\b, /s/
/category\b, /kategorie\b, /c/
/marken?\b, /brand\b, /b/
/sale\b, /angebot\b
\.html?$  ← OK if the rest of the path has product slug components
```

**Write-back URL re-validation** is structural only:
- `URL` constructor doesn't throw
- protocol ∈ {`http:`, `https:`}
- host parses, is in allowlist OR passes brand-slug rule, and is not in denylist

No re-fetch at write time — subagent's verification is trusted at write time. (A separate `verify-links-live.ts` health-check is left as a future cron; out of scope here.)

## Failure modes & handling

- **No German shop carries the product:** confidence `none`, lands in review queue. Acceptable outcome.
- **Wrong-product match passes verification:** the path-rejection list eliminates the bulk (category pages, brand landing pages). The distinctive-token requirement eliminates collisions on category nouns alone. Residual risk is on real PDPs of a different SKU of the same brand — caught by the user's `approved.csv` review and by post-write spot-checks.
- **Rate limit on WebSearch / WebFetch:** ~3 searches + 1 fetch per row × 209 rows = ~836 web calls total, spread across 15 agents (~56 each). Well within tool limits. If a single tool call rate-limits, the agent should retry once with backoff then record `none`.
- **Subagent crashes / truncates output mid-slice:** `validate-slice.ts` detects (row-count or missing-id mismatch) and the dispatcher reruns only that slice. Smaller slices (~15 rows) keep rerun cost low.
- **Malformed CSV** (extra commas, missing quotes): `validate-slice.ts` rejects the slice; dispatcher reruns with an explicit reminder in the prompt about quoting comma-bearing fields.
- **Duplicate hits across agents (canary overlap):** aggregator keeps highest confidence per id; ties broken by allowlisted host > brand-direct > other.

## Acceptance criteria (deterministic)

Every gate below is a script check, not a judgment call.

1. **ID accounting.** `count(distinct id) in results.csv == count(rows) in missing.csv == 209`. Aggregator exits non-zero otherwise.
2. **No malformed slices.** All `data/affiliate-research/results-*.csv` pass `validate-slice.ts` (correct header, row count == input row count, every input id appears exactly once). `validation.log` shows zero failures at run end.
3. **Approved-URL gate passes for every row in `approved.csv`.** For each row: URL parses, scheme is http(s), host is in `HOST_ALLOWLIST` or matches brand-direct rule, host is not in `HOST_DENYLIST`, `matched_tokens` is non-empty. Aggregator drops rows that fail any check into `review-queue.csv` with the reason.
4. **Zero denied hosts in `approved.csv`.** `grep -E '(idealo|geizhals|billiger|preisvergleich|ebay|kleinanzeigen|aliexpress)\.' approved.csv` returns no matches.
5. **Write parity.** After `write-affiliate-links.ts` runs, `wc -l applied.log` == `wc -l approved.csv - 1` (minus header), modulo rows where the safety-belt WHERE clause filtered an id whose link had already been filled between research and write. The script prints exactly that delta if non-zero.
6. **Predicate parity.** Export's WHERE clause and write-back's `WHERE` clause are identical (`affiliate_link IS NULL OR btrim(affiliate_link) = '' OR affiliate_link !~* '^https?://'`). Verified by inspecting both scripts.
7. **Manual spot-check (post-write).** Open 10 newly-written links: ≥1 per category, plus 1 from every fallback shop that appears in `approved.csv` (e.g. if Amazon DE was used at all, at least one Amazon URL is in the sample). All 10 must load to the correct product. Failures are added to a follow-up review CSV.
8. **Audit delta.** `audit-affiliate-links.ts` re-run shows `activeWithLink` increased by exactly `applied.log` line count. (No collateral writes.)

Criterion 1, 2, 4, 5, 6, 8 are mechanical checks (exit codes / grep / wc). Criterion 3 is a script. Criterion 7 is manual but bounded.

## Out of scope

- Affiliate program enrollment (Amazon PartnerNet, DM partner) and tracking-param injection.
- A separate `shop_name` column. (Host is derived in the drawer.)
- Periodic link-rot monitoring. (Future cron — `verify-links-live.ts`.)
- The 18 already-linked rows (Bondbuilder + Trockenshampoo + 3 Conditioner) — left untouched.
- Filling rows that the workflow classifies as `medium` or `none` — handled separately in a follow-up review pass by the user against `review-queue.csv`.

## Risks

- **Generic SKU names** (e.g. "Repair Cream") collide across brands. Tightened verification (distinctive-token requirement + path rejection) cuts this materially. Residual risk handled by user review of `approved.csv`.
- **DM SKU drift** — a researched URL today may 404 next month. Mitigated by a future health-check cron; not blocking.
- **Subagent prompt-following variance** — agents may still write malformed CSVs or wrong columns. Per-slice validator catches; rerun is cheap because slices are small.
- **Brand-direct rule false positives** — a hostname like `bali-curls-fanblog.de` would match brand "Bali". Mitigated by the path-rejection list and by the brand-direct rule only granting `medium` (not `high`) on its own; only allowlisted hosts can give `high` directly.
