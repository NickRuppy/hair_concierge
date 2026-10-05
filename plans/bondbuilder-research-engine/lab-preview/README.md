# First-batch Bondbuilder review view

Bounded presentation requested by Nick: show researched properties for the first batch in a clean minimal version of the existing research Labs. Prepared across 2026-09-30 / 2026-10-01 from the dated 2026-09-30 findings. Read-only local review artifact, not a new deployed Lab, research run, approval store, adapter or intake action.

## Open

From the task worktree:

```sh
python3 -m http.server 3379 --bind 127.0.0.1 --directory plans/bondbuilder-research-engine/lab-preview
```

Open `http://127.0.0.1:3379/`. Only this preview directory is served, not the repository or its environment files. No packages or third-party assets are needed. Opening the HTML directly from disk may block its local JSON load; the visible error state provides a retry, never a database fallback.

## Journey and scope

View eight product buttons with trust, placement and time → choose a product → inspect technology/trust and routine properties → expand research/practice, raw INCI, sources or historical confidence → optionally compare all eight. On narrow screens the product list scrolls horizontally and the property audit stacks below it. No approve/rework/publish controls, user profile, ranking, percentages, inferred weekly schedule, persistence or live catalog lookup.

The existing Leave-In Lab's cream background, local-only header, product-list/detail pattern and expandable evidence are reused. The currently visible Mask Lab was also inspected in Chrome as visual grounding; its queue/progress/write controls are intentionally omitted. This artifact supplies concrete review evidence for Nick; it does not approve a future production Lab design or alter customer-facing surfaces.

## Data authority

- [Owner review](../owner-review-2026-09-30.md): all eight grades and the selected Redken source. The three owner-high references remain OLAPLEX No.3PLUS, K18 and epres; medium: Elvital Plus, Redken, Première; low: OGX serum and Aveda pre-shampoo.
- [Application review](../application-review-2026-09-30.md) and [remaining facts](../remaining-facts-2026-09-30.md): latest six-product directions, source variants, amount/cadence/fit gaps and K18 optional Conditioner-after-wait guidance.
- [Draft standard](../../../docs/research/bondbuilder-inci/draft-v0.4/standard.md): category/property definitions and honest calibration/validation boundary.
- Immutable v0.3 packet/adjudication: exact raw INCI, original source registry and **historical** per-property confidence. Redken's displayed INCI is explicitly replaced in this new display snapshot with the owner-selected Douglas list; frozen data are unchanged. Other raw lists are copied literally, including K18's peptide spacing and OGX's source transcription.

`snapshot.json` is a manually consolidated **display snapshot**, not a lane output or v0.4 assessment envelope. Owner trust, researched evidence, inherited internal fit, open research and historical confidence are distinguishable. Current v0.4 confidence is not invented. Six medium/high products meet only the trust floor; no catalog-intake/global-readiness count is asserted. Existing catalog status is not queried or assumed.

No new external research was run for this presentation. Source retrieval date remains 2026-09-30; original access/applicability limits remain in the records. Missing creator takes are neutral, inaccessible titles are not verdicts, and technology/system evidence is not presented as an exact-product trial.

## Verification and disposition

### Consolidated method handoff — subsequent 2026-10-01 pass

The [current handoff](../validation-integration-handoff-2026-10-01.md) records synchronization of the standard, prompt, runbook and blind guide with final owner rulings. The Lab footer now reflects that synchronization; its product/source/owner-grade data did not change in this subsequent pass. The read-only `node plans/bondbuilder-research-engine/verify-review-draft.mjs` check passed for all eight records and key application constraints. The updated method remains unfrozen/not intake-active. Earlier receipts below describe their dated revisions; the previous synchronization warning is now superseded, not a current gate. Browser checks were not rerun.

### Application follow-up and final owner policy — 2026-10-01

[Dated findings and owner-policy addendum](../application-followup-2026-10-01.md) records this subsequent pass. Producer pages were rechecked for remaining application facts; original source entries retain their original dates. New overlay sources F01/F02 identify the Oct 1 Aveda/OGX checks. Aveda now has sourced gel-cream texture, root-to-tip application, conditional cadence and separately attributed manufacturer diameter positioning. OGX now has a qualitative small dose and ends-upward distribution, explicitly UK-bound. These new findings supersede the earlier unfinished-fact notes below, not frozen research records.

The preview no longer proposes `bond_repair_intensity`. Physical-format examples remain separate from old mixed role/format enums. All five comparison columns are visible in the markup. Aveda's conditional cadence preserves the manufacturer's overlapping damage labels without imposing a default. New submissions default to low trust / not Chaarlie-recommended under owner policy; current pilot grades remain unchanged, and pilot recommendation status is not inferred.

Verification: JSON and inline JavaScript parse; all eight panels rendered in a local DOM stub; follow-up and proposal source IDs resolve; eight comparison rows; no intensity field in any rendered proposal. Local cadence remains null for P04/P05/P08; Aveda now has conditional cadence. The preview server returned the updated overlay. `git diff --check` passed. This revision was **not browser-verified**; earlier screenshots/browser receipts below remain historical. No production build, engine execution or database operation was run. Draft v0.4 requires synchronization with the final owner addendum before any next batch.

### English review and proposed storage values — 2026-10-01

Nick requested English for this internal Lab and concrete proposed database values. `review-values.en.json` supplies English display copy and review-only storage examples; the original `snapshot.json`, raw INCI, source registry, owner grades and historical confidence are unchanged. Official product names and verbatim ingredient text retain their original language. This internal exception does not change German customer-facing copy.

Each product shows compact English spec codes and explicit nulls. `technology_family`, `claim_trust_level` and provenance `trust_basis` need the planned persistence contract; the current spec enums are reused for application mode / format / treatment mode only where defensible. No intensity is inferred from trust. Unsupported OGX overnight placement / serum format and unfinalized Aveda / Première format mappings remain null. These are partial proposals, not insert-ready existing-schema rows.

Expandable storage examples bind frequency to the selected source / market and separate wash-based courses from weekly counts. Detailed OLAPLEX, K18 and epres examples preserve exact waiting / rinse order, an open-ended starting pump dose, optional conditioner after four minutes and intended-bottle dilution / minimum duration. Their illustrative `application_facts` and cadence shapes are not an accepted runtime schema or implemented compiler. Missing local frequency stays null; AU / US complements and Aveda weekly context remain guidance notes. Personal scheduling stays routine-owned. No standard, research grade, scheduling rule, adapter, migration or database record is changed.

Verification for this revision is recorded after the checks below; previous screenshot and error/retry evidence describes the earlier German preview, not this revision.

English revision verified: JSON and inline JavaScript parse; eight unique matching display identities; projected non-null application / format / treatment codes match current repository enums; proposal source IDs resolve. OLAPLEX three-minute contact, K18 four-wash / every-fourth course and optional four-minute-after care, and epres ten-minute minimum / 150 ml finished mixture checks passed. Open local frequency and unsupported placement / format values remain null. Chrome visibly rendered English K18, epres and Première details, expanded K18 / epres JSON and the eight-product comparison. Première's no-rinse-before-shampoo guidance and separate US recommendation remain visible. At 390 px, document width is 390 px and audit width 358 px; no page-wide horizontal overflow. Temporary viewport override reset. [English desktop evidence](desktop-english.png).

Not rerun for this revision: load-error/retry browser injection, exhaustive source-link access, production CI/build or v0.4 research. The updated loader's error path was inspected and inline syntax verified; the earlier error/retry receipt is historical only. No persisted tests or production seams were added for this bounded display artifact.

Snapshot: eight unique identities, 3/3/2 grades, five recognized technology families, resolved source references, exact Redken list and all listed formula markers present after documented spacing normalization. Inline JavaScript syntax checked. Browser checks cover selection, evidence expansion, comparison, narrow-screen layout and load-error/retry; their actual outcomes are recorded after verification below. Frozen v0.3 completed verifier and whitespace checks remain separate checks.

Verified: all snapshot checks above passed; `git diff --check` passed; the completed v0.3 verifier still reports 56 matching hashes, eight products and no activation. Chrome visibly rendered OLAPLEX, K18 and Première selection; K18's four-minute optional-care sequence and Première's no-rinse-before-Shampoo layering; expanded research/practice disclosure and original source links; the eight-row comparison. At 390 px, the first mobile check caught an automatic grid minimum widening the audit; after a `minmax(0,1fr)` correction, measured document width is 390 px and audit width 358 px, with readable stacked fields. Viewport override was reset. A separate temporary local test server returned 503 for the first JSON request; visible error/retry then restored the eight-product view. The test server was stopped; only the deliverable server remains. [Desktop evidence](desktop.png), [mobile evidence](mobile.png).

Not claimed: exhaustive external-link accessibility recheck, a production build/CI run, current catalog readiness, v0.4 classification confidence, persisted review state or engine activation. The in-app-browser connection failed; Chrome was used for the verified preview. This bounded display mockup does not introduce an implementation plan or reopen the reviewed engine methodology.

Preserve HTML, snapshot and this derivation note as task review artifacts for the eventual PR; screenshots are local visual evidence. No commit, publication or database changes are authorized by this presentation. Any future integrated Lab route, persisted review actions or research execution remains a separate workflow decision.
