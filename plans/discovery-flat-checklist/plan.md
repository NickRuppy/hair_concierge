# Batch 5 — Discovery checklist without category tiles

## Rev. 3 (2026-09-24) — FINAL; supersedes Rev. 2 and Rev. 1 where they conflict

Input: Codex re-review of Rev. 2 ("not ready": 5 partial + 8 new). **Nick ruled the hardening level
"pragmatic" (2026-09-24):** fix real design gaps; accept the two rare timing races for this internal,
single-admin tool (documented below) instead of database-level locking.

### Accepted risks (Nick 2026-09-24 — do not build protection for these)

- **Participant write in flight vs. submit:** keep today's app-level draft check
  (`src/app/api/beratung/intake/shared.ts`) on every participant write, the submit-with-confirm
  step is one server call that inserts the `none` rows and flips state in a single DB statement/RPC,
  and a late write that slips past is accepted. No participant write RPCs, no item trigger, no
  two-session DB tests. (Replaces Rev. 2 P1-2 and Codex Rev. 2 #3.)
- **Admin usage correction vs. own „Finalisieren":** refuse the correction while finalized (existing
  frozen-while-finalized rule); no version compare-and-set on finalize. (Replaces Codex Rev. 2 #6
  and the write-time part of #5.) The finalize route still rechecks „no item with unknown usage"
  from the model it composes.

### Design fixes (from Codex Rev. 2)

- **F1 Separate product type for unlinked items** (Codex #1): new nullable
  `discovery_intake_items.product_type` (a `PersonalPlanCategory`) = what the product IS when there
  is no catalog product and no submission yet. Set at capture from the classifier/chips (never from
  the usage answer); `null` for „Weiß ich nicht". The research submission is created from
  `product_type`, never from `category` (usage). Batch 4's research route reads `product_type`
  (fallback `category` for legacy items). Cockpit „Kategorie offen" sets BOTH product type and usage
  (one select for type; usage defaults to the type, changeable). Research for a typed product is
  created only after the usage answer is confirmed (add completes); if submission creation fails at
  add time, the item is stored without submission and batch 4's „Recherche starten" covers retry.
- **F2 Usage ≠ product type keeps the verdict** (Codex #2): the verdict loader stops returning
  `target_mismatch` for a *known legitimate* usage difference (usage within the same R9 family as the
  product type, e.g. conditioner↔mask↔leave-in, shampoo↔deep cleansing, oil→scalp_care): it computes
  the verdict against the PRODUCT (its own category) and the cockpit shows
  „Benutzt als Maske · Produkt: Conditioner". A difference outside those families stays
  `target_mismatch` (genuinely inconsistent link). Tests: direct catalog hit + approved submission,
  in-family vs out-of-family.
- **F3 Decisions follow the item** (Codex #4): the admin usage correction (one server call) deletes
  `discovery_call_decisions` rows whose `intake_item_id` is the moved item (and the decision rows of
  the destination step if they referenced a different item that is no longer bound there). Tests:
  a kept and a swapped item moving to another role/category.
- **F4 Legacy hash stability** (Codex #5): project `usage_role`/`product_type` into the item object
  ONLY when non-null (canonicalize omits `undefined`, includes `null`). Golden-hash test from a
  legacy finalized fixture (unchanged), plus a test that a non-null role change moves the hash.
- **F5 Preselection rules + DB checks** (Codex #7): deterministic preselect per family —
  oil: name contains „Kopfhaut|Scalp" → Kopfhaut, „Pre-?Wash|vor der Wäsche|Kur" → vor der Wäsche,
  „Finish|Glanz|Serum" → Finish, else „Nach der Wäsche"; care family: the detected product type;
  shampoo family: detected type. Pure function, rule-ID fixtures. SQL CHECK: non-null `usage_role`
  only with its permitted category (oil roles with `oil`, `scalp_flake_oil_adjunct` with
  `scalp_care`); `none` rows have no role and no product_type. Invalid-pair tests.
- **F6 PDF shows usage ≠ type briefly** (Codex #8): owned product line gets „als Maske benutzt"
  (usage label) when usage differs from product type; included in the hash via the printed label
  (batch 4 hashes printed labels) — legacy documents unchanged because legacy items have no
  difference by construction (usage = tile = what was printed).

### Unchanged from Rev. 2
Identity ≠ usage split, no submission-category sync, R9/R10, vacated category → `none` on submitted
intakes (Nick), finalize blocked while any item has unknown usage (Nick), catalog authority for
product type (P2-6), Variante A UI, migration applied before deploy.

### Final task list
1. Migration: `category` nullable (usage), new `usage_role`, new `product_type`, CHECKs (F5),
   `none` constraints. Backward compatible. Write, don't apply.
2. Pure logic, test-first: classifier + preselection (F5), family map for legitimate differences (F2).
3. Participant API: capture with product_type + usage (+role), unknown path without submission (F1),
   usage PATCH (draft), submit-with-confirm (single call). App-level draft checks.
4. Participant UI (Variante A; usage sheets; review; Danke); delete tile UI.
5. Cockpit + research route + verdict loader + PDF: F1–F4, F6, „Kategorie offen" (type + usage),
   admin usage correction (refuse while finalized; decisions reset F3; vacated → none), finalize
   block. Batch 4 must be merged first; rebase.
6. Docs (runbook, local-qa).

---

## Rev. 2 (2026-09-24) — superseded by Rev. 3 where they conflict

Inputs: Codex plan review of Rev. 1 (verdict "not ready", P1×5 + P2×1) and Nick's follow-up rulings
(R9/R10 CONFIRMED by Nick 2026-09-24).

### New rulings

- **R9 Usage question instead of category question** (Nick 2026-09-24, confirmed):
  the add-time question asks HOW she uses the product, with the detected answer preselected (one tap
  to confirm). Families:
  - Oil → „Wann benutzt du das Öl?": Vor der Haarwäsche (`oil`/`pre_wash_fibre_treatment`) ·
    Nach der Wäsche ins feuchte Haar (`oil`/`leave_on_fibre_conditioning`) · Als Finish ins trockene
    Haar (`oil`/`dry_finish`) · Auf die Kopfhaut (`scalp_care`/`scalp_flake_oil_adjunct`).
  - Conditioner/Maske/Leave-in → „Wie benutzt du das?": Kurz einwirken & ausspülen (`conditioner`) ·
    Länger einwirken als Kur (`mask`) · Bleibt im Haar (`leave_in`).
  - Shampoo/Tiefenreinigung → „Wie oft benutzt du das?": Bei jeder Wäsche (`shampoo`) ·
    Ab und zu zur Tiefenreinigung (`deep_cleansing_shampoo`).
  - Heat protectant, dry shampoo, bondbuilder, scalp care: no question.
  - Unknown → „Was ist das?" chips + „Weiß ich nicht".
- **R10 Post-submission changes only in the cockpit** (admin), never by the participant reopening.

### Core model change: product identity ≠ usage

- **Product identity** (what the product IS): catalog product (`products.category_key`) or research
  submission (`product_submissions.category`). Never changed by the participant's usage answer or by
  a cockpit usage correction.
- **Usage** (how SHE uses it): `discovery_intake_items.category` (+ new nullable `usage_role` for
  multi-role categories: oil 3 roles; scalp oil → `scalp_care`). Drives routine binding only.
- Consequence: **no submission-category sync anywhere** (removes Rev. 1's PATCH-sync design and
  Codex P1-4 entirely). The research submission's category = the detected PRODUCT TYPE (classifier /
  catalog / Nick's cockpit assignment for unknowns), independent of usage. A usage-vs-product-type
  difference is shown in the cockpit explicitly („Benutzt als Maske · Produkt: Conditioner"), which
  replaces relying on `target_mismatch` for submissions (Codex P1-4 last point).

### Fixes for Codex findings

- **P1-1 unknown products must not enter research early:** discovery gets its own typed-product
  capture that does NOT call `/api/scan/submit` when the answer is „Weiß ich nicht": the item is
  stored with `category = null`, no submission. Known product type → submission created at add time
  with the product-type category (as today). `ScanSearchSheet`'s typed form gains a discovery mode
  (or the discovery entry renders its own typed form) so „Weiß ich nicht" can complete capture.
  Changing usage to unknown later never touches an existing submission (identity ≠ usage).
- **P1-2 submit must freeze answers:** enforce draft state at the DB write boundary: participant item
  insert/update/delete go through SECURITY DEFINER RPCs (or a trigger on `discovery_intake_items`)
  that lock the parent `discovery_intakes` row `FOR UPDATE` and refuse when `state <> 'draft'`;
  submit-with-confirm is one RPC that locks the same row, inserts the `none` rows and flips state.
  Two-session race tests (add/delete/PATCH vs confirm) against PGlite or equivalent.
- **P1-3 admin usage correction after submission:** one admin RPC that locks the intake row,
  refuses while finalized (require „Finalisierung aufheben" first — reuse the sibling's
  frozen-while-finalized rule), updates the item's usage, deletes a `none` row in the destination
  category, and — when the vacated category has no product left on a SUBMITTED intake — inserts a
  `none` row there (Nick 2026-09-24: her „Stimmt so – abschicken" confirmed the whole list as
  complete, so a misfiled product's old category is honestly empty → „benutzt sie nicht"; „nicht
  angegeben" stays only for drafts/legacy intakes). Tests for each.
- **P1-5 `category_unknown` must not vanish** (Nick confirmed the hard block 2026-09-24 as a forcing mechanism: every product understood before the participant gets a result): finalization is **blocked** while any item has
  `category = null` (cockpit shows „Erst Kategorie festlegen" on the Finalisieren control). The
  cockpit summary lists these items under „Kategorie offen". The PDF therefore never sees them.
  Test the block + the summary.
- **P2-6 catalog authority:** whenever a capture carries a catalog `productId` (search, barcode, dm
  `already_in_catalog`, typed `already_in_catalog`), the PRODUCT TYPE comes from
  `products.category_key`; the usage question (R9) then maps it to usage.

### Migration (replaces Rev. 1's)

- `discovery_intake_items.category` nullable; CHECK kept for non-null; `none` rows require a
  category; new nullable `usage_role text` with CHECK against the known oil/scalp roles (verify the
  exact role keys in code; only set for multi-role categories).
- Draft-boundary RPCs/trigger (P1-2) and the admin usage RPC (P1-3), with grants restricted to
  service_role (precedent: PayPal trial grants bug — verify EXECUTE grants explicitly in a test).
- Backward compatible with current prod code (it never writes NULL/`usage_role`; if the trigger
  variant is chosen, current prod writes must still pass while `state = 'draft'`). Apply before deploy.

### Routine binding with usage_role

`reduceIntakeItemsToSteps` binds an item to the step with the same `(category, role)` when
`usage_role` is set, else by category FIFO as today. Hash includes `usage_role` via the bound item.

### Updated tasks

1. Migration (nullable category, usage_role, draft-boundary enforcement, admin usage RPC) + tests.
2. Classifier + usage-question mapping (pure, test-first, rule-ID + adversarial fixtures).
3. Participant capture/API through the draft-boundary RPCs; discovery typed capture without scan
   submit for unknowns; submit-with-confirm RPC.
4. Participant UI (Variante A pills show usage; usage sheets; review; Danke).
5. Cockpit: identity-vs-usage display, „Kategorie offen" + category set (creates the research
   submission — reuse batch 4's research route), admin usage correction (unfinalize required),
   finalize block, usage_role binding.
6. Docs.

Rev. 1 below remains as background; where it says "sync the submission category", Rev. 2 removes it.

---

Status: Rev. 1 (2026-09-24), all product decisions ruled by Nick. Implementation starts after batch 4
(`codex/discovery-cockpit-depth`) merges — both touch `src/lib/discovery/cockpit.ts` and the cockpit
page; rebase this branch onto that merge first.

Prototype evidence (Variante A chosen): https://claude.ai/artifact/PfrEJBL5A7CygadVzBSbBv

## Goal

Participants add product after product in one flat list (search, scan, type). The system files each
product under a category automatically, asks only when ambiguous, and a final review screen lets the
participant correct categories and confirm the categories they left empty. No category tiles, no
per-category „benutze ich nicht".

## Rulings (Nick, 2026-09-23/24 — do not reopen)

- R1 Flat list; no category tiles; no per-category „benutze ich nicht".
- R2 Auto-classify: catalog + barcode hits use `products.category_key`; dm results and typed names
  use name classification. Ask only when ambiguous or unclassifiable.
- R3 Oil → „Wofür benutzt du das?" [Für die Längen → `oil`] [Für die Kopfhaut → `scalp_care`].
- R4 Unclassifiable → „Was ist das?" category chips **plus „Weiß ich nicht"** (category stays unknown).
- R5 Variante A: each list item shows its detected category as a tappable coral pill; tap opens the
  same chip sheet (incl. „Weiß ich nicht"). Current category highlighted plum.
- R6 Final review „Passt das so?": products grouped by category (unknown group „Weiß ich nicht"
  last), each tappable to change; below „Nichts eingetragen für: …" with coral
  „Stimmt so – abschicken" and text button „Noch was ergänzen" (back to list). Confirming = the
  participant states she uses nothing in those categories → explicit `none` rows.
- R7 „Weiß ich nicht" items: no research submission until Nick sets the category in the cockpit;
  cockpit shows „Kategorie offen" with a category select; then batch 4's „Recherche starten" works.
- R8 Research stays local (review center). Minimal, telegram German, „du", one primary CTA per screen.

## Current state (verified 2026-09-24 on 2a1f3add)

- `discovery_intake_items.category text NOT NULL CHECK (category IN (…))`
  (`supabase/migrations/20260922120000_discovery_call_toolkit.sql:76`); unique `none` per
  `(intake_id, category)` (`:131`).
- Participant UI: `src/components/discovery/intake/discovery-intake-checklist.tsx` (tiles, groups,
  submit CTA) + `discovery-product-entry.tsx` (per-category entry: search sheet, barcode, typed
  research form); category comes from the opened tile, catalog/barcode `category` is discarded
  (`discovery-product-entry.tsx` `handleCatalogResult`, barcode path).
- APIs: `POST /api/beratung/intake/items` (body carries `category`), `DELETE …/items/[itemId]`,
  `POST /api/beratung/intake/submit` (needs ≥1 answered category since PR #605).
- Research submissions (`product_submissions.category NOT NULL` FK) are created at add time for
  typed/dm items, via the scan-search research intake form.
- Classifier: `suggestCategoryFromRetailerName` (`src/lib/scan/enrichment/suggest-category.ts`) —
  keyword match, single match or `null`; never returns `bondbuilder`.
- Cockpit routine reduction binds items to steps by `item.category`
  (`src/lib/discovery/refined-routine.ts` `reduceIntakeItemsToSteps`).

## Design

### Data (one migration)

- `discovery_intake_items.category` → nullable. Keep the CHECK for non-null values. A `none` row must
  have a category (`CHECK (source <> 'none' OR category IS NOT NULL)` — verify the actual `source`
  column/value naming). Existing indexes keep working (NULLs never collide).
- No new columns. Backward compatible: current prod code never writes NULL → apply before deploy.

### Classification (pure, test-first) — `src/lib/discovery/classify.ts`

`classifyDiscoveryProduct(input) → { category: PersonalPlanCategory | null, ask: "oil_use" | "what_is_it" | null }`

- Catalog/barcode hit with `category_key`: that category; `ask = "oil_use"` when it is `oil`
  (the catalog `oil` row can still be used on the scalp — R3), else `null`.
- dm result / typed name: `suggestCategoryFromRetailerName(name)`; `oil` → `ask = "oil_use"`;
  `null` → `ask = "what_is_it"`.
- `oil_use` answer mapping: Längen → `oil`, Kopfhaut → `scalp_care`.
- Rule-ID fixtures for every branch (feedback: author-green tests are not evidence — include an
  adversarial fixture set: „Kopfhaut-Öl", „2in1 Shampoo & Spülung", „Haarkur Leave-in", brand-only
  names, empty string).
- Decision for the implementer to surface, not decide: whether a catalog `scalp_care` oil
  (e.g. scalp oil) also asks — default no (catalog category is authoritative except `oil`).

### Participant API

- `POST /api/beratung/intake/items`: `category` becomes optional in the body; server re-derives the
  category for catalog/barcode items from `products.category_key` (client value ignored for those,
  except the oil_use answer which may turn `oil` into `scalp_care`). Typed/dm items: client-sent
  category (from classifier or the participant's chip) or `null` („Weiß ich nicht").
  Research submission creation stays at add time when a category is known; skipped when `null`.
- New `PATCH /api/beratung/intake/items/[itemId]` `{ category | null }`: draft-only, ownership as the
  existing DELETE. If the item has a research submission still `pending_review` with no running job,
  update the submission's category too; otherwise leave the submission (cockpit `target_mismatch`
  already surfaces divergence). Changing to `null` never deletes a submission. If the item had no
  submission and gets a category, create the submission then (same function as add time).
- `POST /api/beratung/intake/submit` gains `{ confirmNoneForMissing: true }`: in ONE server-side step
  (RPC or single transaction) insert `none` rows for every supported category with no item, then
  mark submitted. Unknown-category items count as products (≥1 product required) but not toward any
  category. Without the flag: current behavior (legacy clients).
- Remove the per-category none endpoint usage from the participant UI (keep the server path if the
  cockpit/legacy needs it; delete if unused — grep first).

### Participant UI (`/beratung/produkte`)

- Replace tiles with the flat list (prototype Variante A): header „Deine Produkte" / lede
  „Trag ein, was du benutzt.", search field (reuse `ScanSearchSheet`: catalog + dm lanes, image +
  brand + line + name as in PR #605), „Scannen", „Nicht gefunden? Namen eintippen".
- Each item card: packshot (existing `imageUrl`), label, coral category pill (or „Weiß ich nicht"),
  remove X. Pill → chip sheet (10 categories + „Weiß ich nicht"; current in plum).
- Oil question sheet and „Was ist das?" sheet at add time per R3/R4.
- Sticky coral „Fertig" once ≥1 product → review screen „Passt das so?" (R6) → „Danke".
- Resume: a returning participant with a draft lands on the list with her items; a submitted intake
  shows the Danke state (current behavior).
- Delete now-unused tile/group components; keep `categories.ts` labels/order (review grouping +
  cockpit).

### Cockpit (admin)

- Product list (batch 4 section): `category = null` → „Kategorie offen" + category `<select>` →
  new admin `PATCH /api/admin/beratung/[enrollmentId]/items/[itemId]` (gates as batch 4's research
  route: same-origin → kill switch → requireAdmin → ownership), same submission rules as the
  participant PATCH; allowed after submission (admin override).
- Routine reduction: `null`-category items bind to no step → unassigned with a new reason
  `category_unknown` (next to `research_pending` / `no_ideal_step`); they are part of the finalize
  hash via the existing unassigned list.
- With R6 confirmation, missing categories are explicit `none` → existing „benutzt sie nicht" line;
  „Nicht angegeben" remains only for drafts and legacy intakes.
- Legacy intakes (tile model, already submitted) must render unchanged.

## Tasks

1. Migration + types (nullable category, none-needs-category CHECK). Write, don't apply.
2. Classifier `classify.ts` — test-first, rule-ID + adversarial fixtures.
3. Participant APIs: items POST (optional/derived category), items PATCH, submit with
   `confirmNoneForMissing` (atomic). Route tests incl. ownership, draft-only, submission-category sync.
4. Participant UI flat list + sheets + review + Danke; delete tile UI. Render tests for each screen
   state; client mapping tests.
5. Cockpit „Kategorie offen" + admin PATCH route + `category_unknown` reduction. Tests incl. hash.
6. Runbook + local-qa docs; remove stale tile references.

Owner split: 1–3 one Opus implementer (coupled); 4 after 3 (same implementer or second Opus with
disjoint files: `src/components/discovery/intake/**`, `src/app/beratung/produkte/**`); 5 after
batch-4 rebase. Main session reviews every diff.

## Verification

- `npm run typecheck`, `lint`, `test:node`, `ci:verify` on the final tree.
- Codex whole-branch review (read-only) before push.
- Rollout gate: apply the migration to prod BEFORE merge/deploy (backward compatible), verify schema.
- Nick live-tests with a fresh invite: search/scan/type, oil question, „Weiß ich nicht", pill change,
  review + confirm, cockpit „Kategorie offen" → set category → „Recherche starten".

## Open questions (surface to Nick, don't decide silently)

- Q1 Catalog `scalp_care`/other categories never ask (default) — only `oil` asks. OK?
- Q2 Changing a category after research already started: submission keeps its old category (default)
  vs. cancel + resubmit.
