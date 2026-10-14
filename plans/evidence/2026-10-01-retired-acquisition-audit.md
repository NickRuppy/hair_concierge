# Retired acquisition presentation audit

Baseline: `21e0e41fa996ec6a725c258ab3766971f0edb94d`. The initial recorded
Production deployment `6761940871` matched it. Refreshed on 2026-10-02: the latest
recorded successful Production deployment is `6781282517` at
`3abfe00a7843882f01009de701affa7b1dff697f`. Inspected its current source and exact
diff: offer registry/mapping, result routes, tracker owner/caller, waitlist
closure/recovery and retired Stage5 entry point are unchanged. Retained-source
references to removed modules are only the two old type-only focus imports,
explicitly relocated by this patch. No available renderer was reintroduced.
Source audit, not traffic-volume inference or alias/rollback-state verification.
No deployment or production write. Full test/coverage proof uses the original
audit baseline; this worktree has not incorporated the newer upstream profile
changes and their additional tests.

## Lifecycle evidence

Q — Saved default/app-value-stack/guided-story offer IDs are mapped by
src/lib/funnel/offer-presentation.ts:1-15 to organic-plan-v1. The generated
src/funnels/offers/registry.generated.ts contains no retired renderer; current
result-client uses that registry. Each removed root has no importer outside its
exclusive old subtree/tests. Complete import/string/ref and history inspection
distinguishes this quiz presentation from the separate Personal Plan chapter
cohort. The old aggregate preview/copy/chat-demo/tracker-proof/result-card/brand
panel does not serve a reachable feature. Keep shared priorities/products,
portrait Lab, prepared-plan and Customer.io owners. Risk: hidden constructed
import or an active shared primitive previously tested only through a dead
aggregate. Check compilation/build, keepers, and surviving-file coverage.

W — Trial-launch plan and commit `318cf157` explicitly retired NEW waitlist signup.
src/app/api/waitlist/route.ts returns 410; /warteliste and /warteliste/b are closed
entry pages. Removed landing/form/modal have no route importer and submit only
to the retired endpoint. Historic survey/thanks/storage/outbox/access survive.
Keep waitlist-api-routes, waitlist-backend, waitlist-analytics-security and active
waitlist-ui assertions, plus the unchanged waitlist browser closure/recovery spec.
Risk: hidden alternate entry; local current-handler tests and reference audit
must remain green.

No stronger proof is needed for removed _exclusive_ presentation contracts:
their owners are already disconnected and retired. Their shared live dependencies
retain independent tests. The installed test-audit skill explicitly directs
removal of obsolete owners/test-only production seams together with their tests.
Candidate confidence comes from current consumers plus retirement/registry evidence.

## Cutover

Exact 22 source / 14 test-file map: plan's Exact cutover map. Source removals total
3,111 lines; the two surviving source edits only move the identical type union
to FunnelOfferFocusTarget in src/funnels/types.ts, imported by result-client.
No live URL is changed. Remove 64 old declarations: 62 quiz + 2 waitlist. Two
tracker-owned declarations preserve live assertions, for 62 net removals in this
batch (70 including the first batch). The original 20% target is still unmet.
Mixed acquisition loader and historic survey assertions stay; obsolete source
reads/assertions disappear. Asset capture and unrelated unused UI stay outside
this test-owned batch.

## Complete declaration ledger

Locations refer to the pre-retirement tree; prior 8-declaration changes do not
alter these test locations. History/owners/cleanup/risk are shared within Q/W
above and enumerated source map. Titles identify dynamic table declarations;
runtime case counts are reported separately.

| Test location                                | Exact declaration title                                                                         | Mark | Evidence                                                                                                     |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------ |
| tests/app-value-stack-copy.test.ts:17        | "exports the approved shared CTA and stable story contract"                                     | D    | Q                                                                                                            |
| tests/app-value-stack-copy.test.ts:107       | \`uses the approved action sentence for the ${lane} lane\`                                      | D    | Q                                                                                                            |
| tests/app-value-stack-copy.test.ts:129       | "uses grammar-safe copy for every supported primary concern"                                    | D    | Q                                                                                                            |
| tests/app-value-stack-copy.test.ts:145       | "uses the computed outcome and anonymous headline when no name or concern exists"               | D    | Q                                                                                                            |
| tests/app-value-stack-copy.test.ts:156       | "returns deterministic copy for identical inputs"                                               | D    | Q                                                                                                            |
| tests/app-value-stack-routine.test.tsx:70    | "groups three numbered signals and renders only two foundation examples"                        | D    | Q                                                                                                            |
| tests/app-value-stack-routine.test.tsx:91    | "uses a non-empty fallback and three compact locks when no suggestion exists"                   | D    | Q                                                                                                            |
| tests/app-value-stack-routine.test.tsx:108   | \`avoids a repeated mask/oil lock after ${category}\`                                           | D    | Q                                                                                                            |
| tests/app-value-stack-routine.test.tsx:117   | "keeps the general mask and oil lock for non-mask suggestions"                                  | D    | Q                                                                                                            |
| tests/guided-story-analysis.test.tsx:9       | "renders the personalized opening, portrait, default central insight, and handoff"              | D    | Q                                                                                                            |
| tests/guided-story-analysis.test.tsx:45      | "uses the approved generic fallback without inventing a name or trait"                          | D    | Q                                                                                                            |
| tests/guided-story-analysis.test.tsx:57      | "renders Haarpotenzial only when a scorer result is available"                                  | D    | Q                                                                                                            |
| tests/guided-story-chat-demo.test.tsx:12     | "renders the selected question immediately as a non-interactive product demonstration"          | D    | Q                                                                                                            |
| tests/guided-story-chat-demo.test.tsx:23     | "reveals once automatically and immediately for reduced motion without any live chat request"   | D    | Q                                                                                                            |
| tests/guided-story-chat.test.ts:44           | "keeps the complete approved closed roster with the two product-safe mask corrections"          | D    | Q                                                                                                            |
| tests/guided-story-chat.test.ts:71           | "selects each routable approved exchange from its linked priority and selected routine step"    | D    | Q                                                                                                            |
| tests/guided-story-chat.test.ts:147          | "uses the first approved pair for the highest safe ordered priority"                            | D    | Q                                                                                                            |
| tests/guided-story-chat.test.ts:159          | "honors scalp route, selected category, routine variant, and required known facts"              | D    | Q                                                                                                            |
| tests/guided-story-chat.test.ts:193          | "uses the explicit base order for color and the safe fallback for sparse or legacy previews"    | D    | Q                                                                                                            |
| tests/guided-story-chat.test.ts:207          | "has no live chat, model, request, or AgentV2 dependency"                                       | D    | Q                                                                                                            |
| tests/guided-story-flow.test.ts:12           | "normal entry reveals only Chapter 1 and has no initial focus target"                           | D    | Q                                                                                                            |
| tests/guided-story-flow.test.ts:20           | "result-email compatibility reveals through Chapter 2 before focusing unlock-plan"              | D    | Q                                                                                                            |
| tests/guided-story-flow.test.ts:32           | "pricing and routine-return entries reveal the complete story before focusing pricing"          | D    | Q                                                                                                            |
| tests/guided-story-flow.test.ts:39           | "reduced motion removes animated scrolling"                                                     | D    | Q                                                                                                            |
| tests/guided-story-flow.test.ts:44           | "the hook reveals before scheduling scroll and moves focus to the chapter heading"              | D    | Q                                                                                                            |
| tests/guided-story-routine-copy.test.ts:57   | "resolves truthful shampoo copy across scalp routes"                                            | D    | Q                                                                                                            |
| tests/guided-story-routine-copy.test.ts:71   | "keeps the coarse oily shampoo fallback explicitly provisional"                                 | D    | Q                                                                                                            |
| tests/guided-story-routine-copy.test.ts:84   | "resolves conditioner copy from balance without inventing a deficiency diagnosis"               | D    | Q                                                                                                            |
| tests/guided-story-routine-copy.test.ts:99   | "resolves every targeted category and both leave-in variants with product names"                | D    | Q                                                                                                            |
| tests/guided-story-routine-copy.test.ts:140  | "normalizes visible category labels independently of legacy module wording"                     | D    | Q                                                                                                            |
| tests/guided-story-routine-copy.test.ts:186  | "keeps the locked CTA and Chapter 2 handoff on their approved strings"                          | D    | Q                                                                                                            |
| tests/guided-story-routine-copy.test.ts:196  | "uses sparse basis intro when no truthful third product exists"                                 | D    | Q                                                                                                            |
| tests/guided-story-routine.test.tsx:46       | "renders the three-card routine with basis, targeted section, locked teasers, and handoff"      | D    | Q                                                                                                            |
| tests/guided-story-routine.test.tsx:77       | "renders the sparse two-card fallback without a targeted placeholder"                           | D    | Q                                                                                                            |
| tests/guided-story-routine.test.tsx:87       | "renders the experiment routine heading and fallback without changing rollback copy"            | D    | Q                                                                                                            |
| tests/guided-story-routine.test.tsx:111      | "locked recommendation hides targeted product identity while keeping foundation cards visible"  | D    | Q                                                                                                            |
| tests/guided-story-routine.test.tsx:156      | "uses semantic native buttons and no nested interactive product wrappers"                       | D    | Q                                                                                                            |
| tests/guided-story-routine.test.tsx:170      | "keeps the subscription CTA out of the initial visible product-card surface"                    | D    | Q                                                                                                            |
| tests/guided-story-routine.test.tsx:181      | "keeps popover behavior local with Escape, outside-dismiss, and focus restoration hooks"        | D    | Q                                                                                                            |
| tests/guided-story-support.test.tsx:21       | "renders the approved independent chat, tracker, proof, and pricing handoff"                    | D    | Q                                                                                                            |
| tests/guided-story-support.test.tsx:40       | "warms shared checkout readiness without mounting pricing or coupling chat and tracker"         | D    | Q                                                                                                            |
| tests/guided-story-support.test.tsx:52       | "supports the experiment support transition with name and no-name fallback"                     | D    | Q                                                                                                            |
| tests/guided-story-tracker-proof.test.tsx:27 | "renders a static tracker screenshot shell with comparable routine copy and real product names" | C    | Live in-range RhythmBand headline moved to tracker-rhythm using confirmed wash logs; obsolete demo removed.  |
| tests/guided-story-tracker-proof.test.tsx:50 | "keeps the proof independent from chat, tracker writes, and live tracker data"                  | D    | Q                                                                                                            |
| tests/guided-story-tracker-proof.test.tsx:66 | "renders the basis fallback without implying the user's real diary history"                     | D    | Q                                                                                                            |
| tests/guided-story-tracker.test.ts:26        | "maps shampoo and conditioner only to the Basiswäsche tracker scenario"                         | D    | Q                                                                                                            |
| tests/guided-story-tracker.test.ts:40        | "keeps scalp-specific shampoo variants inside the Basiswäsche scenario"                         | D    | Q                                                                                                            |
| tests/guided-story-tracker.test.ts:55        | "maps bondbuilder, protein mask, and moisture mask routines to Intensive Pflege"                | D    | Q                                                                                                            |
| tests/guided-story-tracker.test.ts:103       | "maps leave-in, curl leave-in, and oil routines to Finish & Struktur"                           | D    | Q                                                                                                            |
| tests/guided-story-tracker.test.ts:136       | "derives a conservative positive rhythm band from the known quiz washing cadence"               | D    | Q                                                                                                            |
| tests/guided-story-tracker.test.ts:152       | "falls back to a basis proof without inventing product history"                                 | D    | Q                                                                                                            |
| tests/organic-funnel-surface.test.tsx:65     | "quiz-gate landing keeps its approved copy and routes every quiz action to the modal"           | D    | W                                                                                                            |
| tests/quiz-brand-panel-content.test.ts:6     | "question nine keeps the desktop rail with concise concerns copy"                               | D    | Q                                                                                                            |
| tests/quiz-brand-panel-content.test.ts:15    | "goals step becomes question ten in the desktop rail"                                           | D    | Q                                                                                                            |
| tests/quiz-brand-panel-content.test.ts:24    | "lead capture uses a short finalization message with completed progress"                        | D    | Q                                                                                                            |
| tests/quiz-brand-panel-content.test.ts:33    | "analysis keeps the same desktop rail shell with concise processing copy"                       | D    | Q                                                                                                            |
| tests/quiz-guided-story-preview.test.ts:6    | "builds one canonical analysis, routine, and analytics preview"                                 | C    | Active rank→needs→cards assertions moved to existing product-owner cases; retired preview/analytics removed. |
| tests/quiz-guided-story-preview.test.ts:37   | "incomplete legacy answers keep three honest insights and a two-product foundation"             | D    | Q                                                                                                            |
| tests/quiz-guided-story-preview.test.ts:51   | "rough surface keeps the approved leave-in complement ahead of a moisture mask"                 | C    | Active rank→needs→cards assertions moved to existing product-owner cases; retired preview/analytics removed. |
| tests/quiz-guided-story-preview.test.ts:71   | "the scoped preview does not mutate legacy preview behavior"                                    | D    | Q                                                                                                            |
| tests/quiz-primary-concern.test.ts:277       | "app value stack: a stated non-legacy concern gets its lead, hair loss and none stay neutral"   | D    | Q                                                                                                            |
| tests/result-card-data.test.ts:6             | "legacy result payloads render protein and scalp cards without blanks"                          | D    | Q                                                                                                            |
| tests/result-card-data.test.ts:23            | "shared result summary still derives from normalized answers"                                   | D    | Q                                                                                                            |
| tests/waitlist-ui.test.ts:78                 | "quiz-gate signup tracks exactly one Lead only for a new token-bearing waitlist signup"         | D    | W                                                                                                            |

## Validation

Selected pre-retirement42files:339/339 cases pass with c8 source-mapped coverage.
Full corrected-tree coverage, typecheck/lint/build, preservation review and all
five owner mutations completed. Current accounting and proof are recorded in
[the verification receipt](2026-10-02-test-audit-receipt.md).
All source/test writers finish before tests or mutations start.

Original20% target remains active, not achieved by this layer. Counts must not
relabel a subsystem percentage or source LOC as global test removal. Prior batch
and this batch total72declarations before any preservation repairs (0.6054%).

Artifact disposition: plan/this ledger are durable commit candidates; raw driver,
graph, coverage, review and mutation artifacts are temporary local evidence
under /tmp with archive disposition. Commit/push/PR/merge/deploy not authorized.

## Preservation repair and proof

Independent preservation inspection found two active assertion families hidden
inside removed suites. The actual ranker now feeds the existing product-owner
cases for treated damage/bondbuilder and rough straight/wavy leave-in selection.
The live RhythmBand headline is rendered from three confirmed wash logs in the
tracker-owned suite. These guard producer/consumer disagreement and misleading
in-range UI; existing manually supplied priorities/model-only tests did not
protect those boundaries. No new production seam was introduced.

The 16 current product/tracker cases pass. Three deliberate production mutations
(wrong in-range headline, dryness priority promoted to Tier 1, damage priority
demoted to Tier 2) each fail the intended keeper with an assertion. Source was
restored byte-for-byte after each mutation; SHA-256 restoration was checked.
Evidence: `/tmp/test-audit-retirement-mutations.json` and corresponding logs.

Initial selected retirement proof: 339/339 cases before and 267/267 after, prior
to the preservation repair. This focused subset omitted some live sibling tests;
its per-file drops are not final acceptance evidence. Full corrected-tree proof
and conservative source-set comparison completed on the repaired tree. Build
passed after all source deletions. Browser declarations are unchanged; no
browser run is claimed. The receipt supersedes these intermediate subset counts.

## Partial owner cleanup and preserved live delivery

OfferPreviewRoutine's only runtime caller is membership reactivation, which
always supplied routineOnly=true. Neither current registry nor refreshed deployed
source supplies false/default mode. Remove only its disconnected full-analysis
markup and obsolete mode prop; retain the routine renderer and change that sole
caller to its identical unconditional layout. The retired outer quiz components
used only its category-title constant, which stays for live locked-product
labels. The original old result presentation history and Q boundary above apply;
this is not retirement of membership reactivation. Hidden importer/default-mode
use is the risk, addressed by complete current/deployed path/symbol and registry
inspection plus build/typecheck. A real surface-led and neutral preview each
produce byte-identical active HTML before/after; future foundation visibility
and fallback errors fail canonical product-owner assertions. Tracker WeekStrip's
read-only/custom-label props likewise had only the removed demo caller; default
activity/accessibility behavior is covered at its current owner. No new seam.
