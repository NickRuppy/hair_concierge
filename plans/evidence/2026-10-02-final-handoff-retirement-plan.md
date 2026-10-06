# Product Intake final-image handoff retirement — independent second pass

2026-10-02. Read-only scope: `apps/product-intake-review/app/api/submissions/[submissionId]/publish/final-image-handoff.ts`, its two helper-only test declarations, their fixtures, and the retained malformed-shampoo validator assertion. **Accept exactly 2 D declaration removals, conditional on the direct validator fixture passing and the current caller closure staying empty.** No repository edit, test/compile runner, mutation, environment-file read, provider/DB call, approval command or reviewer dispatch was performed. Main is the sole writer/operator and owns integration and final coverage.

This is a code-retirement decision under the existing campaign authorization, not Product Intake publication or workflow sign-off. Applied `test-audit` and the Product Intake skill only to establish workflow authority; consulted the runbook's workflow/core/safety/readiness/cockpit and canonical image/approval sections. No approval renewal is required for this bounded cleanup.

## Why this is genuinely unreachable

- Current `publish/route.ts:10–25` runs the local-route check and returns HTTP409 with the explicit approve-package CLI command. Its imports are only NextResponse and the local-route guard. It never imports or calls this module, creates a service client, uploads an image or approves a product. Keep this route and its fail-closed test.
- Current `publish-preflight/route.ts:22–39` passes `publishRouteEnabled:false`, invokes the real submission validator, and combines blockers. It is a live review-state path, not a path to the orphan helper. Keep it.
- Current exact tracked source/type/path census finds references outside the module only in `tests/product-intake-research-jobs.test.ts`: one import plus calls in the two candidates and malformed-shampoo test. This includes **three** exported functions, not the ledger's “two exports”: `finalImageUploadDecisionFromArtifacts` (:69), `buildResearchedPayloadWithFinalImage` (:152), and `uploadFinalizedReviewImage` (:277). The uploader has no current caller, including tests. Exported types `FinalImageUploadDecision`, `FinalImageUploadResult`, `PublishReviewMetadata` are confined to this file.
- The module is an ordinary `.ts` sibling of `route.ts`, with no executable main block or registration side effect. Next route discovery does not make this helper a request handler. Current app configuration sets only tracing root; it has no plugin/glob loader for sibling helpers. The core package's only public barrel exports `jobs` and `repository`; neither dynamically registers this module. Relevant app/script dynamic imports, require/glob/readdir paths do not load this helper. A filesystem typecheck include is not an operational caller.
- Canonical `package.json:103` invokes `scripts/product-intake/approve-package.ts`. That complete294-line module uses `uploadApprovedPackageImage` from `upload-package-image.ts`, its own `researchedPayloadWithFinalImageMetadata`, `saveResearchedPayload`, and `approveSubmissionById`; it never imports this app helper. Its explicit apply/confirm checks and upload→save→approval ordering remain untouched (`approve-package.ts:203–272`). The runbook's image/upload/approval sections describe this package path. The upload module is separate, including package-local path checks and paired asset verification. Do not remove any of it or its dependencies.
- History is not merely inferred from naming. Historical development commit `567f2d8c` (2026-07-03) has the former publish route importing all three helpers and calling the image preparation/upload path. **That commit is not an ancestor of current HEAD**; it is evidence of the old development implementation, not a claimed current-lineage removal diff. Current-lineage consolidation `b4fb21f4` (2026-07-06) already introduces the locked409 route with no such import while retaining the helper. Later `12619247` and thumbnail commit `9a81a7b8` modified the orphan file; the latter added thumbnail metadata/checksum behavior but did not restore a caller. These later edits are evidence that the file was maintained, not evidence of an executable tool contract.

The runbook contains broad language about a guarded cockpit final action, but current route, preflight flag and retained fail-closed test explicitly select the CLI handoff. Removing an uncalled sibling does not remove or relax that gate, nor decide whether a future cockpit publish UI should exist. No current supported command, barrel API or route depends on the module.

## Exact losses and retained distinctions

1. **D1:** `tests/product-intake-research-jobs.test.ts:1087`, `final handoff normalizes every category into approval-validator shape`. Complete body read. Its one declaration loops10 category fixtures; it asserts the orphan builder normalizes rows-wrapped specs, produces canonical identifiers, preserves per-table array/object shape and values, fills parent rationales, then satisfies the validator. These are obsolete adapter-input transformations. They are not claimed redundant with the current CLI and should not be copied into it. Remove one declaration, not10 row credits.
2. **D2:** same file:1347, `cockpit publish handoff promotes the processed image storage URL into the approval payload`. Complete body read through its closing line1530. It passes two fabricated processed-image artifacts to the orphan selector and an old payload to the orphan builder. Assertions cover choosing the older ready artifact over newer stale one, image/thumbnail paths and hashes, review metadata, manufacturer/retailer identifier aliases, spec hoisting and row unwrapping, parent rationale promotion, dropped top-level spec_operations and nonmutation of original image/review fields. It never calls a request handler or the uploader. No current publish behavior is removed by deleting this helper-only replay.

Do not relabel these as transfers to the CLI: the CLI's package shape and operations differ. Existing `product-intake-approve-package.test.ts` controls remain: complete file was not re-audited here, but relevant upload and ordered apply bodies were inspected. Its real uploader fixture captures upload/download without a provider; its apply fixture captures load→upload→save→approve. Those tests establish an active separate owner, not universal equivalence with the retired cockpit helper.

**Retain** `shampoo approval specs require explicit scalp routes` at:1060. It observes the live validator's rejection of `scalp_route:null` with the precise sole diagnostic `final.category_specs.product_shampoo_specs.0.scalp_route`. Only its fixture construction currently depends on the dead handoff. Preserve both `validation.ok === false` and exact `missingFields` array. A broad false assertion alone is inadequate because other missing approval/protocol fields can also fail.

## Direct malformed-shampoo fixture

Replace the call to `buildResearchedPayloadWithFinalImage(approvalReadyPayload(...),...)` with an inline **already shaped final approval input**. Preserve its observed validator input, rather than recreating hoisting/identifier-normalization/review-stamping logic. Concretely:

```ts
const payload = {
  final: {
    product: {
      canonical_brand: "Audit Brand",
      product_line: null,
      clean_name: "Audit shampoo Product",
      category_key: "shampoo",
      suitable_thicknesses: ["normal"],
      affiliate_link: "https://example.test/product",
      image_url: "https://pqdkhefxsxkyeqelqegq.supabase.co/storage/v1/object/public/product-images/product-intake/audit/final.webp",
      price_eur: 9.95,
      currency: "EUR",
      purchase_link_status: "available",
      purchase_link_checked_at: "2026-07-02T10:00:00.000Z",
      price_checked_at: "2026-07-02T10:00:00.000Z",
    },
    identifiers: [
      { type: "ean", value: "4063528086280", source: "https://example.test/product" },
      { type: "retailer_sku", value: "NQ-HO-RO-201", source: "https://example.test/product" },
    ],
    category_specs: {
      product_shampoo_specs: [{
        thickness: "normal", shampoo_bucket: "trocken", scalp_route: null,
        cleansing_intensity: "regular",
      }],
    },
    sources: [{
      url: "https://example.test/product", title: "Audit product page",
      evidence: "Source supports the reviewed product fields and category specs.",
    }],
    field_rationales: {
      "product.canonical_brand": "Reviewed evidence supports product.canonical_brand.",
      "product.clean_name": "Reviewed evidence supports product.clean_name.",
      "product.category_key": "Reviewed evidence supports product.category_key.",
      "product.suitable_thicknesses": "Reviewed evidence supports product.suitable_thicknesses.",
      "product.affiliate_link": "Reviewed evidence supports product.affiliate_link.",
      "product.image_url": "Reviewed evidence supports product.image_url.",
      "product.price_eur": "Reviewed evidence supports product.price_eur.",
      "product.purchase_link_status": "Reviewed evidence supports product.purchase_link_status.",
      "category_specs.product_shampoo_specs": "Reviewed evidence supports category_specs.product_shampoo_specs.",
      "category_specs.product_shampoo_specs.audit_child": "Reviewed evidence supports category_specs.product_shampoo_specs.audit_child.",
    },
    review: {
      manual_reviewed: true, reviewed_by: "nick",
      reviewed_at: "2026-07-02T10:30:00.000Z",
      notes: "Audit approval-shape normalization.",
    },
  },
}
```

This is a literal test fixture, not actual review metadata or an approval. Do not retain the malformed `EAN`/manufacturer_no identifiers or manual_reviewed:false from the old input-builder: those relied on the removed adapter and would make this fail before the intended shampoo schema. Do not “fix” scalp_route from null to dry. No approval helper or spec normalization implementation is needed in the test.

Actual reachability: `validateProductIntakeApprovalPayload:1189` parses the outer approval object, validates rationales, then invokes the shampoo validator; `shampooRowSchema:500` requires the enum `scalpRouteSchema`. Category failure returns before protocol validation at:1235. The original fixture has no application protocols, so it is intentionally not a fully valid approval if the scalp error is removed. Keep that limitation explicit.

Required actual-owner control: temporarily change the *shampoo row's* `scalp_route: scalpRouteSchema` to `scalp_route: z.preprocess((value) => value === null ? "dry" : value, scalpRouteSchema)`. This accepts the malformed null as a matching route for bucket trocken. The keeper must fail its exact missingFields assertion because the live validator advances to missing `final.category_specs.product_application_protocols`, rather than the intended scalp_route rejection. `ok` may remain false; that is why this diagnostic oracle matters. Simply adding `.nullable()` is ineffective: the matching-bucket refinement can still reject null at the same path. Run this one control with before/red/after and byte-exact restore under main's exclusive window; no dead uploader mutations are appropriate.

## Cleanup closure and checks

Delete the entire orphan module, including its three functions, three exported types, private normalization/image helpers/constants and node crypto/fs/path imports. Do not remove node/package dependencies: the app/core/CLI still use Supabase and those capabilities elsewhere. No package.json or lockfile change is warranted.

After making the retained fixture direct, remove its module import and the now-dead test-only support closure from the same test file: `REVIEW_CATEGORY_KEYS`, `ARRAY_SPEC_TABLES`, `exactProtocol`, `approvalReadyPayload`, `legacyRowsWrappedSpecs`, `validCategorySpecsForAudit`, and the unused imported `ProductIntakeReviewCategoryKey` type. Reference census shows no users beyond these candidates and the converted fixture. The remaining `validateProductIntakeApprovalPayload` import stays. Other retailer-parser changes in this shared test file belong to main's separate batch; preserve them.

Retain the publish-lock declaration at:1324 and all worker/repository/review-decision/property-row tests. Recheck module path and all exported symbol/type names across tracked code, docs and script entrypoints immediately before deletion; no dynamic/barrel consumer was found in this review.

Parent-run verification after its current mutation window is released:

```sh
node --import ./tests/server-only-register.cjs --import tsx --test tests/product-intake-research-jobs.test.ts tests/product-intake-review-workflow.test.ts tests/product-intake-approve-package.test.ts
npm run products:intake:review-cockpit:verify
```

Run native before, direct-fixture transfer-only, then after deletion; expect exactly2 fewer declarations/runtime cases from these two cuts, with no new site. The category table is inside one declaration. The root Node command includes these tests (`package.json:49`; CI:158). The review app is intentionally excluded from root app checks; its own workspace typecheck/lint/build (`package.json:121`) is needed for deleting an app-local source file. Main's full coverage accounting still applies. Do not invoke approve-package, upload-image, research-worker, review-center launcher or any dry-run that creates a live Supabase client as a verification substitute.

## Limits and verdict

Full orphan module, both entire candidate declarations, malformed-shampoo declaration and all their local support fixtures were read. Also read the complete locked route/preflight, canonical approve-package module, core barrel/app config and relevant uploader/test bodies, validator parsing/category/protocol paths, runbook sections and historical route snapshots. Did not audit every Product Intake test, every canonical uploader branch, live queue/provider state, hidden/untracked operator scripts or production tooling outside this repository. No runtime/coverage success is claimed.

**Verdict: supported 2 D cuts and complete orphan-module removal after the direct live-validator fixture transfer.** Current caller closure and locked route, not the helper's name or weak test style, justify retirement. The active approval CLI and malformed route-value guard remain intact.
