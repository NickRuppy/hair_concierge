# Nivea Volumen & Kraft Conditioner protocol amendment

## Outcome

Prepare an additive Stage 5 protocol amendment for the existing curated Nivea
Volumen & Kraft Conditioner row so its current `awaiting_exact_analysis`
disposition can be resolved after the protocol and V2 artifact are applied.

No barcode data, oil data, Balea semantics, production data, push, or PR action
is part of this slice.

## Product

- Product ID: `26985fdd-1b41-46e3-9c9a-94b98f92310a`
- Category: `conditioner`
- Required role: `conditioner_rinse_out`
- Current blocker: `awaiting_exact_analysis` /
  `insufficient_executable_directions`

## Chosen protocol

The protocol uses exact rinse-out conditioner guidance:

- apply after shampoo to damp/wet hair
- distribute through lengths and ends
- avoid roots and scalp
- leave on for 2-3 minutes
- rinse thoroughly with lukewarm water
- no cadence inference

The V1 payload keeps `contactTimeSeconds: null` and
`sharedTemplateContactTime: "include"`. The V2 builder derives the bounded
range:

```json
{ "kind": "range_seconds", "minimumSeconds": 120, "maximumSeconds": 180 }
```

## Evidence

- Drogeria Olmed exact EU product page with the full directions:
  `https://www.drogeriaolmed.pl/produkt/nivea-volumen-kraft-odzywka-do-wlosow-nadajaca-objetosci-200-ml%2C173209.html`
- Wizaż24 exact EU product page independently corroborating those directions:
  `https://wizaz24.pl/nivea-odzywka-do-wlosow-volume-p457891`
- MojeDrogerie exact EAN page, used for package identity only:
  `https://www.mojedrogerie.cz/nivea-kondicioner-volume-200-ml-ean4005900918031.php`

The older blocked disposition remains pinned exactly to the current
`S5-21-product-search-dispositions` expected disposition, with source
fingerprint `dcdc396bcfdb3a12e9aab4eb62a4f0e21ab2a6ca6227e495fc62b5be40ced6a6`.

## Fingerprints

- Manifest:
  `ff448aafe13b7fc9920b7b6dac668426db5b58fcb09f53f9fe6acff22c9b5edc`
- Stage 5 protocol apply batch:
  `fdbfc061240dbe5e82fee48b4a30b6d1d569ac32e143d03dbb3bcf0d237ce793`
- Stage 5 disposition-resolution batch:
  `cd54975d94c3011f08dbf5f0ab7b5bfebde3c8e014c548be9850ccaf77a01c01`
- Resolution item:
  `894c5e09cfe58160c3bb3da9e518cd064353db0dfa90b4256d4bf7d5e7471abc`
- Generated V2 artifact:
  `ee31d98778632bf005d21cf884dd2dbc53922177d1c0dfb79894717fc234a640`

## Verification snapshot

- `npm run personal-plan:application-audit`
  - passed
  - `309` reviewed rows, `309` composable, `0` explicit blockers
  - `2` post-baseline protocol amendments included
- `node --import ./tests/server-only-register.cjs --import tsx --test tests/personal-plan-stage5-protocol-amendment.test.ts tests/personal-plan-stage5-disposition-resolution-postgres.test.ts tests/personal-plan-stage5-balea-amendment-artifact.test.ts`
  - passed, `12/12`
- `npm run test:personal-plan-stage5`
  - passed, `282/282`
- `npm run typecheck`
  - passed
- `npm run lint`
  - passed with `0` errors and `5` pre-existing warnings outside this slice
- `git diff --check`
  - passed

## Deferred gates

The later apply order stays separate and guarded:

1. Apply the Stage 5 protocol batch for
   `S5-23-nivea-volumen-kraft-conditioner-protocol`.
2. Apply the regenerated Stage 5 V2 artifact.
3. Apply disposition resolution only after exact V1 and V2 rows are present and
   the live disposition still matches the pinned expected disposition.
