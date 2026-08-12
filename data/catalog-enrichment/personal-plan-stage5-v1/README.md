# Personal Plan Stage 5 catalog and protocol program

This directory is the current, sanitized authority for the remaining Stage 5
catalog/protocol work. It does not publish products, upload assets, apply
migrations, or change feature exposure.

## Files

- `current-cohorts.json` is a historical, sanitized snapshot from 2026-08-10,
  not current launch authority. It is deliberately retained so the read-only
  cohort audit can surface drift before any manifest or apply proposal. The
  current launch cohort is `origin=curated`, active, lifecycle-active, in a
  supported Personal Plan category and has 243 products. Exact research closes
  224 products; 19 audited exceptions are prepared for a Personal Plan-only
  search disposition, without changing their global catalog state. The five
  reviewed category-null Deep Cleansing rows carry a guarded category repair target.
- `curated-cohort-2026-08-11.json` is the reviewed 243-product frozen source cohort
  used by default by the live audit. It is stable-sorted, sanitized, and binds
  its exact content with a SHA-256 fingerprint.
- `S5-21-product-search-dispositions.json` is the Nick-approved 19-product
  exception manifest. Apply still requires an exact clean reviewed head,
  matching fingerprint, and separate production-write authorization.
- `batch-registry.json` converts category decisions into bounded batches. A
  family protocol may remain legacy runtime data, but never counts toward
  exact-product completion.
- `protocol-research.schema.json` and `protocol-research/*.json` preserve exact
  product evidence separately from executable canonical guidance. Verified rows
  can enter the guarded existing-product protocol batch; blocked rows cannot.
- `exact-bundles/S5-*.json` keeps Mask, Leave-in, Oil, and Deep Cleansing fact
  evidence and every derived exact protocol in one atomic reviewed unit.
  Historical protocol-only manifests `S5-02`, `S5-05`, and `S5-07` remain
  evidence inputs for those categories and are superseded for apply by the
  exact bundles; never apply both paths for the same product role.
- `deep-cleansing-candidates.json` is historical candidate evidence for five
  existing catalog rows whose category key is missing. Their exact protocols
  and guarded repairs are part of this completion pass.
- `scalp-candidates/` preserves the eight previously reviewed Scalp Care
  manifests from draft PR #345. They are preparation evidence, not live rows;
  commercial state, identities, assets and fingerprints must be refreshed
  before a Scalp-only guarded apply is proposed.
- `scalp-refresh.json` records the current refresh result: seven directly
  reachable pages, one anti-bot response, and zero of the eight reviewed image
  assets present in this worktree.

## Important distinction

Every required role for every frozen curated product needs one canonical,
source-backed exact payload. Family, brand-family, and generic category guidance
may never be reported as completed coverage.

Heat Protection and Scalp Care are canonicalization inputs for the frozen cohort.
Deep Cleansing counts only after one reviewed atomic bundle has attached every
exact reset protocol and repaired all five category keys. The online Personal
Plan candidate gate is 224 exact-ready products plus 19 explicit non-searchable
dispositions; no disposed product counts as complete exact coverage.

## Read-only audit and worklist

`stage5-protocol-research.ts --audit-input <sanitized-fixture.json>` is a
non-writing deterministic audit entry point for a reviewed read-only cohort
fixture. It emits cohort drift, verified/blocked/missing exact role coverage by
category, and a product-role research worklist with canonical identity plus the
public affiliate URL as a starting point. That URL is not evidence: researchers
must still record an exact official or reputable source in the manifest.

`stage5-protocol-research.ts --live-audit [--snapshot <reviewed-cohort.json>]`
uses the server client for read-only catalog/spec/protocol selects and prints the
same JSON. It fails closed when canonical role facts are ambiguous or the live
curated active cohort differs from the reviewed frozen snapshot. It writes neither files nor database
rows. Ambiguous or legacy facts are enumerated in the combined exact-enrichment
worklist as `requires_research` category-fact patches; they never stop the
remaining cohort's protocol gaps from being reported.

`stage5-protocol-research.ts --freeze-output data/catalog-enrichment/personal-plan-stage5-v1/curated-cohort-2026-08-11.json`
is the only local artifact-writing mode. It performs the same read-only select,
then writes that explicit sanitized path; it never mutates Supabase.

## Current research result

The validator output from `protocol-research/*.json`, not a copied count in this
README, is the current research truth. A product is complete only when every
role derived from its exact canonical facts has a verified product-scoped
protocol. Blocked rows remain visible in the worklist and cannot enter an apply
batch. Mask, Leave-in and Oil additionally require their source-backed authority
fact bundle before they can pass publication readiness.

## Exact authority-fact rubric

Facts describe the exact finished product, never a brand family or one isolated
ingredient. A comprehensive manufacturer or exact retailer page may support a
known negative; a missing or partial page cannot.

- Mask repair support is `high` only for explicit intensive structural, bond,
  or repair positioning; `medium` for explicit strengthen, anti-breakage, or
  ordinary repair support; `low` only when a comprehensive exact source clearly
  positions ordinary conditioning without repair. Functional benefits are
  limited to explicit smoothing/frizz, detangling/slip, and shine claims.
- Leave-in care direction follows the finished product's explicit moisture,
  balanced, or protein positioning. Repair support follows the same graded
  rule. `post_wash_leave_in` requires exact after-wash leave-in directions;
  `pre_heat_application` requires an explicit heat-protection claim and exact
  executable directions. Functional benefits must be explicitly claimed.
- Oil weight uses exact lightweight/non-greasy, ordinary, or rich/intensive
  product positioning. Supported roles require explicit pre-wash, leave-on,
  dry-finish, or pre-heat directions. Legacy eligibility rows and a product's
  ingredient list are not evidence for role support.

If these fields cannot be proven, the product stays blocked for evidence review;
the researcher may not fill the field with a category default.

## Apply boundary

Each batch must follow `docs/product-intake-research-ops.md`. Research, manifests,
dry-run preflight and review may be prepared in code. A catalog apply, asset
upload, migration, deploy, or rollout change requires its own explicit approval.

For existing products, the dry-run entry point is:

```bash
npm run products:intake:stage5-protocol:preflight -- --batch S5-03-targeted-dandruff-shampoo
```

The apply command additionally requires the exact reviewed commit and batch
fingerprint plus `--apply --confirm`. Do not run it without Nick's approval for
that named batch.

For Mask, Leave-in, Oil, and the five Deep Cleansing repairs, exact authority
facts and protocols travel together through the atomic bundle preflight:

```bash
npm run products:intake:stage5-catalog-bundle -- --file <reviewed-bundle.json>
```

Its apply mode also requires `--apply --confirm`, a clean worktree at the
reviewed head, and the matching bundle fingerprint. A successful preflight is
never apply authority.

For the 19 researched exceptions, the Personal Plan-only disposition preflight is:

```bash
npm run products:intake:stage5-product-dispositions -- --file data/catalog-enrichment/personal-plan-stage5-v1/S5-21-product-search-dispositions.json
```

The approved manifest still requires `--apply --confirm`, a clean reviewed head,
and the matching content fingerprint. Dispositions affect new Stage 3 catalog discovery
only; they do not deactivate products globally or erase existing owner history.
