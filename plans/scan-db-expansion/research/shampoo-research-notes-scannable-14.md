# Shampoo Research Notes — Approved 14-Product Scannability Pass

> **STATUS: RESEARCH DRAFT — not approved production data.** This pass finalized local image assets and ran read-only preflight. No images were uploaded and no catalog/database write was performed.

Checked: 2026-09-04  
Scoped manifest: `shampoo-manifest-scannable-14.json`

## Result

- Formula/property review: **approved by Nick for all 14** in the Shampoo Lab.
- Manifest validator: **PASS, 14/14**.
- Images: **approved by Nick, 14/14**; every local final is 1200×1200 WebP, every thumbnail is 144×144 WebP, hashes match, and all 14 upload dry-runs pass.
- Live read-only expansion preflight on current `main` (`3e5018eb`, including shipped PR #510): **14 ready, 0 parked** against 334 current products, 381 identifiers, and 2 dispositions.
- Preflight batch fingerprint: `6636720b7d685c75041d6d2d650f7e71e26a29363e793645dafb5bacc402c85b`.
- Image uploads: **14 canonical assets + 14 thumbnails uploaded and checksum-verified**. Database writes: **0**.
- Purchase links: **14/14 reachable** on 2026-09-04; the supplement now carries the sole live admin profile as operator identity.
- The remaining 38 shampoos stay paused and are not present in this scoped manifest.

## Product status

| Product                        | Formula  | Image          | EAN/apply    | Preflight disposition                     |
| ------------------------------ | -------- | -------------- | ------------ | ----------------------------------------- |
| Elvital Hydra Hyaluronic 72H   | approved | approved/local | corroborated | ready                                     |
| Head & Shoulders Classic Clean | approved | approved/local | corroborated | ready                                     |
| ISANA 2 in 1 Volumen           | approved | approved/local | corroborated | ready                                     |
| ISANA Sensitiv                 | approved | approved/local | corroborated | ready                                     |
| Syoss Intense Keratin          | approved | approved/local | corroborated | ready                                     |
| Being Big Hair                 | approved | approved/local | corroborated | ready                                     |
| Fructis Locken Methode         | approved | approved/local | corroborated | ready                                     |
| GLISS Sealing Miracle          | approved | approved/local | corroborated | ready                                     |
| NIVEA Power Repair             | approved | approved/local | corroborated | ready                                     |
| GLISS Liquid Silk              | approved | approved/local | corroborated | ready                                     |
| GLISS Total Repair             | approved | approved/local | corroborated | ready                                     |
| Herbal Essences Fiji           | approved | approved/local | corroborated | ready                                     |
| Wahre Schätze Honig Schätze    | approved | approved/local | 3 corroborated size aliases | ready |
| schauma Repair & Pflege        | approved | approved/local | corroborated | ready                                     |

## Evidence and confidence

Per-field source and confidence details remain in `shampoo-research-notes-01.md` and `shampoo-research-notes-02.md`; the immutable formula-first authority outputs remain under `shampoo-v14/`. This pass did not weaken or overwrite those judgments.

- Product identity, price, size, EAN, and usage: **solid** where two-source/exact-SKU requirements passed.
- Formula-derived classification: **inferred**, approved through the Lab review; never represented as INCI certainty beyond the engine contract.
- Final image identity and presentation: **solid**, manually approved by Nick after contact-sheet review.
- Honig Schätze identifier identity: **solid** for 400 ml `3600542461030`, 300 ml `3600542462228`, and 250 ml `3600542461511`. Nick accepted exact official dm/Rossmann retail records as sufficient. Current formula evidence supports the shared marketed product; historical records show that the 250 ml and 300 ml EANs also span an older formula generation.
- Schauma application evidence: **solid**; Nick ruled the non-numeric “kurz einwirken lassen” wording to remain within the standard rinse-out shampoo protocol.

## Open decisions before a final apply

1. **Final publication gate:** upload the approved assets, replace the placeholder operator profile, refresh purchase-link checks, rerun preflight on the exact clean reviewed head, and obtain explicit apply approval.

The projections are not yet live or scanner-available because no catalog apply has been authorized. Their approved canonical images and thumbnails are now hosted and checksum-verified.
