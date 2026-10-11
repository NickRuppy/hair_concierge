# Formula-packet freeze brief (v1.6 calibration)

Shared instructions for every freeze worker. Worktree: `/Users/nick/AI_work/hair_conscierge/.worktrees/shampoo-v16` — use absolute paths (Bash cwd silently resets). Do not commit.

## Procedure per product

Follow the identity + formula steps of `docs/research/shampoo-inci/v1.4/new-product-research-runbook.md`:

1. Exact German product: name, brand, pack size, GTIN aliases, catalog product id.
2. Current canonical INCI. Authority order: manufacturer DE/EU page or current German pack first; German retailers (dm, Rossmann, Müller, Douglas) with GTIN as corroboration; codecheck as supporting only.
3. Preserve every conflict verbatim. Never merge two lists. Pick a canonical list only if one source clearly wins (manufacturer exact pack, or ≥2 independent GTIN-anchored sources agreeing); otherwise mark `frozen_with_conflict` or `blocked`.
4. Normalized INCI fingerprint: sha256 of the list after lower-casing, trimming, collapsing whitespace, and joining with `|`. Document exactly this.
5. Positioning claims and directions (German, verbatim), with source.

Reuse prior evidence where it exists, but re-verify it is still current:
- `data/research/shampoo-inci/v1.4-candidate/candidate.json` (formula source pointers per `catalogProductId`) and the files it points to.
- `plans/scan-db-expansion/research/shampoo-v14/` (pilot packets for X14 products).
- Identity risks listed in `plans/shampoo-v16/gold-set/gold-set-proposal.md`.

## Web use

Read-only browsing. Decline non-essential cookies. No logins, no forms. **Time box: if a page fails or hangs twice, move on and record it; never retry the same URL more than twice.** Record URL, retrieval date and verbatim INCI per source.

## Output — write each product file IMMEDIATELY when that product is done

`plans/shampoo-v16/calibration/packets/full/<slot>-<slug>.json` with fields:
`slot, productId, name, brand, packSize, gtins[], sources[{url, retrievedAt, sourceType, gtinShown, inciVerbatim, claimsVerbatim, directionsVerbatim}], conflicts[], canonicalInci[], canonicalReason, inciFingerprintSha256, normalization, identityConfidence (high|moderate|low), status (frozen|frozen_with_conflict|blocked), blockReason, notes`.

Do not classify anything. Do not write lane copies (the orchestrator builds sanitized copies). Edit nothing outside `plans/shampoo-v16/calibration/packets/full/`.

## Handback

One table: slot, product, status, sources used, conflicts. Plus anything that needs Nick.
