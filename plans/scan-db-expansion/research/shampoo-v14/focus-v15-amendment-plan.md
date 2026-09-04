# Shampoo Focus v1.5 Amendment

Status: approved by Nick in the five-product Lab (2026-09-03); reusable engine extraction and remaining-wave expansion authorized

## Outcome

Upgrade the local five-product Shampoo Research Lab so focus decisions are as formula-led as the evidence permits, add `moisture`, and retire `gentle` as a focus without rewriting the completed v1.4 blind-lane record.

This remains research and local review infrastructure only. It does not publish catalog data, change recommendation behavior, write to Supabase, or approve any product for Nick.

## Versioning decision

- Keep every v1.4 source packet, blind lane, comparison, adjudication, adapter input, projection, and determinism receipt immutable.
- Add one hash-bound `focus-v15.json` overlay per pilot product. The Lab presents the overlay as the effective focus decision and keeps Lane A/B plus the v1.4 adjudication visible as historical evidence.
- Include the overlay bytes in the Lab integrity hash. Existing local review decisions are therefore invalidated and archived when the policy changes.
- Production Light remains pinned to the reviewed v1.4 contract in this amendment. Focus is not a production output, and the existing adapter only consumes `clarifying` for cleansing projection. A future adapter version must consume v1.5 envelopes explicitly rather than silently changing PR #508 semantics.
- Do not regenerate or edit `adapter-input.json`, adapter outputs, summaries, CLI receipts, or determinism receipts. The overlay is display/review evidence and is never fed to the v1.4 adapter.
- In the Lab loader, append `focus-v15.json` as the final artifact path and destructure it last. Do not insert it among the nine position-sensitive v1.4 files.

## Active focus taxonomy

Forward v1.5 focus values are:

- `volume`
- `shine`
- `repair`
- `moisture`
- `clarifying`
- `scalp_active`
- `general`

`gentle` is removed only from the focus taxonomy. It remains valid language for cleansing intensity and formula interpretation.

`scalp_active` means a formula-compatible, explicitly targeted cosmetic scalp need, including sensitive-scalp or anti-dandruff positioning. `dandruffSupport` remains the separate field that says whether a recognized anti-dandruff active is present. The German Lab label is “Kopfhaut-Ziel” to avoid implying a pharmacological active.

`general` is the honest fallback when no specialist focus has a coherent claim-plus-formula case, when the formula evidence is nonspecific, or when competing directions cannot be resolved conservatively.

The Lab service exports its own `SHAMPOO_V15_FOCUS_VALUES` constant. The standalone task validator deliberately owns an equivalent v1.5 list because it runs without importing application TypeScript. Neither list may be derived from the v1.4 Production Light adapter enum.

## Overlay contract

Every pilot member must contain `focus-v15.json` with this shape:

```json
{
  "version": "shampoo-focus-v15-overlay-v1",
  "productId": "product-slug",
  "formulaFingerprintSha256": "64-character lowercase SHA-256",
  "priorV14": {
    "primary": "the exact v1.4 adjudicated focusPrimary value",
    "secondary": ["the exact v1.4 adjudicated focusSecondary values"],
    "adjudicationSha256": "SHA-256 of the exact adjudication.json bytes"
  },
  "effectiveV15": {
    "primary": "one active v1.5 focus",
    "secondary": ["zero to two distinct active v1.5 focuses"],
    "confidence": "moderate or high",
    "rationale": "claim-plus-formula decision",
    "formulaFacts": [],
    "counterSignal": "meaningful limitation",
    "neighboringAlternative": "one different v1.5 focus or null",
    "evidenceRefs": []
  },
  "careDirection": {
    "verdict": "repair_supported | moisture_supported | dual_supported | nonspecific | not_applicable",
    "moistureRoutes": [],
    "repairRoutes": [],
    "sharedConditioningRoutes": [],
    "limitation": "rinse-off, ingredient-order, or non-specificity boundary"
  },
  "claimRole": "candidate | tie_breaker | corroborating | not_applicable",
  "decisionTrace": "plain-language explanation of how formula, counter-signal and claim resolved the focus"
}
```

The Lab loader and task-local validator must both enforce:

- exact version and product ID;
- exact formula fingerprint equality with the source packet;
- every displayed formula fact's ingredient must match the canonical INCI entry at its exact one-based position;
- every displayed evidence reference must resolve to the source packet or v1.4 adjudication evidence graph;
- exact SHA-256 binding to the v1.4 `adjudication.json` bytes;
- exact equality of `priorV14.primary` and `priorV14.secondary` with the v1.4 adjudication;
- forward values only from the separate v1.5 taxonomy (`gentle` is invalid here);
- distinct primary/secondary values and at most two secondary values;
- a complete, nonempty evidence/rationale/counter-signal/decision trace record;
- valid care-direction and claim-role enums.

## Formula-first decision rule

Claims identify the candidate job. The complete formula must then support or at least remain compatible with that job, and meaningful counter-signals must be recorded. No single hero ingredient proves a focus.

For the repair/moisture boundary, the overlay records one care-direction verdict:

- `repair_supported`: a coherent substantive/deposition or damage-care cluster supports repair, not merely one protein token.
- `moisture_supported`: a coherent humectant plus conditioning/emollient or deposition cluster supports moisturized feel and manageability in the rinse-off context.
- `dual_supported`: the formula genuinely supports both directions, so exact-product positioning may break the tie.
- `nonspecific`: generic conditioning is compatible with both but does not distinguish them.
- `not_applicable`: the chosen focus is not a repair/moisture decision.

Ingredient order is used qualitatively, not as a concentration claim. Rinse-off limitations, shared conditioning routes, and counter-signals stay visible. Claims may break a `dual_supported` tie but cannot convert `nonspecific` formula evidence into a confident specialist focus.

## Pilot decisions

| Product                        | Effective primary focus | Care-direction verdict | Strategic reason                                                                                                                                                                                          |
| ------------------------------ | ----------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Elvital Hydra Hyaluronic       | `moisture`              | `moisture_supported`   | Hydration is dominant and the formula combines sodium hyaluronate with multiple conditioning/deposition routes; confidence remains moderate because it is rinse-off and the named humectant is not early. |
| Syoss Intense Keratin          | `repair`                | `repair_supported`     | Hydrolyzed keratin appears early alongside substantive silicone/cationic conditioning routes and a coherent brittle-hair repair proposition.                                                              |
| Head & Shoulders Classic Clean | `scalp_active`          | `not_applicable`       | Anti-dandruff target plus piroctone olamine; clarifying remains secondary.                                                                                                                                |
| ISANA Sensitiv                 | `scalp_active`          | `not_applicable`       | Explicit sensitive-scalp target is compatible with amphoteric/nonionic buffering and comfort-support ingredients; SLES is retained as a counter-signal.                                                   |
| ISANA 2in1 Volumen             | `volume`                | `nonspecific`          | The formula supports a bounded volume/2-in-1 tradeoff; wheat protein alone does not establish repair.                                                                                                     |

## Lab behavior and acceptance

- Show the effective v1.5 focus, prior v1.4 focus, formula-support verdict, formula routes, shared routes, counter-signal, claim role, and decision explanation together.
- Do not add a ninth approval gate. The overlay is part of the existing `focusPrimary` evidence and approval scope.
- Block only the malformed product if its overlay is missing or invalid; keep the other four reviewable.
- The standalone task-local pilot validator gates the overlay with the same join and enum invariants; its existing v1.4 lane validation remains unchanged.
- Preserve all existing formula, eight-property, projection, rework, stale-hash, and local-development-only gates.
- Focused service, API, and rendered-UI tests pass; the task-local pilot validator passes; typecheck and relevant lint pass.
- Verify the logged-in local Lab in the browser. Do not click product approval actions.

## Approval receipt

Nick reviewed the v1.5 focus presentation in the local Shampoo Research Lab and explicitly approved it on 2026-09-03. That approval adopts the seven-value forward taxonomy, the formula-first repair/moisture rule, removal of `gentle` as a focus, and reuse of the same evidence-led review model for the remaining 47 classification candidates. It does not authorize catalog approval, database writes, publication, or changes to the shipped v1.4 Production Light adapter.
