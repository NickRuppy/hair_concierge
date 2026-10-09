# Track A formula freeze brief (Shampoo v1.6)

Shared instructions for every Track A freeze worker. Worktree: `/Users/nick/AI_work/hair_conscierge/.worktrees/shampoo-v16-rollout` — absolute paths only (Bash cwd silently resets). Do not commit. Do not classify anything.

## Procedure per product (v1.6 runbook step 2)

1. **Identity:** exact German product, brand, pack size, all GTINs, catalog `productId` (given in `freeze-inputs.json`).
2. **Canonical INCI.** Authority order: current German pack (photo/pack text) → manufacturer DE/EU page → German retailers with the exact GTIN (dm, Rossmann, Müller, Douglas, Budni) as corroboration → codecheck as support only.
3. Preserve every conflict verbatim; never merge lists. Pick a canonical list only if the manufacturer exact pack wins or ≥2 independent GTIN-anchored sources agree; otherwise `frozen_with_conflict` (explain) or `blocked`.
4. **Fingerprint:** sha256 of the canonical list after lower-casing, trimming, collapsing whitespace, joined with `|`. Merge split synonym entries such as "Aqua (Water, Eau)" into one item before hashing; state the normalization.
5. **Claims and directions:** verbatim German text per source.
6. **Evidence fields required by the v1.6 lane kit** (packets missing them are rejected):
   - per source `sourceKind` ∈ `pack_front`, `pack_back`, `manufacturer_de`, `manufacturer_foreign`, `retailer`;
   - `formulaCompleteness`: `complete` (full list with no truncation, "…" or "u.a.") or `not_known_complete`;
   - `formulaSourceTier`: 1 = current pack, 2 = manufacturer DE/EU page for the exact product, 3 = ≥2 GTIN-anchored German retailers agreeing, 4 = anything weaker;
   - `identityConfidence`: `high` | `moderate` | `low`.
7. **Material claim–INCI conflicts:** if claims name ingredients that are absent from the INCI (e.g. "mit Jojobaöl" but no jojoba in the list), record it in `conflicts[]` with the quote. It is not a reason to block on its own.

Reuse prior evidence but re-verify it is current (the formula may have changed):
- C50 products: `data/research/shampoo-inci/v1.4-candidate/candidate.json` (formula source pointers per `catalogProductId`) and the files it points to.
- X14 products: `plans/scan-db-expansion/research/shampoo-v14/` (pilot packets, admin batches).
- NEW products: the `priorEvidence` path given per item.

## Web use

Read-only browsing. Decline non-essential cookies; no logins, no forms. Open **your own browser tab** (the shared default tab gets hijacked by parallel workers) and close it when done. dm.de and Rossmann render only in a browser tab after a few seconds; plain fetches hit a bot wall. **Time box:** at most two attempts per URL, then move on and record it.

## Output — write each product file IMMEDIATELY when that product is done

`/Users/nick/AI_work/hair_conscierge/.worktrees/shampoo-v16-rollout/data/research/shampoo-inci/v1.6-track-a/packets/<slot>-<slug>.json` with exactly these fields:

`slot, productId, name, brand, packSize, gtins[], sources[{url, retrievedAt, sourceType, sourceKind, gtinShown, inciVerbatim, claimsVerbatim, directionsVerbatim}], conflicts[], canonicalInci[], canonicalReason, inciFingerprintSha256, normalization, identityConfidence, formulaCompleteness, formulaSourceTier, status (frozen|frozen_with_conflict|blocked), blockReason, notes`.

Edit nothing outside that folder.

## Handback (as text — subagents cannot write report files)

One table: slot, product, status, formulaSourceTier, sources used, conflicts. Then anything that needs Nick (delistings, reformulations, identity mismatches).
