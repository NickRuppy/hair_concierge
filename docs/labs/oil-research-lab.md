# Oil Research Lab

**Current v0.10 intake connection (2026-10-16):** current `oil-lab-review-bundle-v2` packages show eleven required research values, projection and manual matching (thirteen rows). `oil-intake-review-v2` / `oil-lab-review-receipt-v2` bind exact current method, formula, identity, source and job. Historical v0.8 and local v0.9 bundles retain seventeen rows and their original receipt contract. Opening or approving this development Lab never publishes or deploys. The service CLI and explicit import boundary below remain unchanged.

Development entry: `/labs/research?category=oil`. The shared Lab keeps the selected Mask layout and the existing category pages. Oil research rules and historical values are unchanged.

- **Forschungsset:** 37 resolved immutable oil profiles, full properties/reasons/evidence and scenario-specific conditions. These approvals are local research review only; no historical profile can become a current intake approval by changing an ID.
- **Neue Forschung:** four exact European v0.9 local full profiles at `/labs/research?category=oil&dataset=candidate`. Complete properties and manually authored matching drafts require review. These have no Intake submission/snapshot binding or handoff; the 37 historical profiles and historical v0.8 Intake tuples remain unchanged. [Cohort and limitations](../../data/research/oil-inci/v1.0/eu-full-profiles-v0.1/README.md).
- **Intake-Prüfpakete:** exact current intake bundles exported by the service CLI. Matching suggestions appear separately and require explicit human approval. Missing drafts and open Nacharbeit block completion. A correction records a local request; an operator must process rework and provide a successor bundle. It does not run a worker automatically.
- **Freigeben / Nacharbeit:** saved in an oil-native local store. Current package and displayed revision are checked on every save. Product completion explicitly includes matching suggestions. It never publishes a catalog product.

## Final property-scope lock

Nick locked the [lean recurring property set v0.4](../research/oil-inci/v1.0/01_property-set-v0.4.md) under OE58. This Lab continues to display the original v0.9 candidate/v0.8 historical profiles and required rows; removed properties remain historical evidence. The 2026-10-16 integration implements that alignment in a distinct v2/v0.10 intake contract. No saved review is reset and no existing bundle is relabeled.

## Local state

The review journal and Intake bundles default to gitignored `.local/oil-research-lab/`. Local research candidates are versioned separately:

| Setting                              | Purpose                                                             |
| ------------------------------------ | ------------------------------------------------------------------- |
| `OIL_RESEARCH_LAB_BUNDLE_DIR`        | Exported intake bundles; default `bundles/`                         |
| `OIL_RESEARCH_LAB_REVIEW_STATE_PATH` | Native approval/rework/handoff journal; default `review-state.json` |
| `OIL_RESEARCH_LAB_CANDIDATE_DIR` | Optional copied candidate bundles for isolated QA; default `data/research/oil-inci/v1.0/eu-full-profiles-v0.1/bundles` |
| `OIL_RESEARCH_LAB_CORPUS_DIR`        | Optional copied historical corpus for isolated QA                   |

Use temporary copied bundles/stores for browser tests; never write approvals to the real cohort during QA. All page/API routes are development-only. Other categories retain their native stores and approvals.

## Intake handoff

```sh
npm run product-intake:oil-lab -- export --submission-id <uuid>
npm run product-intake:oil-lab -- import --bundle <absolute-bundle-file>
npm run product-intake:oil-lab -- import --bundle <absolute-bundle-file> --apply --confirm
```

Export reads current intake and writes a local review bundle. Import without `--apply` is a read-only dry run. Applying import requires service access and the database migration; it records the exact completed properties/matching review, with current image/brand prerequisites still required for final readiness. It never invokes catalog publication or replaces researched product data. Applying this migration or importing a live receipt requires the corresponding explicit authorization; implementation tests use an isolated database.

After transfer the exact bundle becomes read-only. Further corrections use intake rework and a new bundle. A timeout may mean the server committed: the journal remains pending until exact receipt read-back confirms the outcome. Retry uses the same token; do not fabricate another receipt or clear state to force a retry.

## Lock recovery

Review and handoff share an exclusive local lock plus atomic state writes. A hard process death can leave `<review-state-path>.lock`; no automatic stale-lock stealing is performed. First confirm no process owns that exact lock (for example with `lsof`), inspect the saved handoff token and reconcile any pending import through the read-only receipt RPC. Only after confirming no active owner and the transfer outcome should the operator remove that exact orphan lock. Retry the normal CLI so it seals a confirmed imported receipt or retains an unresolved pending state. Never delete the review journal, invent a success, or unseal an uncertain transfer.

## Engine boundary

Historical richer profiles retain base, named oils, weight, dispenser, penetration, heat/UV, uses, persistence, ingredient flags and conditional fit. Current v0.10 profiles use the final lean minimum and optional supplementary research. The production projection owns only weight, fibre roles and heat protection. Manual eligibility/thickness/legacy tags are not inferred from fit. The fresh worker candidate uses separate current method and server-derived hashes; the current v0.10 entry is registered in code; the running release is unchanged until separately authorized deployment. Deployment, live jobs, activation and catalog writes are separate from opening or approving the Lab.

## Database verification

The publication lock proof requires actual PostgreSQL, not just the in-process SQL harness. On this workspace it uses Docker context `colima-chaarlie` and a disposable `postgres:17` container with networking disabled:

```sh
OIL_LAB_POSTGRES_TEST=1 node --import ./tests/server-only-register.cjs --import tsx --test tests/oil-lab-publication-postgres.test.ts
```

Ordinary test runs skip this test unless that environment variable is set. The proof exercises two-session import/rework and publication/rework interleaving, rollback and privileges against a minimal predecessor fixture. It does not prove a full production migration-history replay or authorize a live migration.
