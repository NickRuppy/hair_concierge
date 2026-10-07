# Discovery participant/operator cohort — complete read-only ledger

Scope: `tests/discovery-multi-product.test.tsx` (27), `discovery-add-flow.test.ts` (21), `discovery-participant-flow.test.tsx` (19), `discovery-enrollment-service.test.ts` (18), `discovery-admin-read-model.test.ts` (16), `discovery-research-status.test.ts` (16), and `discovery-concern-recipes.test.ts` (15): **132/132 inventory declarations** from `/tmp/test-audit-final267-declarations.json`. All bodies, local fixtures/harnesses and the listed real owners/routes were read. **R 132, F 0, C 0, D 0.** No coherent redundant lower layer or test-only source seam is supported.

## Actual execution closure

- Participant routes use `src/lib/discovery/participant.ts:11-60` from invitation, continuation, checklist, quiz, and middleware; `/api/beratung/resolve` reads a signed credential, kill switch, revocation and token version at `src/app/api/beratung/resolve/route.ts:34-113`.
- Enrollment storage is `src/lib/discovery/enrollment.ts:74-408`: revocation/version/user predicates, claim compare-and-set, identity-bound email, metadata-stamp refusal/clear, and retryable revocation clear. The live claim handler calls this family after origin/feature/credential/account gates in `src/app/api/beratung/claim/route.ts`.
- Multi-product decisions run through `createDiscoveryDecisionsHandler` in `src/app/api/admin/beratung/[enrollmentId]/decisions/route.ts`; refined binding/composition/cockpit/PDF are real `src/lib/discovery/{refined-routine,cockpit,application}.ts` and component owners, not a fixture-only wrapper.
- Research state is the operator boundary: `src/lib/discovery/research-status.ts:35-388` classifies eligible approved products, retry/exhaustion, and creation input. Its current writer `src/app/api/admin/beratung/[enrollmentId]/research/route.ts:50-176` re-reads state, guards ownership, chooses enqueue/retry/create, handles a concurrent winner, and returns the new status.
- Concern recipes are a research-source contract: `src/lib/discovery/concern-recipes.ts:66-1087` plus `concern-recipe-view.ts:64-235` are consumed in the current admin cockpit read model. The JSON equality assertion is intentional cross-format source parity, not a private export check.
- `package.json:49` includes these top-level files in `test:node`. History clusters are feature commits `c315601d` (toolkit), `2a1f3add` (invites), `224c0d47` (research), `2bb16f10` (flat checklist), `58bd94e1` (main-problem recipes), `6458825e` (frequency/heat), `cf7f4604` (multi-product), and `3a774a20`/`694cb9a6` (runsheet/verdict). These show feature evolution, not retirement.

## Disposition rationale by exact declaration

Every row below is **R**. The line/title are the AST site. A grouping names the actual owner and the escaped regression shared by the rows; titles distinguish the retained input/observation within that owner.

### `discovery-multi-product.test.tsx` — 27 R

Owner groups: `reduceIntakeItemsToSteps` / `composeDiscoveryRefinedRoutine` (binding, independent item decisions, stale fingerprint); decisions route (admin authorization and sibling-scoped writes); application/PDF/cockpit renderers (participant/operator document and correction UI). A faulty binding could cross-product a decision, accept foreign/last-product drops, omit/duplicate PDF entries, or write a sibling's usage. Hash pins preserve finalized-output compatibility and are not duplicate source snapshots.

- **R** `326` — "two shampoos share the one shampoo step as two adjacent entries, most frequent first"
- **R** `337` — "entry order: known frequency descending, unknown/unasked after, then the binding order"
- **R** `367` — "a role-bound leftover joins its own role step; a role or category without a step stays outside"
- **R** `398` — "each product carries its own decision: keep one, drop the other; nothing else moves"
- **R** `420` — "undecided extras stay undecided — a decision about one product never carries to its sibling"
- **R** `437` — "a null-item decision applies only while its step is empty (P2-1)"
- **R** `459` — "a routine with one product per step keeps its pre-batch-9 fingerprint (pinned)"
- **R** `463` — "a routine with a same-category extra fingerprints differently — on purpose"
- **R** `470` — "a usage change stales every step whose SET of products changes, siblings included"
- **R** `497` — "the view: one entry per product, its frequency, the step's size and who may be dropped"
- **R** `530` — "the Idealplan fallback is never offered when she owns that product anywhere in the step"
- **R** `609` — "route: the client names (step, product); the server writes it with the step's siblings"
- **R** `664` — "route: an old tab without intakeItemId works for a single-product step only"
- **R** `682` — "route: a product that is not in that step, an unknown step, a foreign swap target are refused"
- **R** `704` — "route: „Weglassen“ only in a step with ≥2 products, and never the last one"
- **R** `738` — "route: the locked write's own refusals come back as 409s"
- **R** `750` — "application: the step's first entry keeps the decision key, a further one its own id"
- **R** `772` — "application: a dropped product prints nothing; two entries printing one product print it once"
- **R** `808` — "PDF: a single-product routine prints byte-identically to before (pinned)"
- **R** `812` — "PDF: one step, her products in it — kept, swapped or open — each with her frequency"
- **R** `831` — "PDF: only an explicit drop files a same-category product under „Brauchst du nicht mehr“"
- **R** `851` — "PDF: two different products with the same printed name both print (dedupe is by product id)"
- **R** `872` — "PDF: two entries printing the same product print it once"
- **R** `913` — "cockpit: two products in one step, each with its own radio group, „Weglassen“ only there"
- **R** `939` — "cockpit: a single-product step shows no „Weglassen“ and no frequency line"
- **R** `946` — "cockpit: a dropped entry starts selected on „Weglassen“; the refusals read as write errors"
- **R** `962` — "route: each sibling travels with its OWN composed usage — raw roles may differ in one step"

### `discovery-add-flow.test.ts` — 21 R

Owner: `src/components/discovery/intake/add-flow.ts` transition/reducer. Each case observes a different capture/edit transition and resulting POST/PATCH body; regressions can misclassify product type/usage, prefill another product, lose a legacy row, or write before completion.

- **R** `82` — "an ambiguous catalog conditioner asks its usage (detected in plum), then the frequency, then ONE add"
- **R** `105` — "D1: the care question offers the pre-wash conditioner"
- **R** `120` — "a product without a usage question (heat protectant) goes straight to the frequency"
- **R** `132` — "conditioner and leave-in preselect the LATEST shampoo's frequency; nothing else does"
- **R** `151` — "D2: a dm spray without a clear type gets „Wofür nutzt du das Spray?“; styling adds a non-evaluated item"
- **R** `187` — "D2: the leave-in spray answer types the product AND sets its usage"
- **R** `214` — "typed path: „Selbst eintragen“ → „Wie heißt es?“ → „Was ist das?“ → usage → frequency, in one sheet"
- **R** `244` — "typed path from a ghost slot: the slot IS the type (no „Was ist das?“)"
- **R** `255` — "typed path: „Weiß ich nicht“ still asks the frequency, then stores the product type-open"
- **R** `271` — "barcode: the read lands at the pinned-header step, and back goes to the search (not the camera)"
- **R** `297` — "an unknown barcode asks „Was ist das?“ under „Gescanntes Produkt“"
- **R** `313` — "back from the frequency shows her usage answer in plum, not the first preselection"
- **R** `323` — "edit: a card tap opens its usage question with her answer in plum, then PATCHes usage + frequency"
- **R** `337` — "edit: a type-open product answers „Was ist das?“ — type, usage and frequency in one PATCH"
- **R** `356` — "edit: a type-open spray re-asks the spray question"
- **R** `369` — "„Wie oft?“ on a draft from the old checklist opens ONLY the frequency (with the shampoo hint) and PATCHes only it"
- **R** `380` — "edit: a styling product and a fixed type only change their frequency"
- **R** `394` — "a „benutzt sie nicht“ row opens nothing"
- **R** `411` — "edit: a saved styling spray re-opens the spray question with „Styling & Halt“ in plum"
- **R** `432` — "edit: a saved heat-protectant spray can go back to styling"
- **R** `452` — "edit: a catalog heat protectant is no spray answer — frequency only, as before"

### `discovery-participant-flow.test.tsx` — 19 R

Owner: current checklist/add-sheet/routine/heat/final components. Harnesses drive event handlers and capture actual HTTP payload/recovery, not only markup. Each row preserves a customer-visible state, mutation timing, or failure recovery the pure add-flow reducer cannot reach.

- **R** `188` — "„Deine Produkte“: ghost slots in shelf order, her cards in their slot, then the rest and „+ Weiteres“"
- **R** `247` — "the product card: packshot, brand · line, bold name, plum capsule, frequency line"
- **R** `274` — "a draft from the old checklist (no frequency) shows the „Wie oft?“ pill"
- **R** `287` — "search pick → usage → frequency: ONE add with the frequency, the sheet closes, the card lands"
- **R** `356` — "a failed add rolls the card back and brings the sheet back on the frequency, saying so"
- **R** `378` — "the frequency step: every option, the shampoo suggestion in plum with its hint, „Weiß ich nicht“ quiet"
- **R** `428` — "the sheet's steps: pinned product header, the spray question (D2), the typed name form"
- **R** `480` — "„Wie oft?“ opens only the frequency step; its tap PATCHes only the frequency"
- **R** `505` — "„Weiter“ with a product still missing its frequency asks it first instead of moving on"
- **R** `560` — "„Deine Routine“ renders the composer's day cards with cadence pills and product thumbnails"
- **R** `587` — "products → „Weiter“ → routine; a routine product opens its edit sheet; „Noch was ergänzen“ goes back"
- **R** `627` — "heat branching: air drying only skips every tool question; one PUT on the way to the final page"
- **R** `657` — "heat branching: plain föhnen asks only „Wie oft?“; a straightener also asks for heat protection"
- **R** `710` — "the heat questions use production options, icons and photos — and the none options, without sublines"
- **R** `777` — "returning to edit: the flow is prefilled from her saved heat answers"
- **R** `809` — "the final page: three check rows — Fragebogen, products with the Waschtag rhythm, heat tools — no reassurance line"
- **R** `847` — "final page rows lead back: products → „Deine Produkte“, heat → the first heat question; „Abschicken“ submits → done"
- **R** `901` — "a failed submit keeps the final page and says so"
- **R** `924` — "an intake submitted elsewhere lands on the done page instead of an error"

### `discovery-enrollment-service.test.ts` — 18 R

Owner: `src/lib/discovery/enrollment.ts:74-408`. These are persistence/security contracts: live/revoked/version filters, compare-and-set claim/email identity, access-kind preservation, stamp clearing, and failed-clear retry. No UI or route keeper reaches all conditional query predicates and metadata effects.

- **R** `134` — "a load always excludes revoked rows and honours the token version"
- **R** `172` — "the user-scoped load is bound to the claiming account and to a live row"
- **R** `183` — "the state is derived, never stored"
- **R** `190` — "the claim binds only an unclaimed, unrevoked row of the right version"
- **R** `217` — "a second claim by another account loses cleanly and leaves the first binding intact"
- **R** `240` — "re-claiming with the same account is idempotent — the continuation replays it"
- **R** `250` — "a revoked row cannot be claimed"
- **R** `268` — "stamping preserves unrelated metadata"
- **R** `291` — "a foreign access kind is refused, never overwritten"
- **R** `308` — "clearing removes both keys, but only our own access kind"
- **R** `343` — "revoking a claimed enrollment also clears the JWT stamp"
- **R** `370` — "revoking an unclaimed enrollment touches no account"
- **R** `376` — "revoking twice refuses instead of restamping"
- **R** `382` — "a revoke whose stamp clear failed finishes the clear on the next run"
- **R** `436` — "an unclaimed invite binds the typed address under the claim's own predicates"
- **R** `450` — "a claimed invite is never re-bound"
- **R** `459` — "an address another current invite owns reports email_taken, other errors throw"
- **R** `513` — "bind A, bind B, then claim-as-A fails: the row never ends up A's account with B's address"

### `discovery-admin-read-model.test.ts` — 16 R

Owner: ideal-routine/participant-verdict loaders and discovery snapshot recompute. Each row checks a read-only RPC/loader boundary, error code, batching/quarantine behavior, or initial/refined fallback. Route tests begin after these read-model decisions.

- **R** `199` — "the ideal-routine loader touches exactly the documented source RPC — no publish, no write"
- **R** `265` — "the ready path builds steps from the prepared context and still writes nothing"
- **R** `317` — "discoveryPreviewInput is the intake-scoped plan id and the prepared context's version"
- **R** `324` — "the loader's own output echoes the two ids the preview computation actually ran under"
- **R** `347` — "a profile without a usable scanner source reports no_usable_source, not an error"
- **R** `359` — "participant verdicts: resolved product yields a presented verdict with a header and no savedState"
- **R** `380` — "participant verdicts: an item with no resolved product is skipped entirely"
- **R** `400` — "participant verdicts map the per-item failure modes instead of throwing"
- **R** `448` — "participant verdicts drop quarantined alternatives and batch the catalog read once"
- **R** `479` — "participant verdicts: a scanned product missing from the catalog read reports unavailable"
- **R** `502` — "the production verdict wiring is the resolve route's own engine"
- **R** `531` — "the production loaders carry the discovery error codes"
- **R** `576` — "override on the initial path: recomputed with her answers, heat protectant in, still no write"
- **R** `617` — "„Hauptproblem“ profile facts read the snapshot actually used: with the override, her real heat answers"
- **R** `636` — "a refined participant keeps her Feinschliff: the override is ignored"
- **R** `653` — "a recompute that is not ready falls back to the prepared snapshot, never an error"

### `discovery-research-status.test.ts` — 16 R

Owner: `src/lib/discovery/research-status.ts:35-388`, used by the current admin research writer. Rows partition eligibility/status/lease/attempt and creation input; a wrong action can enqueue impossible work or research a usage rather than product type.

- **R** `77` — "only a resolved status with an eligible product resolves"
- **R** `119` — "eligibility is only asked about resolved submissions' products"
- **R** `131` — "approved, eligible research becomes the item's effective product — nothing else does"
- **R** `178` — "a catalog product is „Im Katalog“, with nothing to start"
- **R** `184` — "approved research reads „Freigegeben“; approved-but-ineligible says why it is not used"
- **R** `195` — "closed research is named and offers nothing"
- **R** `204` — "an active job names its stage in short German and offers nothing"
- **R** `226` — "a failed or blocked job is retried — the enqueue RPC would hand the stuck job back"
- **R** `243` — "a job out of attempts is named as such and offers no button a worker would never honour"
- **R** `277` — "a final-attempt running job whose lease expired is exhausted; a live lease still runs"
- **R** `300` — "an open submission with no live job is enqueued"
- **R** `312` — "the review's own states win over a finished job"
- **R** `328` — "an item without a submission creates one — when there is enough to research"
- **R** `355` — "an unreadable research state says so and offers nothing"
- **R** `365` — "the submission a research start creates uses the scan lanes' own inputs"
- **R** `388` — "F1: a research start uses the PRODUCT TYPE, never her usage; a legacy row falls back to its tile"

### `discovery-concern-recipes.test.ts` — 15 R

Owner: typed research recipe table plus profile/view projection. Rows guard JSON parity, medical hair-loss boundary, three-valued gates, snapshot interpretation, ownership coverage, and German operator output. The JSON and quiz vocabularies are independent source contracts.

- **R** `36` — "the TS table equals recipes.json, the research's source of truth"
- **R** `41` — "every quiz concern has exactly one recipe, and nothing else does"
- **R** `48` — "hair loss stays a boundary: no product category anywhere in its recipe"
- **R** `58` — "`when`: OR within a key, AND across keys"
- **R** `82` — "`when`: an unknown fact makes the gate „prüfen“ — unless a known fact already fails it"
- **R** `146` — "profile facts come from the Idealplan's own snapshot"
- **R** `169` — "damaged = lightened/permed/straightened, or snaps, or a rough surface"
- **R** `179` — "heat styling: weekly or more counts, rarer does not, unknown stays unknown"
- **R** `188` — "heat styling counts only styling heat — plain blow-drying does not"
- **R** `198` — "no readable snapshot: every fact is unknown, nothing throws"
- **R** `205` — "coverage: „hat sie“ reads her products (usage or type), „Idealroutine“ reads the steps"
- **R** `226` — "the view keeps only the conditionals that apply or need checking"
- **R** `255` — "a category that applies through one gate is not also listed as „prüfen“"
- **R** `266` — "the recipe's copy comes through unchanged, with evidence labels"
- **R** `286` — "hair loss renders as a boundary only — no product list"

## Candidate and transfer result

`/tmp/test-audit-discovery-participant-operator-machine-candidates.json` contains `[]`. No assertion can be transferred to an *existing stronger* keeper without losing a distinct binding, transport, persistence, authorization, worker-state, or user recovery observation. No source/support deletion is unlocked.

## Limits and non-claims

- This was static evidence only: no Node/Playwright runner, provider, Supabase, credentials, environment load, or operator command was used. A focused command if an independently proven change later exists is `node --import ./tests/server-only-register.cjs --import tsx --test` followed by the seven listed test paths; it was **not run**.
- The client component harnesses call real local handlers and capture `fetch`, but do not prove browser rendering, live authentication, DB writes, or worker execution. That limitation is a reason not to delete their independent UI/recovery or service predicates.
- Existing broader Discovery UI/runsheet ledgers were used only for keeper orientation; no declaration was treated as redundant merely because it concerns the same intake or cockpit feature.
