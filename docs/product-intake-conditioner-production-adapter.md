# Conditioner Production Adapter v1

Status: implemented local research adapter — not a production write or matching-engine change.

Use this workflow for a previously unknown German/EU conventional rinse-out Conditioner. The researcher performs the complete Conditioner Standard v1.6 analysis once. The adapter then projects only the smaller set of properties supported by the current Product Intake database contract.

## Authority stack

| Layer | Authority | Responsibility |
| --- | --- | --- |
| Full ingredient research | `docs/research/conditioner-inci/v1.0/conditioner-classification-standard.md` | Exact formula analysis and the complete nine-property profile |
| Intake serialization | `conditioner-research-envelope-v1.6` | Durable evidence, values, uncertainty, and formula provenance |
| Current projection | `src/lib/conditioner-research/production-adapter.ts` | Pure one-way conversion into current Conditioner fields |
| Product handoff | `docs/product-intake-research-ops.md` | Identity, image, price/link, exact protocol, review, and guarded publish |

The full research envelope is the source of truth. The production projection is deliberately lossy and must never be used to reconstruct or overwrite the research profile.

## Required research envelope

The Product Intake worker requires a `property_synthesis` artifact with:

```json
{
  "conditioner_research_envelope": {
    "version": "conditioner-research-envelope-v1.6",
    "researchMethod": {
      "policyId": "conditioner-classification-v1.6",
      "modelVersion": "conditioner-inci-v1.6",
      "policySha256": "<pinned by adapter>",
      "runbookSha256": "<pinned by adapter>"
    },
    "identity": {
      "researchId": "<Product Intake submission_id>",
      "market": "DE/EU",
      "exactProductName": "<exact product>",
      "categoryBoundaryStatus": "eligible",
      "confidence": "high",
      "sourceIds": ["<source id>"]
    },
    "formula": {
      "status": "verified",
      "rawInci": "<complete INCI>",
      "normalizedIngredients": ["Aqua", "..."],
      "formulaFingerprintSha256": "<normalized formula fingerprint>",
      "rawInciSha256": "<SHA-256 of exact rawInci UTF-8 bytes>",
      "sourceIds": ["<source id>"]
    },
    "profile": {
      "conditioningLevel": { "value": "moderate", "confidence": "high", "rationale": "...", "evidenceSignals": ["..."], "derivation": "...", "thresholdReasoning": ["...", "..."], "limitations": ["..."] },
      "weightPotential": { "value": "moderate", "confidence": "high", "rationale": "...", "evidenceSignals": ["..."], "derivation": "...", "thresholdReasoning": ["...", "..."], "limitations": ["..."] },
      "careDirection": { "value": "moisture", "confidence": "high", "rationale": "...", "evidenceSignals": ["..."], "derivation": "...", "thresholdReasoning": ["...", "..."], "limitations": ["..."] },
      "repairSupportLevel": { "value": "low", "confidence": "high", "rationale": "...", "evidenceSignals": ["..."], "derivation": "...", "thresholdReasoning": ["...", "..."], "limitations": ["..."] },
      "primaryFocus": { "value": "general", "confidence": "high", "rationale": "...", "evidenceSignals": ["..."], "derivation": "...", "thresholdReasoning": ["...", "..."], "limitations": ["..."] },
      "secondaryFocus": { "value": ["detangling"], "confidence": "high", "rationale": "...", "evidenceSignals": ["..."], "derivation": "...", "thresholdReasoning": ["...", "..."], "limitations": ["..."] },
      "hairThicknessFit": { "value": ["fine", "medium"], "confidence": "high", "rationale": "...", "evidenceSignals": ["..."], "derivation": "...", "thresholdReasoning": ["...", "..."], "limitations": ["..."] },
      "damageFit": { "value": ["healthy", "moderately_damaged"], "confidence": "high", "rationale": "...", "evidenceSignals": ["..."], "derivation": "...", "thresholdReasoning": ["...", "..."], "limitations": ["..."] },
      "textureFit": { "value": ["straight", "wavy"], "confidence": "high", "rationale": "...", "evidenceSignals": ["..."], "derivation": "...", "thresholdReasoning": ["...", "..."], "limitations": ["..."] },
      "uncertainFields": [],
      "assumptionNotes": []
    }
  }
}
```

Every field requires the product-specific reasoning contract from v1.6. A generic enum restatement is invalid.

The formula integrity fields are checked together. `rawInciSha256` hashes the exact raw INCI bytes. `formulaFingerprintSha256` hashes the raw INCI after uppercasing, replacing punctuation separators with spaces, and collapsing whitespace. `normalizedIngredients` must preserve the same complete ordered ingredient sequence; the adapter refuses projection when that list diverges, so presence flags cannot silently come from a different formula.

Within Product Intake, `identity.researchId` must equal the prompt packet's `submission_id`. The worker checks this before mutating current output rows. The standalone filesystem replay accepts another stable research ID because it has no submission context.

## Deterministic projection

| Research property | Current database property |
| --- | --- |
| `weightPotential` low/moderate/high | `weight` light/medium/rich |
| `repairSupportLevel` | `repair_level` |
| `careDirection` | `balance_direction` |
| moisture/balanced/protein | `protein_moisture_balance` snaps/stretches_bounces/stretches_stays |
| `hairThicknessFit` fine/medium/coarse | `suitable_thicknesses` and compatibility rows fine/normal/coarse |
| normalized complete INCI | presence-only `ingredient_flags` |

`conditioningLevel`, primary/secondary focus, `damageFit`, and `textureFit` remain in the research envelope and are reported as omitted from Adapter v1. No semantically unrelated current column is used to store them.

The compatibility rows are current matching policy, not ingredient observations and not diagnoses. Product Intake review must show the derived rows and their research rationale before approval.

## Protocol boundary

The adapter returns only the required role name `conditioner_rinse_out`. It does not produce cadence, amount, placement, contact time, rinse action, or source text. Those must come from authoritative product directions and remain independently reviewable under the Product Intake protocol contract.

## Local replay

```bash
npm run research:conditioner:production-adapter -- \
  --input <conditioner-research-envelope.json> \
  --output <artifact-directory>
```

The command writes:

- `research-envelope.json` — the complete validated research authority;
- `production-projection.json` — the versioned current-schema projection;
- `projection-summary.md` — concise reviewer output.

It refuses to replace a non-empty output directory unless `--overwrite` is supplied. It performs no network request and no database write.

## Readiness boundary

`projection_ready` means only that the Conditioner property lane can populate today's schema. It is not catalog-intake readiness, global-recommendation readiness, image approval, protocol approval, publish approval, or production activation.
