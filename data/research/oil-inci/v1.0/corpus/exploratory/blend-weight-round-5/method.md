# Blind blend-weight application method — round 5

This is a qualitative research trial, not a sensory accuracy test. Classify the eight neutral ordered formulas from the same frozen inputs. Do not infer identity or market positioning from recognition. No source, directions, claim, dispenser, human choice or other lane's result is an input.

## Read scope

Read exactly these six files in this directory: `method.md`, `material-reference.json`, `policy.json`, `role-lexicon.json`, `blind-packet.json`, `input-manifest.json`. Do not browse, search elsewhere, read source/identity/baseline/receipts, use memory or catalog information, inspect peer outputs or invoke another reviewer. Source/human metadata has been omitted from the neutral projections. Do not seek or reconstruct it. Report recognition or accidental forbidden access candidly; recognition cannot be erased by renaming IDs. Read-scope receipts are declarations, not technical sandbox proof.

## Interpretation

Use the eight clauses B0–B7 and precedence in `policy.json`. Natural-material priors match only exact canonical names or listed aliases after case/whitespace normalization; preserve punctuation, derivative, plant-part and oil/extract distinctions. Source-scoped display changes have already been reviewed before this blind packet. A missing material match is no weight prior. Generic role matches do not confer material weights or a known amount.

Assign every ranked ingredient a qualitative formula role with a reason. `principal` contributes to the hypothesized carrier/retained system; `secondary` is a plausible supporting system contribution; `auxiliary` requires an affirmative known ancillary function, never presumed trace/harmlessness; `unresolved` retains missing identity/function or deciding involvement. A lexicon `not_assessed` entry must remain `unresolved` and be acknowledged in the weight gaps. It need not block a weight if the first-order architecture is otherwise supported; explain why its uncertainty does or does not decide the class. No count/rank-to-percentage conversion, 1% boundary, default-medium-for-missing-data or skin-feel class.

Evaluate positive and competing architecture arguments and choose `light | medium | rich | unknown`. All substantive mixed-formula answers use `estimate=true`, `confidence=low`; unknown uses `estimate=false`, `confidence=low`, plausible alternatives and a specific deciding gap. These inputs are mixed formulas. Every answer has a strongest alternative, uncertainty, cited policy clauses, reasoning and counter-signals. Agreement cannot raise confidence. Do not force coverage or agreement.

## Output contract

Write only `records.json` and `notes.md` under your assigned lane directory. Preserve all eight IDs, formula order and ingredient ranks. Do not write shared inputs. The records file has exactly top-level `run_id`, `records`, `read_scope`. Each record has exactly `neutral_id`, `ingredient_roles`, `material_matches`, `weight`:

```json
{
  "neutral_id": "Rxx",
  "ingredient_roles": [
    {"rank": 1, "canonical_name": "EXACT PACKET NAME", "role": "principal", "reason": "Qualitative argument from admitted functions; no amount assumed."}
  ],
  "material_matches": [
    {"rank": 1, "reference_id": "EXACT MATERIAL ID", "value": "light", "confidence": "low"}
  ],
  "weight": {
    "value": "light",
    "estimate": true,
    "confidence": "low",
    "evidence": ["Positive architecture argument"],
    "counter_signal": ["Credible competing argument"],
    "nearest_alternative": "medium",
    "alternatives": ["medium"],
    "rule_ids": ["B0", "B1", "B4"],
    "reason": "Why the chosen argument wins or why no argument wins",
    "unresolved": ["Named amount/grade/function uncertainties, and deciding gap if unknown"]
  }
}
```

Include **every exact material match**, even secondary/unresolved ones, once per ingredient rank in increasing order. No automatic match for modified/unspecified/missing forms. The v0.10 reference now expressly admits the two exact shorter sunflower Oil names through their own separate entry. Match that entry as provided; B0 does not delete an explicit lookup and still forbids generic plant-part normalization. `value`/`confidence` in a material match are copied from that entry's `weight_prior`, including unknown. Never confuse a material prior with the formula answer.

`read_scope` is exactly `files`, `hashes`, `forbidden_access`, `recognition_note`. `files` lists the exact six permitted filenames; `hashes` maps all six to their actual SHA-256, including the manifest's own bytes. `forbidden_access` is false only if none occurred; `recognition_note` explicitly states any formula recognition and whether it affected judgment. The manifest hashes the other five files and does not recursively hash itself. Notes summarize difficulties and attest independent work; no claims of validation or targets. Root's separate working judgment is written before opening either independent output, with its known source/selection access disclosed separately.
