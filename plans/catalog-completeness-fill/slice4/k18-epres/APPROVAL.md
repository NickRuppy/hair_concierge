# Approval: re-seal K18 + Epres for two small fixes

Status: **prepared and rehearsed. Not applied. Waiting for your approval.**
Batch fingerprint: `4d6c85f4dcbd6df83c95c3720d6aa3f1705e099f44dc24de806a989a4b9d8dd5`

## What changes for users

| Product | Field | Today | After |
|---|---|---|---|
| K18 Leave-In Molecular Repair Hair Mask | Rhythm on the routine card | „Nach einer Salonbehandlung vier bis sechs Haarwäschen hintereinander, danach nach Bedarf." | „Die ersten vier Haarwäschen hintereinander anwenden, danach bei jeder vierten Haarwäsche." |
| Epres Bond Repair Treatment | Net content | missing | 30 ml |

Your rulings already settled the content: B3 for K18 and Group E for Epres. This approval is about the step that carries the content into the catalogue.

## Why you have to approve this step

On 2026-10-04 you approved a sealed copy of each product. The seal pins the full product row and protocol row, timestamps included. It is the only reason both products may be published. Their research profiles still carry protocol holds: 3 for K18, 2 for Epres. The strict check therefore refuses them without the seal.

If either field changes, the seal stops matching and the product loses publication readiness. The rehearsal shows this. Carrying the change means writing a new seal around the changed row. The lane has no approved operation that does this:

- `bondbuilder_research_enrich_v1` checks the unchanged package before it seals anything. It cannot seal a changed one (`supabase/migrations/20261002132306_bondbuilder_research_profile_storage.sql:341-343`).
- The seal is valid "only for the identical pre-existing package" (same file, `:367`, `:374`).
- Precedents say the same thing. P08 says "any drift requires new review" (`20261007080123_…_p08.sql:4`). #660 says "Every other byte still has to match" (`20261011120000_…:12`). The OGX amendment did not re-seal anything: it rewrote the profile and passed the strict check, inside a promotion you approved.

So the new seal is new authority. It is recorded as `reviewed_by = nick`, which needs your yes.

## What you approve

1. **New seal = the old seal with only these differences.** The migration refuses if anything else differs:
   - K18 (seal `bondbuilder-research-v1:3bc94c6f…`): `protocols[0].cadence` gets the copy above, and `protocols[0].updated_at` becomes the apply time.
   - Epres (seal `bondbuilder-research-v1:e777a56b…`): `product.net_content_value/unit` change from NULL/NULL to 30/ml, and `product.updated_at` becomes the apply time.
2. **Sources.**
   - K18: k18-hair.de (DE brand shop run by Kevin Murphy GmbH). The profile already selects this rhythm (source C03-P02-1). Wording read live on 2026-10-09: „…zunächst an vier aufeinanderfolgenden Haarwäschen… alle vier Wäschen…". The profile records the source as a *distributor*. The evidence row records it as `manufacturer`, following your ruling's wording.
   - Epres: kevinmurphy-germany.de (C03-P03-3, DE distributor) lists the kit as 2 × 15 ml ampoules. epres-hair.de (R13) lists the refill as 2 × 15 ml. No DE source prints "30 ml" as one figure, so 30 ml is the total concentrate. The profile's size still reads "15 ml vial; starter/refill not catalog-reconciled", and the batch does not rewrite it.
3. **What stays the same.** The research profiles keep the same bytes and hashes (`26005fee…`, `883f3758…`). No hold is adjudicated. No other column, product or protocol changes.

## Holds that remain, and why they don't block

| Product | Hold | Why it does not block |
|---|---|---|
| K18 | `applied_format`, `longer_wear`, `dilution`: source fact unknown | These holds only matter in the strict check. Publication keeps going through the seal, as it does today. |
| Epres | `rinse` unknown; `dilution` local container binding | Same reason. |

Clearing these holds would be the other route: a profile amendment plus re-binding the protocol sources, as with OGX. That is a larger change and also needs your review. I don't recommend it for two field fixes.

## How the batch is built

- **Gate.** The migration is staged at `plans/catalog-completeness-fill/slice4/k18-epres/20261011175000_bondbuilder_k18_epres_bundle_reseal.sql` (deliberately not in `supabase/migrations/`, so the gated file never blocks the deploy chain). It refuses with "awaiting Nick's approval" on any database that contains these products. To release it, put `data/research/bondbuilder-inci/v1.0/s4-k18-epres-reseal/approval.json` (`{"approved_by":"nick","approved_at":"…","batch_fingerprint":"4d6c85f4…"}`) next to the amendment, then run `npx tsx plans/catalog-completeness-fill/slice4/k18-epres/generate.ts` and move the regenerated migration into `supabase/migrations/` under the same name.
- **Checks before writing.** The migration takes the lane's advisory lock (`catalog-enrichment:product-apply`), table locks and row `FOR UPDATE` locks. It then checks:
  - the old seal: batch id, fingerprints and receipt
  - the saved-bundle digest: K18 `c1c64cdb…`, Epres `a0c576cf…`
  - that the live rows match the saved bundle exactly
  - the profile bytes
  - the field value before the change
  - the function lineage: it accepts the database before or after #660 step 2, which is not yet applied in prod
- **Writes, per product.** One field. The old seal is copied verbatim into an archive row, and a new profile + bundle evidence pair is written. One source-bound evidence row (`bondbuilder.protocol.cadence` or `product.net_content`) and one receipt.
- **After writing.** It runs `ready` + `assert_personal_plan_curated_publication`.
- **Read-only files.** `verify.sql` returns no rows when the batch is in place. `rollback.sql` restores the rows, their timestamps and the old seal byte-for-byte. During the restore it briefly disables the `updated_at` trigger.
- **Rehearsal.** `tests/bondbuilder-k18-epres-reseal-postgres.test.ts` passes 8/8. It uses PGlite with the exact prod rows and the rebuilt 2026-10-04 seal, and covers both lineages: apply, replay, rollback, then apply again, plus tamper and gate refusals.

After you approve: apply, run `verify.sql`, and confirm `bondbuilder_curated_facts_ready_v1` is true for both products. Existing saved routines still show the old K18 wording until they are recomputed.

Side note: the seal also contains `products.embedding`, `price_eur` and the timestamps. Any later re-embedding or price refresh of K18 or Epres will break the seal in the same way. That is a known weakness of the seal design, not something this batch changes.
