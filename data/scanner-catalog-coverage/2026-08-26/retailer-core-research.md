# Retailer Core Candidate Research

Date: 2026-08-26
Market: Germany
Scope: shampoo, conditioner, mask, leave-in, oil

## Outcome

`retailer-core-candidates.json` now contains a reconciled and expanded Phase 1B candidate pool. It started with 60 current retailer candidates and was expanded to 75 after live-baseline reconciliation showed some categories needed more genuinely-new headroom.

The pool remains research-only. It is not an import package, not a Supabase apply batch, and not global recommendation approval.

## Reconciled Counts

| Category | Total | Existing product match | Open submission overlap | Confirmed new | Unresolved |
| --- | ---: | ---: | ---: | ---: | ---: |
| conditioner | 17 | 6 | 0 | 11 | 0 |
| leave_in | 17 | 6 | 0 | 11 | 0 |
| mask | 16 | 6 | 0 | 8 | 2 |
| oil | 13 | 5 | 0 | 8 | 0 |
| shampoo | 12 | 3 | 0 | 9 | 0 |

Phase 1B genuinely-new targets are met with target+2 headroom in every category:

| Category | Target | Confirmed new |
| --- | ---: | ---: |
| shampoo | 7 | 9 |
| conditioner | 8 | 11 |
| mask | 6 | 8 |
| leave_in | 8 | 11 |
| oil | 6 | 8 |

## Source Method

The pool uses current observable retailer evidence only:

- dm category pages and PDPs for high-volume hair-care products.
- Rossmann PDPs and category/brand listings where the visible URL path exposes a product identifier and current snippets showed details, availability, reviews, or delivery.
- Mueller PDPs for selected category breadth where current source snippets showed product details, package size, price, and delivery state.
- Existing local catalog and Phase 1A files only as reconciliation baselines, not as current retailer popularity proof.

Visibility signals captured include retailer listing presence, listing order where observable, stock/delivery state, price, review count, sponsored placement, and repeated retailer presence. These signals are prioritization evidence, not market-share evidence.

## Reconciliation Basis

Checked against:

- `live-baseline.json`: 259 active identities and 8 resolved open-submission identities.
- `readiness-baseline.json`: 221 active supported products without barcode, including 192 ready-for-EAN-research identities.
- `phase1a-existing-ledger.json`: ownership-scoped GTIN package evidence where present.

Limitation: `live-baseline.json` does not embed a separate inactive-owner export. The JSON records current GTIN ownership against live product identifiers and notes where Phase 1A has ownership-scoped researched package evidence.

## 5-New Pilot Shortlist

Suggested one-per-category pilot candidates from the confirmed-new pool:

| Category | Candidate | Why this one |
| --- | --- | --- |
| shampoo | `shampoo-003` Head & Shoulders Anti-Schuppen Classic Clean | Mass anti-dandruff flagship gap; exact dm PDP and GTIN captured. |
| conditioner | `conditioner-011` Being Big Hair Conditioner, 354 ml | Exact Rossmann PDP verified, GTIN captured, no live identity match. |
| mask | `mask-015` Wahre Schätze Reiswasser Ritual & Stärke 1-Minute Haarkur | dm/Rossmann visibility, GTIN captured, high Rossmann review signal. |
| leave_in | `leave-in-014` Garnier Fructis Keratin Sleek & Stay Haarserum | Strong dm visibility and useful heat/frizz leave-in edge case. |
| oil | `oil-013` ISANA Professional Haaröl Arganöl & Pflege | Strong Rossmann visibility, 405 reviews, GTIN captured, exact active oil gap. |

## Verification

Local validation passed:

- JSON parse OK.
- 75 total candidates.
- No missing PDP URLs.
- No duplicate candidate IDs.
- 33 candidates have GTINs; all included GTINs validated to a canonical GTIN-14 value.
- Current live-baseline ownership result for included GTINs: all 33 are unowned in embedded live product identifiers.
- PDP URL check: 71 returned HTTP 200, 4 returned HTTP 301, 0 failed.
- Content fingerprint: `30c6b58c15a5c11e783e858ce398f50949be4737b909ccc580f8cedeade72e48`.

## Remaining Uncertainty

The two unresolved mask rows are intentionally not counted as confirmed new:

- `mask-005` Garnier Fructis Hair Food Macadamia: same product family exists as conditioner/leave-in, but no active mask row.
- `mask-010` Pantene Pro-V Unendlich Lang Keratin Reconstruct: nearby active Pantene Keratin Repair & Care mask exists, but candidate URL/GTIN/name indicate a distinct variant.

Before any import, each selected candidate still needs exact PDP open/read, image candidate, INCI/formula review, category facts, application protocol, global identifier ownership preflight including inactive owners, and explicit Nick approval for any write.
