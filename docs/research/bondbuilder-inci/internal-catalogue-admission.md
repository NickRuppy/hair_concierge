# Internal Bondbuilder catalogue admission

Status: **implemented and applied for the eight reviewed pilot products; new rows staged, not activated**. This is the narrow bridge for an internally researched, reviewed product without a real owner submission. It does not extend template-based scan expansion or replace ordinary Product Intake.

2026-10-04 handoff update: Nick approved the final five images/properties, canonical line names and production handoff, then explicitly approved the cross-program prerequisite repair. The 127 protocol-key repair, storage migration and admission migration are applied with canonical migration-history versions. P01–P03 retain their complete previously approved bundles with research-only enrichment; P04–P08 are stored with full research, reviewed canonical identity, exact observed identifiers, image provenance, verified canonical/thumbnail pairs and commercial fields. All five new rows remain inactive/non-recommended, with empty suitability and no fabricated executable protocols. Full profile/request/readback/evidence/ledger and role checks passed. The [production handoff plan](../../../plans/bondbuilder-research-engine/production-handoff-2026-10-04.md) records scope, live lineage reconciliation, operator steps and recovery. Automatic research routing remains disabled; this is not promotion or application deployment.

| Operation                     | Boundary                                      | Preserved restrictions                                                                                                                                     |
| ----------------------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Enrich an existing anchor     | `bondbuilder_research_enrich_v1`              | Fresh server preimage/CAS; research-only delta; preserve identity, commerce, identifiers, images, legacy specs, fit, protocols and recommendation approval |
| Stage a new internal product  | `bondbuilder_internal_admit_v1`               | Curated, inactive, not recommended; lifecycle `active` (there is no draft lifecycle enum); empty fit; no executable protocols                              |
| Approve a real user's product | `product_intake_approve_bondbuilder_owner_v1` | Actual submission/owner; low/default policy; unchanged owner and intake guards                                                                             |

The [strict request contract](../../../src/lib/product-intake/bondbuilder-internal-admission.ts) and [migration](../../../supabase/migrations/20261003141320_bondbuilder_internal_catalogue_admission.sql) independently validate the full research profile, owner policy, image hash linkage and source-compatible adapter fields. A product identifier, research grade or approved image is not authority to activate or recommend. Research truth stays in `research_profile`, including explicit application and fit unknowns. No intensity, repair-axis or generic usage selector is fabricated.

## Offline preparation

```sh
npm run products:intake:bondbuilder:prepare -- \
  --package-root=ops/product-intake-research/2026-10-03/bondbuilder-catalogue \
  --out=ops/product-intake-research/2026-10-03/bondbuilder-catalogue/prepared-admission-v1
```

Omit `--out` for validation only. Output directories are create-only. The tool has no database client, network request, upload or apply mode. It verifies the exact package, frozen envelope, canonical image, thumbnail and captured-commercial bytes against their recorded SHA-256; identifiers must still be observations in the package-bound primary capture. It reruns the production projection rather than trusting a saved candidate's properties. It does not rewrite historical approval snapshots or treat their `manual_reviewed=false` payloads as final approvals.

Output contains new staged requests or existing-anchor enrichment **intents**. Anchor intents deliberately lack `p_expected_preimage`: fetch the actual `bondbuilder_research_preimage_v1` immediately before any separately authorized application. The saved commercial snapshot omits fields from that server contract and must not be substituted. Preserve original request UUIDs/bytes for retries; a freshly prepared request is not a retry of an applied one.

Approved P03/P04 display identities differ from the immutable source identity. Only their exact owner-registry/source/formula tuples can use the two enumerated canonical mappings. All other standing identity comparisons remain exact. Grading and source bytes are unchanged; this is not fuzzy matching or a catalogue-wide case-insensitive rule.

## Later application prerequisites

No production action is authorized by local preparation. Before a separately approved apply:

1. Refresh live schema/migration lineage and review the exact target. Prerequisites, in order: `20260929230000`, `20261002132306`, then `20261003141320`. Do not blindly push unrelated pending migrations.
2. Upload only the exact approved new images/thumbnails, then read back bytes/dimensions and verify their hashes. Planned URLs are not proof of live storage. Image provenance is written by the future admission transaction, not by the offline script.
3. Refresh canonical brand/line, cross-category identity and canonical-GTIN ownership. A conflicting spelling or ownership requires reconciliation, not overwriting another row or guessing a duplicate. Recheck exact pack/offer/source freshness and proposed identifiers.
4. Review exact bound requests and fresh anchor preimages; obtain explicit database-apply authorization. The service-role RPC takes `(p_request, p_expected_sha256, p_request_id, p_reviewed_by='nick')`. It atomically writes staged product, spec, identifiers, approved asset metadata, evidence and ledger. Any duplicate, partial retry or stored-bundle drift fails closed.

`review` digests record the restricted operator's assertion about local approval; they are not cryptographic proof of Nick's identity. SQL has no access to local files or storage bytes. The restricted caller remains responsible for verifying those gates. No automatic client or public endpoint is added.

Admission is not global recommendation readiness. New curated products need the existing owner trust, market, fit and exact executable source-bound protocol checks before visibility/promotion; low trust does not bypass that publication guard. The three existing anchors retain their existing live approvals. Automatic research routing additionally needs the separate method coverage/owner-lock and activation decision. Nothing in this lane flips that gate.

## Recovery

Transactions roll back product/brand/line/spec/identifier/asset/evidence/ledger together on failure. An unchanged request retry returns the same product ID only while the complete stored bundle still matches. Do not delete rows or ledger entries to force a retry through.

For an authorized rollback of the entry point, revoke service-role execution of `bondbuilder_internal_admit_v1(jsonb,text,uuid,text)`; keep persisted research, the storage columns and the narrow identity compatibility helper/trigger. Restoring the old exact trigger after alias-bound rows exist would strand valid research. A reviewed roll-forward can grant execution again without rerunning the lineage-pinned migration. No destructive schema/data rollback is proposed.

Owning workflow: [Product Intake](../../product-intake-research-ops.md). [Implementation plan and decisions](../../../plans/bondbuilder-research-engine/internal-admission-plan-2026-10-03.md).
