# Discovery cockpit actual-owner layer reassessment

Read-only proposal; no repository edits, tests, source mutations, browser, database or provider operations. Full scope **120 AST declarations** in six files. Verdict **{"R":108,"F":3,"C":6,"D":3}**. Proposed quota only **9** (C6/D3), conditional on main validation. No table packing, no new input cases or callbacks.

## Read scope and prior evidence

All six test files and their literal fixtures/callbacks read completely. The first five (106) were already fully read in /tmp/test-audit-discovery-cockpit-remainder-layer.md and were all R; this is explicitly an independent semantic reassessment, not 106 new read credits. Comparison-table14 was fully read in this pass; broader inventory/map titles are navigation only. The 255-site discovery UI ledger was read as prior evidence, not reread as new scope. Current file and callback hashes accompany every site in the machine ledger.

Candidate owners read completely at function granularity: loadDiscoveryCockpitModel, buildDiscoveryCockpitView, loadParticipantScanVerdicts/resolveItemVerdict, research route handler/answer/status computation, usage route handler, stale-key/composedItems/stepItemSets, reduceIntakeItemsToSteps, ComparisonTable/ComparisonWithOwned/StatusDisc, StepVerdict/Choice and ScanVerdictSections. Classifier usage-family functions read; product-name classifier is outside candidate closure. Larger cockpit/page files were read in relevant sections, not claimed whole-file source reads. Scan parity DIMENSION fixture including base/product/alternative dependencies was read; unrelated parity states only navigation. Existing prior R ledger is evidence for the remaining route/list/operator owner families; no claim this pass revalidated all DB/RLS semantics.

## Current support, history and CI

This is a supported operator feature, not obsolete: docs/discovery-call-runbook.md150–217 names current admin lists and research dispatch/refresh;304–330 specifies usage correction and atomic stale-decision contract;350–374 names live cockpit comparison tables and unchanged scanner. package.json discovery command and actual /admin/beratung pages plus admin routes remain rooted. rg found real PATCH→stale helper, default model→verdict loader, StepVerdict/Choice→comparison table callers. History read:2bb16f10 creation/accepted identity-versus-usage behavior and960c064b approved comparison-table design/delivery; later6458825e/3a774a20/694cb9a6/21c2813f log navigation. No supersession claim. .github/workflows/ci.yml quality-node runs package test:node, whose top-level globs include all six.

## Why earlier all-R changed

Earlier report said route stales do not own deterministic branch matrix and distinct source types justified retaining lower tests. That distinction is insufficient for these three exact predicates: real route calls the actual stale helper with identical relevant binding inputs; the extra unbound/unchanged row does not alter old/new sets. The composed approved-research keeper executes real verdict owner after effective product identity assignment and already checks the direct donor's entire assertion union. Likewise isolated table donors reuse exactly the same ROWS and full/compact variants already rendered by retained keepers. New assertions attach to those existing values, not copied output or a second model.

## Candidate union

### C1 C: tests/discovery-cockpit-research.test.tsx:700

an enqueue changes no identity, so the cockpit only updates the badge

The response identity bit depends only on productId/submissionId. Donor pending→pending and keeper pending→queued have unchanged identical identities; job state affects status only. Carry literal false next to existing 200/enqueue/queued-status assertions.

Keeper: tests/discovery-cockpit-research.test.tsx:495 an open submission without a live job is enqueued, and the new status comes back.

### D1 D: tests/discovery-cockpit-usage.test.tsx:155

F2: a catalog conditioner she uses as a mask is graded as a conditioner, with the difference named

Real model auto-links approved identity, then invokes actual loadParticipantScanVerdicts and buildDiscoveryCockpitView. Both reach active.category=conditioner, item.category=mask, defined productType=conditioner and same context. catalog_search vs name_research only passes source!==none; product IDs flow through joins but do not change grading. Keeper already asserts verdict, graded [conditioner], identical usageDifference and mask binding.

Keeper: tests/discovery-cockpit-usage.test.tsx:245 F2: an approved-research conditioner she uses as a mask binds to the mask step with a product verdict.

### D2 D: tests/discovery-cockpit-usage.test.tsx:389

F3: moving a bound conditioner to the mask step makes both steps' decisions stale

Actual PATCH computes staleDecisionKeys from actual composition. Same bound conditioner→mask with role/productType null. Additional type-open product in route fixture has null category/productId and is excluded from both step-item sets, so same exact [COND_KEY,MASK_KEY]. Keeper captures exact call array from real route, not a mock-generated stale result.

Keeper: tests/discovery-cockpit-usage.test.tsx:577 usage route: the correction is one call carrying the stale decision keys.

### D3 D: tests/discovery-cockpit-usage.test.tsx:430

F3: setting the usage of a research-pending item stales nothing (it binds nowhere yet)

Actual PATCH third existing call sets same open item to mask/type conditioner. Null productId excludes it before/after binding. Additional unchanged conditioner in route fixture contributes identical before/after set. Existing exact captured call asserts staleDecisionKeys []. Earlier rejection requests do not write or alter model.

Keeper: tests/discovery-cockpit-usage.test.tsx:555 usage route: a type only for a type-open item, and a type-open item needs one.

### C2 C: tests/discovery-comparison-table.test.tsx:69

the table has the iOS header: two blank columns, PRODUKT, ZIEL (cockpit voice) in plum

Same ROWS identity already reaches actual DiscoveryCallCockpit→StepVerdict→ScanVerdictSections→DiscoveryComparisonTable. Carry all five header/chrome assertions onto the actual full table selected from existing markup.

Keeper: tests/discovery-comparison-table.test.tsx:348 the cockpit shows her product as a comparison table instead of bars and text rows.

### C3 C: tests/discovery-comparison-table.test.tsx:79

each dimension is one row: name, status disc, product value in status colour, target in plum

Same four ROWS and full variant. Carry exact four statuses/glyphs, three status surfaces, Protein/Feuchtigkeit colours, min-height and dividers into existing rendered full table; do not apply counts to alternative table.

Keeper: tests/discovery-comparison-table.test.tsx:348 the cockpit shows her product as a comparison table instead of bars and text rows.

### C4 C: tests/discovery-comparison-table.test.tsx:95

in / out / no-target: a missing value reads „–“, never an invented word

Same ROWS has in-target, out-of-target and null target. Carry three literal aria readouts, plum dash and both soft-hyphen labels into composed full table.

Keeper: tests/discovery-comparison-table.test.tsx:348 the cockpit shows her product as a comparison table instead of bars and text rows.

### C5 C: tests/discovery-comparison-table.test.tsx:115

the compact variant (alternatives) uses the smaller value font

Donor full ROWS already exists in cockpit348, compact ROWS already exists in alternative123. Move full 13px bold assertion to former, compact12px and no13px bold assertions to latter. No new variant/case/render.

Keeper: tests/discovery-comparison-table.test.tsx:348 the cockpit shows her product as a comparison table instead of bars and text rows; tests/discovery-comparison-table.test.tsx:123 an alternative without her product: two columns, ALTERNATIVE | ZIEL.

### C6 C: tests/discovery-comparison-table.test.tsx:252

the scanner's own sections still render the slider bars (no table prop)

Keeper already renders exact same SCANNER_RESULT without comparison into without, plus with-table variant. Carry bar section presence and no data-glyph onto existing without value.

Keeper: tests/discovery-comparison-table.test.tsx:262 only a cockpit-supplied comparison replaces the bars.

## Retention and false-proof limits

No source helper/export can be removed: all remain used by real routes/renderers or other retained cases. Shared item/model/ROWS/SCANNER_RESULT fixtures remain needed. Retain three-column joins, opposite own/alternative statuses, empty fallback, legacy missing productType, unknown usage, family rejection, oil-role move, multi-bound product change, all approval/CAS/retry/exhaustion/storage/auth contracts. model711 has a misleading draft title but really guards null UPDATE-result mapping; rename to actual contract, do not call it SQL proof. page253/654 generic rejection is F: exact Next404 digest should replace generic rejection on their existing inputs. These F repairs are explicitly outside the nine-cut staging and have zero quota. Conservatively retained model265 unknown helper lookup, table136 full+ownedRows and table242 empty rows lack the same current runtime reachability as primary cases; exported/component contracts remain and this pass does not invent retirement authority.

## Staging and validation proposal

Guarded /tmp/test-audit-discovery-cockpit-edit.cjs modes check/before/transfer/cut; exact task cwd required. Six files hashed,15 owner/dependency guards; staged all18 prospective file strings TS-parsed before any main write, whole phase hashes rechecked before first write, originals and receipt under /tmp. Every non-keeper callback byte-identical through transfer; every cut survivor byte-identical to transfer. Four existing keeper callbacks change, nine existing donors removed only in cut. JSDOM is only used to select actual full table from already-produced markup; no script/resource execution, no fabricated values.

Counts120→120→111. Changed files research25→24, usage26→23, comparison14→9; model23/page17/api15 unchanged. Full diff /tmp/test-audit-discovery-cockpit-complete.diff; full donor/keeper bodies /tmp/test-audit-discovery-cockpit-candidates.json; hashes/per-site verdicts /tmp/test-audit-discovery-cockpit-full-ledger.json.

Main focused native command (before, after transfer, after cut):

`node --import ./tests/server-only-register.cjs --import tsx --test tests/discovery-cockpit-model.test.ts tests/discovery-cockpit-research.test.tsx tests/discovery-cockpit-page.test.tsx tests/discovery-cockpit-api.test.ts tests/discovery-cockpit-usage.test.tsx tests/discovery-comparison-table.test.tsx`

Run actual-source controls only after transfer, byte restore each source from guarded /tmp originals; expected named keeper RED for intended assertion, clean source GREEN. No browser interaction, CSS computation, real research queue/lock or SQL write proof is claimed by these render/request unit contracts. Campaign native/c8 and <=2pp gate remain parent-owned.

## Complete site verdicts

|File:line|Verdict|Title|Independent fault / keeper evidence|
|---|---|---|---|
|tests/discovery-cockpit-model.test.ts:184|R|a bound product offers exactly the alternatives the engine displayed|Wrong alternative allow-list/origin/order or owned identity would fail exact projected step; page fixture supplies a prebuilt verdict and cannot substitute.|
|tests/discovery-cockpit-model.test.ts:220|R|an empty step offers the Idealplan's own recommendation instead|Empty step could lose the Idealplan-only option or ideal outcome; bound-product case has alternatives instead.|
|tests/discovery-cockpit-model.test.ts:234|R|a step whose verdict failed keeps the Idealplan pick, never the product itself|Failed verdict could offer the owned product itself as a swap; distinct fallback and self-exclusion input.|
|tests/discovery-cockpit-model.test.ts:265|R|an unknown decision key has no allow-list at all|Unknown decision key could inherit another step allow-list. Retained defensively: actual decision route now rejects unknown entries before lookup, so current production reachability of this null result is unproved; no proposed deletion without export-contract decision.|
|tests/discovery-cockpit-model.test.ts:272|R|a textless barcode row is named by its code, and research items stay named|Textless barcode identity or duplicate brand/name and unassigned research/declined projection could disappear; distinct incomplete identity data.|
|tests/discovery-cockpit-model.test.ts:334|R|a decided step carries its swap target even when the catalog row is unreadable|Catalog-row absence could erase a stored swap identity/outcome/hash; read failure does not authorize silently discarding a decision.|
|tests/discovery-cockpit-model.test.ts:370|R|the Idealplan's recommendation carries its catalog brand|Ideal recommendation brand could be omitted despite readable catalog row; this exact model projection differs from page fixture-owned labels.|
|tests/discovery-cockpit-model.test.ts:383|R|a swap target and a kept verdict product are named with their brand|Chosen swap or kept-product brand could be omitted; two distinct decision results retained.|
|tests/discovery-cockpit-model.test.ts:436|R|swap targets and PRINTED recommendations share one batched catalog read|Catalog reads could be repeated or include the wrong union of printed recommendations and swap IDs; exact recorded single read owns batching.|
|tests/discovery-cockpit-model.test.ts:473|R|a recommendation that is not printed never blocks the call|An unprinted recommendation could trigger an unnecessary catalog read or block finalization; distinct keep/printed readset.|
|tests/discovery-cockpit-model.test.ts:495|R|a printed recommendation missing from a successful read counts as unavailable|Successful read missing a required recommendation row could be treated as complete; both undecided and swapped printed outputs retained.|
|tests/discovery-cockpit-model.test.ts:519|R|a failed brand lookup degrades a swap-free call instead of failing it|Catalog exception could either fail a swap-free call instead of degrading or silently accept required swap reads; distinct failure inputs.|
|tests/discovery-cockpit-model.test.ts:570|R|the verdict pass runs once, on the very context the Idealplan prepared|Verdicts could recompute context or receive a different item/context object; publishing/context reuse makes call identity meaningful.|
|tests/discovery-cockpit-model.test.ts:606|R|an unusable source short-circuits after her answers are read, before anything else|Unusable Idealplan could continue research/catalog/verdict reads after items and heat; counters own actual short circuit.|
|tests/discovery-cockpit-model.test.ts:680|R|finalize stores the pair and carries the submitted precondition into the UPDATE|Finalize adapter could omit submitted filter, wrong table, or timestamp/hash update pair; passive query recorder observes real adapter encoding, not SQL behavior.|
|tests/discovery-cockpit-model.test.ts:711|F|a draft intake finalizes nothing|F: title claims draft predicate but recordingClient(null) provides no draft row. Actual contract is no matched UPDATE row maps to null. Rename accurately; submitted predicate remains model680, route preflight/race remains api461. No cut or added fixture proposed.|
|tests/discovery-cockpit-model.test.ts:719|R|un-finalize clears both columns|Unfinalize adapter could clear only one of timestamp/hash or target wrong intake; exact pair/filter observed.|
|tests/discovery-cockpit-model.test.ts:747|R|a keep never stores a swap target; the write is the one locked RPC per (step, product)|Keep could leak stale swap ID or wrong RPC binding arguments; actual adapter must encode locked one-write call. No claim the fake implements DB lock.|
|tests/discovery-cockpit-model.test.ts:799|R|the decision write passes refusals through and rejects an unknown answer|RPC refusal could be swallowed or unknown outcome accepted; transport mapping and unknown-throw path differ from route stubs.|
|tests/discovery-cockpit-model.test.ts:828|R|identities are read for every labelled product and option, and a failed read degrades|Identity batch could omit an option/owned/recommendation product or swallow identity-read degradation; distinct union/read failure.|
|tests/discovery-cockpit-model.test.ts:903|R|a transient verdict failure keeps the printed name and the fingerprint|Transient verdict failure could change printed stable identity/fingerprint or avoid degradation on missing identity; computed comparison observes same runtime model across perturbation, not independent hash algorithm proof.|
|tests/discovery-cockpit-model.test.ts:936|R|permanent verdict states keep her own words and never degrade|Permanent unavailable/quarantined/mismatch/missing-decision states could mark entire read degraded or erase participant words; four independent status outcomes retained.|
|tests/discovery-cockpit-model.test.ts:952|R|swap option cards carry the same brand + line + name the PDF would print|Option identity could fail brand+line+name assembly or fallback for alternative/ideal option; page uses already composed inputs in other cases.|
|tests/discovery-cockpit-research.test.tsx:176|R|approved, eligible research becomes her product for the verdicts, the routine and the hash|Approved eligible submission could fail autolink into verdict/routine/hash; pending contrast proves no premature link.|
|tests/discovery-cockpit-research.test.tsx:203|R|rejected, pending and approved-but-ineligible research link nothing|Rejected, pending or approved ineligible submission could leak product into routine; status and eligibility are separate admission gates.|
|tests/discovery-cockpit-research.test.tsx:219|R|a failed research read degrades: nothing linked, finalize blocked, statuses honest|Research read failure could link stale data or leave finalize enabled; barcode research action remains available on independent input.|
|tests/discovery-cockpit-research.test.tsx:330|R|„Eingetragene Produkte“ opens the cockpit: image, name, shelf and research state per product|Actual page could omit captured image/name/usage/status or reorder intake list; model projection alone cannot prove delivery.|
|tests/discovery-cockpit-research.test.tsx:352|R|the step shows why, type, criteria, fit, and rhythm with timing|Step could omit why/type/criteria/fit/timing text; exact rendered existing depth fields independent of research execution.|
|tests/discovery-cockpit-research.test.tsx:385|R|a failed research read is said above the list|Degraded read warning could disappear at operator boundary; status model alone does not display it.|
|tests/discovery-cockpit-research.test.tsx:456|R|the research route refuses cross-origin first, then the kill switch, then non-admins|Research endpoint could touch admin before cross-origin refusal or ignore kill switch/non-admin response.|
|tests/discovery-cockpit-research.test.tsx:486|R|an item of another intake is not found, and a bad body is a 400|Cross-intake item could be researched or malformed body reach writes; exact refusal ordering.|
|tests/discovery-cockpit-research.test.tsx:495|R|an open submission without a live job is enqueued, and the new status comes back|Open submission could invoke retry or return stale not-started status; real route refreshes queued status. C1 adds unchanged-identity false here.|
|tests/discovery-cockpit-research.test.tsx:519|R|a failed job is retried, not enqueued|Failed job could enqueue instead of retrying existing job identity; materially distinct job branch.|
|tests/discovery-cockpit-research.test.tsx:533|R|an item without a submission gets one, opened as the participant and attached to the row|Create submission could run as admin instead of participant or attach wrong identity; exact EAN/user/attach call sequence.|
|tests/discovery-cockpit-research.test.tsx:543|R|F1: the route opens the submission as the PRODUCT TYPE, not her usage; legacy rows as their tile|Submission could follow usage instead of product type, break legacy tile fallback, or start unknown-type input; distinct admission data.|
|tests/discovery-cockpit-research.test.tsx:572|R|a submit that finds the product in the catalog lands it on the row instead|Already-catalog result could attach submission instead of assigning product; different submission resolver outcome.|
|tests/discovery-cockpit-research.test.tsx:581|R|nothing to start is a 409 carrying the current status — running, catalog, too thin|Running or insufficient capture could start research despite no action. Title also says catalog, but body covers running/thin only; retain actual contracts and narrow title later, no claimed catalog-case coverage.|
|tests/discovery-cockpit-research.test.tsx:607|R|a failing enqueue is a 503, never a silent success|Enqueue exception could become silent200 instead of503 when refreshed state still actionable; distinguish raced queued success.|
|tests/discovery-cockpit-research.test.tsx:619|R|a failed job out of attempts is not retried — the route answers with the exhausted state|Exhausted job could retry forever despite attempt counters; actual status computation blocks operation.|
|tests/discovery-cockpit-research.test.tsx:640|R|race: a submission attached first wins over a later catalog match|Catalog resolution losing to concurrent submission could overwrite winner or return stale identity; CAS loser refresh contract.|
|tests/discovery-cockpit-research.test.tsx:681|R|race: a catalog match assigned first wins over a later submission attach|Submission attach losing to catalog assignment could overwrite product or miss whole-page refresh; reverse race distinct.|
|tests/discovery-cockpit-research.test.tsx:700|C C1|an enqueue changes no identity, so the cockpit only updates the badge|The response identity bit depends only on productId/submissionId. Donor pending→pending and keeper pending→queued have unchanged identical identities; job state affects status only. Carry literal false next to existing 200/enqueue/queued-status assertions.|
|tests/discovery-cockpit-research.test.tsx:707|R|a second-tab retry the RPC refuses reports the job the first tab queued|RPC retry exception after another tab queues job could report failure instead of current queued status; real catch refresh path.|
|tests/discovery-cockpit-research.test.tsx:733|R|the list refreshes the whole cockpit exactly when an item's identity changed|Client could refresh whole page on badge-only change or fail to refresh identity/conflict; distinct delivery lifecycle mapper.|
|tests/discovery-cockpit-research.test.tsx:763|R|a refreshed routine remounts the decision island so its state re-syncs|SourceHash/finalized state could fail to change remount key, leaving stale decisions after refresh; source same key equality is supporting assertion only.|
|tests/discovery-cockpit-research.test.tsx:778|R|every successful decision or finalize write refreshes; a refusal rolls back and explains|Success/refusal client outcomes could refresh incorrectly, hide error or leave optimistic state; distinct from server persistence.|
|tests/discovery-cockpit-research.test.tsx:803|R|research starts wait while a decision write is pending — including a remounted panel's|Pending count could underflow on double completion or reset across panel remount, admitting racing research; closure state is actual module behavior.|
|tests/discovery-cockpit-research.test.tsx:821|R|a lost submission attach answers with the winner's state, not an error|Submission attach loser could report generic error instead of winner research running status; distinct winner lacks product ID.|
|tests/discovery-cockpit-page.test.tsx:253|F|the kill switch and the admin gate both hide the cockpit|F: assert.rejects accepts any thrown error. Preserve three existing flag/admin/missing-enrollment inputs, assert Next notFound digest NEXT_HTTP_ERROR_FALLBACK;404 (verify installed dependency), and prove injected ordinary Error does not pass. No new case or quota.|
|tests/discovery-cockpit-page.test.tsx:267|R|the cockpit reads as the call: routine, verdict, one decision per step|Call render could omit routine/verdict choices or incorrectly enable PDF before finalization; full operator output.|
|tests/discovery-cockpit-page.test.tsx:312|R|what needs no decision collapses to one grey line each|Nondecision and unassigned/declined rows could render controls or disappear instead of collapsed grey lines; distinct outcomes.|
|tests/discovery-cockpit-page.test.tsx:335|R|the cockpit names scalp care the way the participant's checklist does|Scalp-care label could expose scanner vocabulary rather than participant checklist vocabulary; actual adapter display.|
|tests/discovery-cockpit-page.test.tsx:362|R|a finalised call renders as finalised|Finalized render could keep radios enabled or PDF disabled; actual four-control disabled result.|
|tests/discovery-cockpit-page.test.tsx:380|R|the preflight banner names the answers that are still missing|Preflight banner could omit missing question or remain with complete profile; distinct metadata states.|
|tests/discovery-cockpit-page.test.tsx:394|R|an intake that does not exist yet, and a profile that cannot be read, say so|No intake, no source, unavailable source could become indistinguishable or render misleading content; three actual page paths.|
|tests/discovery-cockpit-page.test.tsx:432|R|a legacy participant: quiz answers on top, a main-problem picker, then the call|Legacy quiz answers could lose ordering or main-problem picker when newer field absent; legacy route contract.|
|tests/discovery-cockpit-page.test.tsx:453|R|a new participant with a stated main problem gets its recipe for her profile|New stated main problem could lose recipe/profile adaptation or show picker; actual page delivery.|
|tests/discovery-cockpit-page.test.tsx:489|R|hair loss as the main problem renders the boundary only|Hair-loss problem could show cosmetic routine advice instead of boundary-only message; distinct safety branch.|
|tests/discovery-cockpit-page.test.tsx:500|R|quiz answers show even when the Idealplan cannot be read|Unavailable Idealplan could suppress independently readable quiz answers; partial-read operator usability.|
|tests/discovery-cockpit-page.test.tsx:509|R|a failed quiz-lead read never takes the cockpit (or its degraded page) down|Quiz-lead read exception could crash ready/degraded page or invent missing quiz; distinct failure combinations.|
|tests/discovery-cockpit-page.test.tsx:537|R|the list joins every enrollment with the state of its checklist|List join could omit enrollment without intake or mislabel submitted/draft/finalized rows; independent list output.|
|tests/discovery-cockpit-page.test.tsx:602|R|the list opens with the invite form and gives each live row its link controls|Revoked invite could keep link actions or live rows lose exact generated links/form; auth token projection lifecycle.|
|tests/discovery-cockpit-page.test.tsx:638|R|without a signing secret the list still renders, just without link controls|Absent signing secret could crash list or expose broken invite controls; list remains usable.|
|tests/discovery-cockpit-page.test.tsx:654|F|the list is hidden behind the same two gates|F: generic rejects can pass on unrelated admin-client error. Preserve both existing inputs but check actual Next404 digest; no added fixture/site.|
|tests/discovery-cockpit-page.test.tsx:670|R|the cockpit names her product and every swap card like the PDF: brand + line + name|Actual cockpit could discard model-projected brand+line+name in owned heading/swap cards; reaches renderer not covered by identity assembly only.|
|tests/discovery-cockpit-api.test.ts:175|R|the kill switch hides the endpoint, and the shared admin gate's own answer is passed through|Endpoint could ignore kill switch or replace shared admin response; explicit statuses/body.|
|tests/discovery-cockpit-api.test.ts:196|R|an enrollment without an intake is a 404, and the admin client is only built after the gate|Admin client could be built before authorization or missing intake accepted; side-effect ordering plus404.|
|tests/discovery-cockpit-api.test.ts:236|R|a keep is stored with the binding the server computed; a product not in the step is refused|Keep could trust browser product binding or accept item from another step; actual composed binding and foreign409.|
|tests/discovery-cockpit-api.test.ts:281|R|a swap must name a product the cockpit displayed for that very step|Swap could accept arbitrary product outside that step displayed alternatives; independent allowed/forbidden values.|
|tests/discovery-cockpit-api.test.ts:321|R|a decision key the Idealplan does not carry is refused|Unknown decision key could write despite absent Idealplan step;400 before persistence.|
|tests/discovery-cockpit-api.test.ts:333|R|a malformed body is refused before anything is composed|Malformed request schema could reach composition; seven invalid body shapes preserve boundary validation.|
|tests/discovery-cockpit-api.test.ts:364|R|a draft intake takes decisions, as it always did — only finalising needs a submit|Draft decisions could be accidentally forbidden by finalize-only submitted rule; accepted lifecycle policy.|
|tests/discovery-cockpit-api.test.ts:382|R|decisions are frozen while the call is finalised|Finalized intake could allow decision mutation;409 freeze gate.|
|tests/discovery-cockpit-api.test.ts:399|R|a routine that cannot be composed refuses the write instead of guessing|No usable routine source could write guessed binding; no-source/unavailable responses distinct.|
|tests/discovery-cockpit-api.test.ts:416|R|finalize stores the hash of the routine as composed right now|Finalize could persist stale input hash instead of freshly composed model hash. Expected-from-composer is valid routing/provenance check only; not independent hash algorithm oracle.|
|tests/discovery-cockpit-api.test.ts:448|R|finalize refuses a composition whose recommendation brands could not be read|Incomplete recommendation brands could finalize unstable printed identity;503 guard.|
|tests/discovery-cockpit-api.test.ts:461|R|finalize requires a submitted intake, both before and inside the write|Draft preflight or null CAS result could report success; two lifecycle positions retained, SQL itself not exercised.|
|tests/discovery-cockpit-api.test.ts:483|R|un-finalize clears the pair and needs no composition at all|Unfinalize could unnecessarily compose or fail to clear pair; early branch with no source requirement.|
|tests/discovery-cockpit-api.test.ts:508|R|research gate (F1/F4): finalize refuses while the runsheet shows her product in research inside its step|Research-pending bound product could pass finalize despite actual runsheet projection; cross-module admission bridge.|
|tests/discovery-cockpit-api.test.ts:563|R|finalize refuses a body that is not the boolean|Nonboolean finalized value could coerce to true/false and write; strict request schema.|
|tests/discovery-cockpit-usage.test.tsx:155|D D1|F2: a catalog conditioner she uses as a mask is graded as a conditioner, with the difference named|Real model auto-links approved identity, then invokes actual loadParticipantScanVerdicts and buildDiscoveryCockpitView. Both reach active.category=conditioner, item.category=mask, defined productType=conditioner and same context. catalog_search vs name_research only passes source!==none; product IDs flow through joins but do not change grading. Keeper already asserts verdict, graded [conditioner], identical usageDifference and mask binding.|
|tests/discovery-cockpit-usage.test.tsx:173|R|F2: an oil used on the scalp is in-family; a mask used as shampoo is not|Oil→scalp allowed family and mask→shampoo forbidden family could be swapped; actual different branch pairs.|
|tests/discovery-cockpit-usage.test.tsx:201|R|F2: a legacy (tile) row keeps `target_mismatch` — no product type, no reinterpretation|Legacy missing productType could reinterpret tile-category mismatch as modern usage; backwards compatibility.|
|tests/discovery-cockpit-usage.test.tsx:212|R|F2: same category — no difference is reported|Same category could attach misleading usageDifference; absence assertion guards projection.|
|tests/discovery-cockpit-usage.test.tsx:224|R|F2: an item with unknown usage gets no verdict at all|Null usage could be graded despite no target; actual filter returns empty.|
|tests/discovery-cockpit-usage.test.tsx:245|R|F2: an approved-research conditioner she uses as a mask binds to the mask step with a product verdict|Approved link could fail grading by product category, mask binding, PDF usage label; real composed keeper for D1.|
|tests/discovery-cockpit-usage.test.tsx:288|R|the usage-difference and usage lines read as Nick expects|Six German labels could omit type-versus-usage distinction or show false scalp/oil wording; exact public operator copy.|
|tests/discovery-cockpit-usage.test.tsx:317|R|the usage select offers every category, the three oil roles and the scalp oil — not a role-less oil|Usage options could omit category/oil roles or offer role-less oil; stored pair vocabulary independent of default selection.|
|tests/discovery-cockpit-usage.test.tsx:340|R|a newly set product type preselects the usage her own question would (F5)|Default could misclassify known product type or infer unknown name incorrectly; existing five inputs exercise default mapping.|
|tests/discovery-cockpit-usage.test.tsx:389|D D2|F3: moving a bound conditioner to the mask step makes both steps' decisions stale|Actual PATCH computes staleDecisionKeys from actual composition. Same bound conditioner→mask with role/productType null. Additional type-open product in route fixture has null category/productId and is excluded from both step-item sets, so same exact [COND_KEY,MASK_KEY]. Keeper captures exact call array from real route, not a mock-generated stale result.|
|tests/discovery-cockpit-usage.test.tsx:399|R|F3: a move that displaces another item stales the displaced step too, and nothing else|Move could incorrectly clear unrelated oil step or fail changed sibling set with another mask product; extra bound item is operative.|
|tests/discovery-cockpit-usage.test.tsx:412|R|F3: an oil role change stales the old and the new oil step|Oil role move could stale only category-level one step; two role keys must change.|
|tests/discovery-cockpit-usage.test.tsx:430|D D3|F3: setting the usage of a research-pending item stales nothing (it binds nowhere yet)|Actual PATCH third existing call sets same open item to mask/type conditioner. Null productId excludes it before/after binding. Additional unchanged conditioner in route fixture contributes identical before/after set. Existing exact captured call asserts staleDecisionKeys []. Earlier rejection requests do not write or alter model.|
|tests/discovery-cockpit-usage.test.tsx:496|R|usage route: cross-origin first, then the kill switch, then the admin gate|Cross-origin could invoke admin or flag/admin failure permit write; ordering at PATCH.|
|tests/discovery-cockpit-usage.test.tsx:521|R|usage route: refused while finalized („Erst Finalisierung aufheben“) and while a draft|Finalized or draft state could permit correction; actual route and client refusal copy.|
|tests/discovery-cockpit-usage.test.tsx:544|R|usage route: bad bodies, invalid pairs and foreign items are refused before any write|Invalid category-role pair, malformed body or foreign item could reach write; strict input admission.|
|tests/discovery-cockpit-usage.test.tsx:555|R|usage route: a type only for a type-open item, and a type-open item needs one|Type-known override could be accepted or type-open missing type accepted; successful unknown typing passes exact empty stale set (D3 keeper).|
|tests/discovery-cockpit-usage.test.tsx:577|R|usage route: the correction is one call carrying the stale decision keys|Route could split write, omit old/new stale keys or mis-map success receipt; exact one captured write is D2 keeper, receipt is a stubbed dependency result so not DB proof.|
|tests/discovery-cockpit-usage.test.tsx:599|R|usage route: the database's own refusals come back with their codes|DB refusal/error could become success, lose codes or fail mapping to client; five outcomes plus throw distinct.|
|tests/discovery-cockpit-usage.test.tsx:620|R|finalize is refused while a product's usage is open („Erst Kategorie festlegen“)|Category-open input could call finalizer; exact count/copy singular-plural, independent gate.|
|tests/discovery-cockpit-usage.test.tsx:684|R|page: „Kategorie offen“ in the list with type + usage selects, in Klären, and blocking finalize|Open type could lose correction controls/Klaeren entry/finalize lock in actual page; model alone cannot guarantee render.|
|tests/discovery-cockpit-usage.test.tsx:715|R|page: a draft shows no correction controls; a finalized call disables them|Draft/finalized view could show enabled correction controls; lifecycle rendering distinct from server refusal.|
|tests/discovery-cockpit-usage.test.tsx:729|R|page (batch 7, D2): a styling product is correctable behind „Kategorie ändern“; any product can move into styling|Styling product could be uncorrectable or option unavailable to another type; typed open editor options independently rendered.|
|tests/discovery-cockpit-usage.test.tsx:778|R|setting a „Kategorie offen“ product's type saves, then starts its research once|Client could research before save, twice, or send wrong typed payload; actual save helper controls request order.|
|tests/discovery-cockpit-usage.test.tsx:802|R|a research start that is refused or fails leaves the save standing|Research409/503/rejection could erase successful usage save; persistence acknowledgment boundary.|
|tests/discovery-cockpit-usage.test.tsx:821|R|a plain usage correction starts no research; a refused save starts none either|Plain correction/refused/offline save could start research or claim save success; no-request negative controls.|
|tests/discovery-comparison-table.test.tsx:69|C C2|the table has the iOS header: two blank columns, PRODUKT, ZIEL (cockpit voice) in plum|Same ROWS identity already reaches actual DiscoveryCallCockpit→StepVerdict→ScanVerdictSections→DiscoveryComparisonTable. Carry all five header/chrome assertions onto the actual full table selected from existing markup.|
|tests/discovery-comparison-table.test.tsx:79|C C3|each dimension is one row: name, status disc, product value in status colour, target in plum|Same four ROWS and full variant. Carry exact four statuses/glyphs, three status surfaces, Protein/Feuchtigkeit colours, min-height and dividers into existing rendered full table; do not apply counts to alternative table.|
|tests/discovery-comparison-table.test.tsx:95|C C4|in / out / no-target: a missing value reads „–“, never an invented word|Same ROWS has in-target, out-of-target and null target. Carry three literal aria readouts, plum dash and both soft-hyphen labels into composed full table.|
|tests/discovery-comparison-table.test.tsx:115|C C5|the compact variant (alternatives) uses the smaller value font|Donor full ROWS already exists in cockpit348, compact ROWS already exists in alternative123. Move full 13px bold assertion to former, compact12px and no13px bold assertions to latter. No new variant/case/render.|
|tests/discovery-comparison-table.test.tsx:123|R|an alternative without her product: two columns, ALTERNATIVE \| ZIEL|Compact no-owned and empty-owned inputs could incorrectly create owned column/glyph; retained exact compact/full distinction gains font assertions.|
|tests/discovery-comparison-table.test.tsx:136|R|her own table ignores ownedRows — it stays PRODUKT \| ZIEL|Full variant with ownedRows could incorrectly switch to three columns. Prop contract explicitly limits ownedRows to compact; no current production caller supplies ownedRows to full, so retention is conservative component contract, not claimed route coverage.|
|tests/discovery-comparison-table.test.tsx:186|R|with her product: three columns BISHERIGES PRODUKT \| ALTERNATIVE \| ZIEL, ZIEL in plum|Owned variant could lose3headers/plumtarget/scroll width; distinct owned input and compact layout.|
|tests/discovery-comparison-table.test.tsx:205|R|axes are matched by dimension; a missing axis leaves her cell empty|Positional instead of dimensionId join could show wrong own value or display own-only axis; incomplete axis sets retain independent risk.|
|tests/discovery-comparison-table.test.tsx:221|R|row tint and badges follow the alternative; her badge follows her status|Alternative row tint could follow own status or own disc follow alternative; same row has opposing statuses.|
|tests/discovery-comparison-table.test.tsx:242|R|no rows, no table|Empty rows could emit empty visual chrome; neither current cockpit call passes empty because guarded, retained reusable component empty return contract conservatively.|
|tests/discovery-comparison-table.test.tsx:252|C C6|the scanner's own sections still render the slider bars (no table prop)|Keeper already renders exact same SCANNER_RESULT without comparison into without, plus with-table variant. Carry bar section presence and no data-glyph onto existing without value.|
|tests/discovery-comparison-table.test.tsx:262|R|only a cockpit-supplied comparison replaces the bars|Comparison slot could leave scanner bars or alter header/banner prefix; existing without variant gains donor presence/no-glyph checks.|
|tests/discovery-comparison-table.test.tsx:348|R|the cockpit shows her product as a comparison table instead of bars and text rows|Composed cockpit could lose table wiring, duplicate bars/text rows or alternative-owned variant; receives all donor full ROWS asserts.|
|tests/discovery-comparison-table.test.tsx:373|R|without rows the cockpit falls back to the scanner's bars rather than showing nothing|Empty propertyRows could suppress both table and scanner bars; real cockpit fallback branch.|
