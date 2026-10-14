# Product-image tooling: complete bounded second-layer audit

Verdict: **19 declarations across4 complete files:18R,1 conditional C,0F,0D.** Proposed19→19→18. No source, SQL, helper or CLI retirement. Static-only discovery; main alone owns test/fault runs, edits and final coverage acceptance.

## Prior scope and ownership

Searched /tmp test-audit ledgers and semantic maps for all four exact filenames; no prior full judgment found. Previously completed tooling74 cohort covered worktree/CI/provider-webhook operations; operator-leaves53 covered affiliate/legacy ingestion/metadata; research-tooling108 covered catalog/price/mobile. These image files were outside those complete cohorts. Billing/Customer.io tooling was skimmed as navigation, not part of the19-site count and not represented as fully audited here.

Whole files read: all19 test declarations and all fixture/helper/parameter bodies; product-thumbnail.ts, backfill-product-thumbnails.ts, product-images/batch-run.ts, the complete thumbnail migration, both CLI helper modules. No parameterized test declarations or omitted table rows. The synthetic image helper loops every pixel; the three thumbnail tests include two invalid-image assertions in one declaration. Full byte snapshots, exact callback bodies/titles/hashes and26 readset hashes are in /tmp/test-audit-image-tooling-evidence.json. Larger finalizer/persistence and Sharp modules were read at relevant callsites/codec paths, not audited in full.

## Whole declaration ledger

### tests/product-thumbnail.test.ts

|Line|Class|Exact title|Independent risk / keeper|
|---|---|---|---|
|21|R|generates a versioned 144px WebP thumbnail keyed by the full canonical hash|Transparent320x200 PNG → actual144px WebP, alpha, full source/output hashes, exact path/version and size. Backfill uses opaque1200px WebP and does not observe alpha preservation or decoded output.|
|67|R|produces a different immutable path when canonical bytes change|Two JPEG byte buffers differ only at last byte; both decode and must produce different source hashes/paths. Existing rerun uses identical canonical bytes and cannot detect hashing decoded pixels instead of source bytes.|
|88|R|rejects unreadable and animated canonical files|Both malformed bytes and animated GIF must reject with distinct messages. Backfill inputs all valid still images; no surviving equivalent input.|

### tests/product-thumbnail-backfill.test.ts

|Line|Class|Exact title|Independent risk / keeper|
|---|---|---|---|
|33|R|dry-run accounts for image and no-image rows without writes|Dry-run has image-bearing plus missing-image rows and verifies zero upload/pointer calls and planned/not-applicable statuses. Apply fixtures cannot prove no writes.|
|70|R|apply creates a missing object and compare-and-set pointer|Missing-object apply observes actual upload/pointer requests and created status. Reuse/race paths have existing bytes or matching pointer, so cannot replace missing-object write success.|
|110|R|apply reuses a valid stored thumbnail and refuses a source-change race|Valid stored object plus stale-source update result=false must avoid overwrite and report canonical_source_changed. Full rerun avoids updatePointer entirely; cannot prove refusal on failed CAS.|
|164|R|refuses canonical URLs outside the owned product-images bucket|External canonical URL must be refused without fetching. Owned URLs elsewhere never reach this trust boundary.|
|187|R|a full rerun reuses the matching object and performs zero writes|Expected URL already matches and valid stored bytes exist: zero upload/update calls and reused status. Earlier valid-store scenario has null pointer and false CAS, so cannot prove idempotence.|

### tests/product-image-thumbnail-migration.test.ts

|Line|Class|Exact title|Independent risk / keeper|
|---|---|---|---|
|10|R|adds a nullable versioned thumbnail URL that is cleared with canonical replacement|Nullable column/versioned URL syntax plus canonical replacement trigger clear stale pointer. Application projection mocks do not execute SQL trigger. Retain as cheapest independent cross-artifact guard; syntax checks are not SQL execution proof.|
|18|R|wraps product intake approval and validates matching source-hash metadata|Approval wrapper delegates old transaction and carries validated paired hash/thumbnail data, including legacy both-absent branch. No runtime SQL approval keeper in scoped cohort.|
|36|R|adds service-role-only v3 search by delegating to v2 and restoring its order|V3 delegates V2, projects thumbnail, restores ordering, revokes public/anon/authenticated and grants service role. Existing persistence fake RPC returns data without executing SQL or permissions; source contract stays.|

### tests/product-images-batch-run.test.ts

|Line|Class|Exact title|Independent risk / keeper|
|---|---|---|---|
|39|R|alphaCoverage: fully transparent canvas is 0|Transparent10x10 zero-alpha canvas returns0. Real processItem examples both have nonempty subjects and never exercise all-transparent fallback; retain.|
|44|R|alphaCoverage: matches the known opaque fraction of a synthetic square|Synthetic10x10 opaque square on20x20 canvas establishes exact0.25 density. Process fixtures use80/100 and900/940 dimensions; transferring a different ratio would not preserve original literal contract.|
|52|C|haloScore: a uniformly bright subject has ~0 boundary halo|C1: Same bright RGB235/230/225, alpha0/255, nonempty boundary and radius5 are already processed by clean high-res keeper; preserve original score<0.02 assertion against actual result.metrics.halo_score without new calls/inputs.|
|62|R|haloScore: a warm dark ring around the boundary scores high|Warm ring3px around30px square calibrates boundary density>0.5 at radius5. Composed80px square uses6px ring: changing radius to11 could lower narrow-ring score below0.5 while broad-ring remains above0.5. Distinct geometry; retain.|
|76|R|haloScore: a dark but neutral (non-warm) boundary ring does not trigger the heuristic|Neutral dark40/40/40 ring exercises saturation exclusion with lum<200; clean bright image exercises lum>=200. Removing sat>=6 would false-flag neutral dark and still pass bright/warm tests.|
|90|R|haloScore: empty canvas does not divide by zero|Transparent8x8 canvas yields boundaryTotal0 and must return0 rather than NaN. No processItem keeper reaches haloScore on empty subjects because alpha admission exits first.|
|117|R|a low-res source with a shadow halo reports BOTH reasons, not just the last one|Actual processItem low-res100px warm-ring source accumulates low-res and deshadow-skipped reasons, path and flagged status. Direct halo helper cannot detect reason overwrite or process routing.|
|142|R|a clean high-res source is ok with no reason at all|R keeper C1: Existing actual processItem940px clean PNG produces ok/no reason/alpha_passthrough, now additionally preserves original near-zero score bound.|

## C1: complete original union at an existing real boundary

Donor: tests/product-images-batch-run.test.ts:52, **haloScore: a uniformly bright subject has ~0 boundary halo**. Keeper: same file:142, **a clean high-res source is ok with no reason at all**. Both are unchanged in repository at discovery. Candidate JSON includes both complete original statements/bodies, proposed keeper, whole before/transfer/cut bytes and hashes. /tmp/test-audit-image-tooling-{transfer,cut}.ts are prospective copies only.

The donor creates a30px square with8px transparent margin and RGB235,230,225; keeper creates a900px square with20px transparent margin and the same RGB. Both use exactly alpha0 outside/255 inside and default halo radius5. These are not byte-identical images. The source-grounded equivalence is narrowly the bright-subject near-zero halo contract: haloScore's BFS walks a nonempty boundary; all retained colored pixels have luminance230.925 >=200, so none satisfies warmDark's lum<200 predicate. Saturation10 and r>=b are also identical. Both margins exceed radius; no small-subject fallback or dimension-specific threshold exists in haloScore. The dimensions influence boundaryTotal but cannot change zero warmDark/boundaryTotal for this homogeneous bright input. The donor has no geometric-calibration assertion. Retained warm/neutral/empty tests independently preserve geometry, darkness/saturation and denominator-zero behavior.

The keeper does not inject a score: scratchRun writes its synthetic RGBA buffer as PNG; processItem resolves/copies the source, reads metadata, runs alpha_passthrough through Sharp to PNG, readRgba obtains actual RGBA, then invokes actual alphaCoverage and haloScore before returning metrics. The supplied pythonPath=null is not used on clean halo; no Vision/deshadow/provider path is required. Existing ok/null-reason/path assertions remain byte-exact. The sole addition is:

    const score = result.metrics.halo_score
    assert.ok(score < 0.02, `expected a near-zero halo score for a clean subject, got ${score}`)

This transfers the complete sole donor assertion verbatim using a local alias. No input, source file, render, fixture row, owner invocation, expected bound or assertion count is invented. Transfer temporarily adds one assertion while donor remains; cut removes one callback and the redundant direct helper call. All17 callbacks other than the donor and receiving keeper remain byte-exact (including six unrelated callbacks in edited file); keeper receives only those two statements. The haloScore export still serves warm/neutral/empty helper tests and its real processItem caller, so no export retirement is claimed.

## Real-owner control, pending main execution

scripts/product-images/batch-run.ts:277 currently returns boundaryTotal >0 ? warmDark / boundaryTotal :0. The proposed unique parsed control adds Math.max(0.03,...) only to the positive-denominator return. This credible accidental numerical floor produces0.03 for clean images, below production HALO_FLAG0.05. Existing keeper status=ok/reason=null/path=alpha_passthrough would therefore still pass, but the transferred <0.02 assertion must fail. Exact transfer assertion line156, cut line148; explicit diagnostic message already exists, avoiding bare-assert formatting ambiguity. Source old/mutated hashes and unique anchors are in candidates JSON. No source fault was applied or executed.

Main should require selected keeper1pass→actual ERR_ASSERTION at the transferred bound→byte-exact source restoration→1pass before accepting C1. Then full4file cohort/native/coverage proof remains mandatory; this discovery does not claim runtime or2pp results.

## False positives retained after second pass

- Alpha density helper's literal0.25 is not the same expected fraction as composed80/100 or900/940 input. Adapting expected geometry would drop the original literal calibration. No new geometry input is added for quota.
- Warm ring is materially different: donor3px ring/30px subject vs composed6px/80px. At erroneous radius11, donor warm fraction324/836≈0.388 violates >0.5, while composed1776/3036≈0.585 still passes >0.5. No transfer of that calibration.
- Neutral dark40/40/40 reaches lum<200 plus sat0; bright reaches lum>=200. Losing the minimum saturation filter only fails neutral. Empty halo never reaches processItem's halo call because alpha admission returns early.
- Backfill full rerun uses generateProductSearchThumbnail to construct its matching stored path, but its contract is idempotence/zero writes for a matching pointer. It is not independent proof that generator dimensions/path are correct; the separate generator byte/alpha contract stays. Backfill source-change refusal checks actual orchestration using an injected false CAS result; it does not execute the Supabase compare-and-set SQL. No claimed stronger persistence proof.
- Thumbnail generator's two JPEG buffers differ in source bytes while preserving decode plausibility. Hashing decoded pixels could make the two paths equal while a one-image source-hash example still happens to pass; retain full-byte change contract. Opaque backfill cannot replace transparent PNG alpha preservation.
- SQL source tests independently protect nullable versioned path, stale-pointer trigger, legacy both-absent approval inputs and V3 grants/order/delegation. Stage3 persistence test at1446 supplies an already-made RPC response and observes only name/mapping; it cannot establish installed SQL permissions or transaction behavior. No SQL retirement or source-guard D.

## Entry/caller/dependency/history/CI evidence

package.json:97 products:images:batch invokes batch-run.ts; :100 products:intake:backfill-thumbnails invokes the backfill. batch-run main:508 calls processItem for each input, serializes all metrics/path/reasons to results.json; docs/scan-db-expansion-playbook.md:48–62 requires this automated triage plus human contact-sheet review. Process metrics are thus operator output, not test-only values. cli-args supplies parsing; no CLI or external command was invoked.

The thumbnail generator also has live future-intake callers in finalize-package-image.ts:457 and605 that generate derivative files and provenance from canonical bytes. Backfill main:249 calls the same builder using actual Supabase ports; its update at:230–236 binds id and expected canonical image. The complete generator/backfill owners preserve no-image/external URL/dry-run/stored verification/upload/reuse/CAS/catch branches. Supporting adapters were read, not called.

Thumbnail migration creates the trigger/wrapper/V3 function. src/lib/personal-plan/products/stage3-persistence-supabase.ts:327 selects V3 when thumbnailsEnabled; tests/.../stage3-persistence-supabase.test.ts:1446 exercises this with a fake RPC. plans/product-image-thumbnails.md:19–31 requires immutable full-source SHA paths, separate canonical/derivative fields, alpha, and V2-owned authorization with V3 ordering. No historical-completion argument retires continuing intake or runtime migration contracts.

History9a81a7b8 (#414) introduced the fast thumbnails and associated plan/tests. b6d146af (#509) introduced the batch tooling/tests and explains accumulated reasons, min800px quality gate and15% deshadow silhouette-loss refusal. These are positive operator contracts, not stale test exports.

Sharp dependency inspected directly: lib/constructor.js defaults PNG palette=false/bitdepth8; lib/output.js:570–650 documents/sets full-color PNG, :1260–1303 raw8-bit left-to-right RGB(A); lib/channel.js:61 ensureAlpha; lib/input.js raw width/height/channels; src/pipeline.cc:1143–1156 passes PNG save options without palette quantization, :1064–1084 emits raw memory. This supports unchanged opaque subject RGB/alpha in the existing composed lane. No Sharp/native operation ran during this audit; actual transfer test must confirm platform behavior.

All4 files are included by package.json:49 tests/*.test.ts, invoked by unconditioned .github/workflows/ci.yml:158 test:node with the same register+tsx lane. Focused command for main after serialization:

    node --import ./tests/server-only-register.cjs --import tsx --test tests/product-thumbnail.test.ts tests/product-thumbnail-backfill.test.ts tests/product-image-thumbnail-migration.test.ts tests/product-images-batch-run.test.ts

No repository edits, source mutations, tests, DB/provider/environment reads, external review, publication or new source seams. Only /tmp artifacts changed. This is one high-confidence conditional transfer, not a claim that nineteen tests are redundant.
