# Leave-In Production Adapter v1

Status: implemented local research adapter — not a production write or matching-engine change.

Use this workflow for a previously unknown German/EU conventional leave-on conditioning Leave-In. The researcher performs the complete Leave-In Standard v1.0 analysis once. The adapter then projects only the smaller set of properties supported by the current Product Intake database contract.

## Authority stack

| Layer | Authority | Responsibility |
| --- | --- | --- |
| Full ingredient research | `docs/research/leave-in-inci/v1.0/` (Leave-In Standard v1.0, logic-locked 2026-09-13) | Exact formula analysis and the complete lean profile |
| Intake serialization | `leave-in-research-envelope-v1.0` | Durable evidence, values, uncertainty, and formula provenance |
| Current projection | `src/lib/leave-in-research/production-adapter.ts` | Pure one-way conversion into current Leave-In fields |
| Product handoff | `docs/product-intake-research-ops.md` | Identity, image, price/link, exact protocol, review, and guarded publish |

The full research envelope is the source of truth. The production projection is deliberately lossy and must never be used to reconstruct or overwrite the research profile.

Research method pins (checked by the adapter's `researchMethod` fields against the envelope):

- `policySha256`: `7ae5e882d9cba3e3fccdea3623d056efe802ff3bc3adbe554112e471da551ace`
- `runbookSha256`: `dce7d84982e52f5094a0b29500105d13f42c31d44e04b1871bcbef1bda5e56ca`

An envelope whose `researchMethod` does not match these pinned hashes fails the strict schema parse and the record stays `needs_research`.

## Required research envelope

The Product Intake worker requires a `property_synthesis` artifact with:

```json
{
  "leave_in_research_envelope": {
    "version": "leave-in-research-envelope-v1.0",
    "researchMethod": {
      "policyId": "leave-in-classification-v1.0",
      "modelVersion": "leave-in-inci-v1.0",
      "policySha256": "<pinned by adapter>",
      "runbookSha256": "<pinned by adapter>"
    },
    "identity": {
      "researchId": "<Product Intake submission_id>",
      "market": "DE/EU",
      "exactProductName": "<exact product>",
      "brand": "<exact brand>",
      "gtin": "<GTIN or null>",
      "productForm": "spray",
      "applicationStage": ["towel_dry"],
      "identityStatus": "verified",
      "categoryBoundaryStatus": "eligible",
      "confidence": "high",
      "sourceIds": ["<source id>"]
    },
    "formula": {
      "status": "verified",
      "rawInci": "<complete INCI>",
      "normalizedIngredients": ["AQUA", "..."],
      "formulaFingerprintSha256": "<normalized formula fingerprint>",
      "rawInciSha256": "<SHA-256 of exact rawInci UTF-8 bytes>",
      "sourceIds": ["<source id>"]
    },
    "profile": {
      "conditioningLevel": { "value": "moderate", "confidence": "high", "rationale": "...", "evidenceSignals": ["..."], "derivation": "...", "thresholdReasoning": ["...", "..."], "limitations": ["..."] },
      "weightPotential": { "value": "low", "confidence": "high", "rationale": "...", "evidenceSignals": ["..."], "derivation": "...", "thresholdReasoning": ["...", "..."], "limitations": ["..."] },
      "persistence": { "value": "moderate", "confidence": "high", "rationale": "...", "evidenceSignals": ["..."], "derivation": "...", "thresholdReasoning": ["...", "..."], "limitations": ["..."] },
      "holdSupport": { "value": "none", "confidence": "high", "rationale": "...", "evidenceSignals": ["..."], "derivation": "...", "thresholdReasoning": ["...", "..."], "limitations": ["..."] },
      "careDirection": { "value": "moisture", "confidence": "high", "rationale": "...", "evidenceSignals": ["..."], "derivation": "...", "thresholdReasoning": ["...", "..."], "limitations": ["..."] },
      "repairSupportLevel": { "value": "low", "confidence": "high", "rationale": "...", "evidenceSignals": ["..."], "derivation": "...", "thresholdReasoning": ["...", "..."], "limitations": ["..."] },
      "focus": { "value": { "primary": "general", "secondary": ["detangling"] }, "confidence": "high", "rationale": "...", "evidenceSignals": ["..."], "derivation": "...", "thresholdReasoning": ["...", "..."], "limitations": ["..."] },
      "specialistFunctions": { "value": { "providesHeatProtection": false }, "confidence": "high", "rationale": "...", "evidenceSignals": ["..."], "derivation": "...", "thresholdReasoning": ["...", "..."], "limitations": ["..."] },
      "smoothingRoute": { "value": "none", "confidence": "high", "rationale": "...", "evidenceSignals": ["..."], "derivation": "...", "thresholdReasoning": ["...", "..."], "limitations": ["..."] },
      "hairThicknessFit": { "value": { "fine": "recommended", "medium": "recommended", "coarse": "caution" }, "confidence": "high", "rationale": "...", "evidenceSignals": ["..."], "derivation": "...", "thresholdReasoning": ["...", "..."], "limitations": ["..."] },
      "damageFit": { "value": { "healthy": "recommended", "moderately_damaged": "recommended", "highly_damaged": "conditional" }, "confidence": "high", "rationale": "...", "evidenceSignals": ["..."], "derivation": "...", "thresholdReasoning": ["...", "..."], "limitations": ["..."] },
      "textureFit": { "value": { "straight": "recommended", "wavy": "recommended", "curly": "conditional", "coily": "conditional" }, "confidence": "high", "rationale": "...", "evidenceSignals": ["..."], "derivation": "...", "thresholdReasoning": ["...", "..."], "limitations": ["..."] },
      "uncertainFields": [],
      "assumptionNotes": []
    }
  }
}
```

Every field requires the product-specific reasoning contract from v1.0. A generic enum restatement is invalid.

The formula integrity fields are checked together. `rawInciSha256` hashes the exact raw INCI bytes. `formulaFingerprintSha256` hashes the raw INCI after splitting on the list separator (a comma flanked by digits belongs to the ingredient name, e.g. `1,2-Hexanediol`, and is never a separator), stripping `*`/`†` footnote markers, trimming, uppercasing, and rejoining with `, `. `normalizedIngredients` must preserve the same complete ordered ingredient sequence; the adapter refuses projection when that list diverges, so presence flags cannot silently come from a different formula.

Within Product Intake, `identity.researchId` must equal the prompt packet's `submission_id`. The worker checks this before mutating current output rows. The standalone filesystem replay accepts another stable research ID because it has no submission context.

`identity.applicationStage` is transcribed verbatim from the authoritative directions, never derived from the formula. The legacy `post_wash` alias is not a member of the production vocabulary; the adapter normalizes it to `towel_dry` before validating the envelope so an older-style value never fails the strict parse, but the durable envelope stored on the artifact is left untouched.

## Deterministic projection

| Research property | Current database property |
| --- | --- |
| `identity.productForm` | `product_leave_in_specs.format` (AD-1: one shared enum, no mapping layer) |
| `weightPotential` low/moderate/high | `weight` light/medium/rich |
| `conditioningLevel` + `persistence` | `product_leave_in_fit_specs.conditioner_relationship` (AD-4: `replacement_capable` iff both are moderate/high) and `product_leave_in_specs.roles[0]` (AD-3: `replacement_conditioner` vs `extension_conditioner`) |
| `holdSupport` ≠ none, or `identity.applicationStage` ∋ `pre_heat` | `roles` gains `styling_prep` (AD-3) |
| `focus`, `careDirection`, `repairSupportLevel`, `smoothingRoute` | `care_benefits` / `product_leave_in_fit_specs.care_benefits` / `functional_benefits` (AD-3a mapping) |
| `specialistFunctions.providesHeatProtection` | `provides_heat_protection`; also contributes `plan_roles.pre_heat_application` and the `heat_protect` eligibility bucket |
| `careDirection` | `care_direction` (closed enum, no `unknown` reaches the catalog — AD-2) |
| `repairSupportLevel` | `repair_support_level` |
| normalized complete INCI | presence-only `ingredient_flags` |
| `hairThicknessFit` | `suitable_thicknesses` and `product_leave_in_eligibility` rows — **only `recommended`** thicknesses are emitted (AD-5); `conditional`/`neutral`/`caution` fits are named in `field_rationales` and never written to the matcher |

`conditioningLevel`, `persistence`, `holdSupport`, `smoothingRoute`, `damageFit`, and `textureFit` remain in the research envelope beyond their contribution to the derivations above and are reported as omitted from Adapter v1 (see `omittedResearchProperties` on the projection outcome). No semantically unrelated current column is used to store them.

The trimmed `leave-in-research-envelope-v1.0` carries projection inputs only; it is not itself the durable research record. The complete research record — every §7 dimension including EXPO, the Hinweise record (even when empty), traces, and cautions — is required in the `property_synthesis` research artifact alongside the envelope, not inside it. The artifact, not the envelope alone, is the durable carrier of the full research record; the Product Intake adapter already retains the artifact as submitted (it only adds projection output keys such as `leave_in_production_projection` and never deletes existing artifact fields), so a research-only property recorded on the artifact survives review untouched.

`heat_protection_max_c` is always written as `null` (AD-6). Legacy 221–232 °C figures on existing rows are marketing use-condition parameters, not measured protection levels, and are not reproduced by this adapter. The degree-logic removal (ranking bonus, German copy, catalog-facts/application readers, and a migration nulling legacy values) ships as its own small PR immediately after this adapter PR and must land before the first catalog apply of researched Leave-In products — otherwise researched rows are outranked on heat by the legacy heuristic.

The compatibility rows are current matching policy, not ingredient observations and not diagnoses. Product Intake review must show the derived rows and their research rationale before approval.

## Protocol boundary

The adapter returns only the required role names (`required_protocol_roles`): `["post_wash_leave_in"]`, or `["post_wash_leave_in", "pre_heat_protection"]` when the profile's `specialistFunctions.providesHeatProtection` is `true`. It does not produce cadence, amount, placement, contact time, rinse action, or source text. Those must come from authoritative product directions and remain independently reviewable under the Product Intake protocol contract.

## Local replay

```bash
npm run research:leave-in:production-adapter -- \
  --input <leave-in-research-envelope.json> \
  --output <artifact-directory>
```

The command writes:

- `research-envelope.json` — the complete validated research authority;
- `production-projection.json` — the versioned current-schema projection;
- `projection-summary.md` — concise reviewer output.

It refuses to replace a non-empty output directory unless `--overwrite` is supplied. It performs no network request and no database write.

## Readiness boundary

`projection_ready` means only that the Leave-In property lane can populate today's schema. It is not catalog-intake readiness, global-recommendation readiness, image approval, protocol approval, publish approval, or production activation.
