# Discovery cockpit + PDF: several products per routine step — Plan Rev. 2

Status: Rev. 2 2026-09-27 — Codex plan review (verdict: rework; 3×P1 + 2×P2) folded in, see
„Review log". Drafted 2026-09-27, Nick approved the direction in chat („perhaps they really also use
both — how do we do this?"). Worktree `.worktrees/discovery-multi-product`, branch
`codex/discovery-multi-product`, base `origin/main` feb9284c.

## Problem

`reduceIntakeItemsToSteps` (`src/lib/discovery/refined-routine.ts:227`) binds at most ONE intake
product per Idealroutine step. A second product of the same category (two shampoos, three
leave-ins) becomes `unassigned` / `no_ideal_step`:

- cockpit: only a grey „— kein Schritt im Idealplan: <name>" line, no verdict, no decision;
- PDF: printed under „Brauchst du nicht mehr — Diese Produkte kommen in deiner Routine nicht
  mehr vor." — a claim nobody made in the call.

Which product wins is `bindingOrder` (catalog-resolved → source rank → created_at), unrelated to
how she actually uses them. The participant flow („Deine Routine") already shows all of them and
is NOT touched by this plan.

Prod evidence (read-only, 2026-09-27): 3 of 12 intakes have same-category duplicates —
Chiara 732265fb (finalised; 2× shampoo, 2× conditioner, 2× leave-in), Emilia ce6f9b89
(3× leave-in, not finalised), test +beratung7 4f344d64 (2× shampoo).

## Rulings (Nick, chat 2026-09-27)

- R1 No „main product". Every product she uses sits in its step, equal, each with its own
  verdict and its own decision.
- R2 Frequency is display order only (most frequent first), never a rule.
- R3 „Weglassen" (drop) exists only in a step holding ≥2 of her products. Only an explicit drop
  puts a same-category product under „Brauchst du nicht mehr".
- R4 Participant flow unchanged.

## Design

### D1 Binding: step entries instead of one item per step

Keep the refined routine a flat list, but let one Idealplan step contribute several entries:
`DiscoveryRefinedStep` stays the per-product unit (step + item + outcome + labels); entries of
the same step share `step` / `decisionKey` and are adjacent.

`reduceIntakeItemsToSteps`:
1. First pass unchanged: role-bound items to their (category, role) step, then positional per
   category — so every intake that fits today binds exactly as today.
2. NEW: every leftover that today becomes `no_ideal_step` joins the FIRST step of its category
   (and role, for role-bound items) as an additional entry. Only items whose category/role has
   no step at all stay `no_ideal_step` (genuinely outside the Idealplan — unchanged behaviour).
3. Entry order within a step: known frequency descending (`compareProductFrequencies`), then
   `bindingOrder`. Unknown/unasked frequency sorts after known.

`DiscoveryStepBinding` becomes `{ step, item }[]` with possibly repeated `step` (or
`{ step, items }` internally — implementer's choice, the exported refined list is flat).

### D2 Decisions: one per (step, product)

Migration `2026092712xxxx_discovery_call_decisions_per_item.sql` (check the latest version on
main first — version-collision lesson):
- drop `UNIQUE (intake_id, decision_key)`; add
  `UNIQUE NULLS NOT DISTINCT (intake_id, decision_key, intake_item_id)` (PG 17) — the null item
  keeps „one decision for an empty step";
- `decision` CHECK → `IN ('keep', 'swap', 'drop')`; swap pair CHECK unchanged
  (drop ⇒ no swap product);
- `intake_item_id` FK `ON DELETE SET NULL` → `ON DELETE CASCADE` (two rows of one step whose
  items get deleted would otherwise collide on the new unique key; a decision about a deleted
  product means nothing).
- Existing rows are compatible: the server always wrote the bound item's id.

Composition matches decisions by `(decisionKey, item?.id ?? null)` instead of `decisionKey`.
New outcome `dropped` (only reachable via `drop`).

Writes go through a NEW RPC `discovery_admin_set_call_decision(target_intake_id,
decision_key, target_item_id, decision, swap_product_id, sibling_item_ids uuid[])` in the same
migration (replaces the supabase-js upsert in `upsertDiscoveryCallDecision`), SECURITY INVOKER,
`search_path = ''`, service-role EXECUTE only, like the usage RPC:
- `SELECT … FROM discovery_intakes … FOR UPDATE` first — the same row lock
  `discovery_admin_set_intake_item_usage` takes, so decisions and usage changes serialize per
  intake (Codex P1-3);
- refuses when not submitted / finalised (as the route does today);
- sibling invariants checked INSIDE the lock against the stored rows of that `decision_key`:
  `drop` needs ≥1 item in `sibling_item_ids` (the server's current binding of that step, minus
  the target) without a `drop` row → else `drop_last`; `swap` to a product another row of the
  same key already swaps to → `swap_taken`;
- then `INSERT … ON CONFLICT (intake_id, decision_key, intake_item_id) DO UPDATE` — the
  NULLS NOT DISTINCT unique makes the null-item row of an empty step conflict too (SQL-execution
  test proves it).

Null-item decisions (Codex P2-1): a decision with `intake_item_id IS NULL` applies ONLY while its
step has no entries. When a product later binds to that step (a usage change, or research
resolving a pending product), the null row is ignored — the new entry shows undecided — and it
is cleared on the next usage change (stale key) or left inert. Tested both ways.

`POST /api/admin/beratung/[enrollmentId]/decisions`:
- body gains `intakeItemId: uuid | null` (optional for a deployed old tab: accepted when the step
  has exactly one entry, else 409 `item_required`);
- the server finds the entry `(decisionKey, intakeItemId)` in the freshly composed view; unknown
  pair → 409 as today's unknown step;
- `drop` only when the step has ≥2 entries with items AND at least one sibling is not dropped
  (409 `drop_last`); `drop` on a single-entry step → 409 `drop_single`;
- `swap` target: that entry's own options (its verdict alternatives; fallback the Idealplan
  pick unless she owns it in this step); the cockpit hides targets a sibling already swapped to;
- the route validates membership, `drop_single` and swap options from the fresh composition,
  then calls the RPC with `sibling_item_ids`; the RPC's `drop_last` / `swap_taken` / `finalized`
  outcomes map to 409s.
- finalised intakes stay locked as today.

Usage changes (`discoveryStaleDecisionKeysForUsageChange`, `cockpit.ts:1113`): compare the SET of
item ids per decision key before/after; any changed set marks the key stale (the RPC deletes the
moved item's rows plus all rows of stale keys — no RPC change). Conservative: siblings of a
changed step are re-decided.

### D3 Hash / finalised plans

`discoveryRoutineSourceHash` keeps hashing the flat entry list. A step with 0–1 entries produces
exactly today's object, so every intake without same-category duplicates keeps its finalised
fingerprint (test: fixture hash of a legacy single-item routine is byte-identical).

Intakes WITH duplicates change hash on purpose (the extra products move from `unassigned` into
the step, undecided). Affected in prod: Chiara's finalised plan → the PDF shows the drift banner
and her extra shampoo/conditioner/leave-in appear as „Noch offen" in the cockpit. Nick decides
whether to re-decide and re-send her PDF (see Open points).

### D4 Cockpit (`discovery-call-cockpit.tsx`)

- Steps grouped by `decisionKey`: step header once (category, role, plan frequency), then one
  block per entry: her product name + her frequency („3–4× pro Woche"), verdict + comparison
  table, decision radios `Behalten` · swap options · `Weglassen` (only when R3 allows).
- Selection state, radio `name`s and React keys all keyed per entry
  (`${decisionKey}:${intakeItemId ?? "-"}`) — today they use `decisionKey` alone
  (`discovery-call-cockpit.tsx:268-295`, `:434-454`), which would make two products' radios one
  group (Codex P2-2). POST carries `intakeItemId`. Verified in the rendered cockpit: both
  products hold independent selections.
- `DiscoveryCockpitStepView` stays per entry; add `ownedFrequencyLabel: string | null`,
  `canDrop: boolean`, `stepEntryCount: number` (or equivalent).
- The „kein Schritt im Idealplan" line now only lists products whose category has no step, plus
  explicitly dropped ones are NOT listed there (they show inside their step as „Weglassen").
- Finalise gating unchanged: an undecided entry prints „Noch offen", exactly like an undecided
  step today (no new gate).

### D5 PDF (`discovery-routine-document.tsx`)

- `printSteps` groups entries by `decisionKey`: one step block, product lines for each
  non-dropped entry (kept → her product, swapped → the swap product, undecided → „Noch offen").
  Her frequency is printed next to a product only when the step shows ≥2 products (tells them
  apart); single-product steps render exactly as today.
- Two entries swapped/kept to the same catalog product print once.
- `shelfEntries`: one row per entry (already per entry after D1).
- „Brauchst du nicht mehr": `no_ideal_step` products (category without step) + `dropped`
  entries. Nothing else.
- Application („So wendest du es an"): `discoveryApplicationCandidates` flat-maps entries, but
  today sets `itemId` AND `applicationInstanceKey` to `decisionKey` (`application.ts:124-125`),
  and the compiler filters conflicting products BY `itemId` (`compiler.ts:403-404`) — two entries
  would share it and one conflict would drop its sibling (Codex P1-1). Fix: the step's FIRST
  entry keeps `decisionKey` (legacy hash of the application section unchanged), every further
  entry uses `${decisionKey}#${intakeItemId}`. Exclude `dropped`; dedupe identical printed
  products after compilation, not by sharing ids. `applicationGaps` then covers every printed
  product. Test: two distinct products in one step, one with a conditioner-relationship
  conflict — the sibling survives.

## Tasks (TDD for the deterministic parts)

1. Tests first (`tests/discovery-refined-routine.test.ts`, `tests/discovery-cockpit-model.test.ts`,
   `tests/discovery-cockpit-usage.test.ts`, `tests/discovery-cockpit-api.test.ts`,
   `tests/discovery-pdf-page.test.tsx`, `tests/discovery-application.test.tsx`):
   - two shampoos → one step, two entries, frequency order, both with verdicts;
   - role-bound leftover joins its role step; category without step stays `no_ideal_step`;
   - legacy single-item routine: hash byte-identical to a pinned value;
   - decisions keyed per item; drop rules (single, last); swap_taken; old-tab body without
     `intakeItemId`;
   - usage change: set-based stale keys;
   - PDF: multi-product step, dropped → „Brauchst du nicht mehr", undecided extra → „Noch offen",
     single-product step output unchanged; application dedupe + dropped excluded.
2. Migration + migration/SQL-execution tests (`tests/discovery-call-toolkit-sql-execution.test.ts`
   pattern): unique with nulls, drop CHECK, cascade, upsert conflict inference.
3. Binding + composition + hash (refined-routine.ts, application.ts).
4. Read model + route (cockpit.ts, decisions/route.ts).
5. Cockpit UI + PDF.
6. `npm run ci:verify`; drive the cockpit locally with a two-shampoo intake (dev login,
   `docs/local-qa-access.md`) incl. keep/swap/drop and the PDF page; screenshots in PR.

Routing: one Opus implementer (tightly coupled, one unit). Codex whole-branch review, confirm
pass only after non-trivial P0/P1 fixes.

## Rollout (Codex P1-2)

No mixed-version window is safe: old code upserts with `onConflict: "intake_id,decision_key"`
(`cockpit.ts:1015-1027`), which the migration removes; new code calls an RPC that does not exist
before it. The cockpit has one user (Nick), so a coordinated cutover instead of expand-contract:
1. Nick does not use the cockpit during the cutover (~5 min).
2. Merge → wait until the Vercel production deploy is READY → apply the migration immediately
   via Supabase MCP `apply_migration` → verify constraints + RPC exist.
   (Between deploy-ready and migration, new-code decision writes fail loudly with a 500 — no
   data is written wrong; reads are unaffected in both directions.)
3. Post-cutover: open Chiara's and Emilia's cockpits, one keep/drop write on a test enrollment,
   check Sentry.

## Rulings on open points (Nick, 2026-09-27)

- O1 Chiara's plan was a test (Nick's sister) — no re-send; the drift banner is fine.
- O2 Finalise gating stays as today: undecided products print „Noch offen"; no new gate
  (Nick: not realistic to have everything resolved before finalising).
- Go to build.

## Non-goals

Participant flow, „Deine Routine", routine engine inputs, concern-recipe coverage markers, the
Idealplan's step set (no new steps are created — extras join existing steps).

## Review log

- Codex plan review 2026-09-27 (`--effort high`, read-only): verdict rework. Folded in:
  P1-1 application ids per entry (D5); P1-2 no mixed-version rollout → coordinated cutover
  (Rollout); P1-3 sibling invariants + usage changes serialized in one locked RPC (D2);
  P2-1 null-item decisions defined (D2); P2-2 per-entry radio names/keys (D4). Codex confirmed
  the single-item hash invariant, the NULLS NOT DISTINCT key, the cascade and conflict
  inference as sound (subject to the SQL-execution test).
