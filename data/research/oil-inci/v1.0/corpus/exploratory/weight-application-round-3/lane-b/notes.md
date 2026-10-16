# Lane B — frozen weight application round 3

Independent weight-only judgments under method revision weight-v0.7. All ten neutral IDs appear exactly once: W01, W02, W03, W04, W05, W06, W07, W08, W09, W10. W08 is retained as a raw_material_benchmark; the other nine inputs remain product_formula.

## Read-scope attestation

Exactly these five input files were read, with method.md read first. Files were re-read only to obtain bounded projections after large tool output was truncated. No other file was read; no links were followed, no browsing or memory/repository/catalog/identity-map/source-capture/audit/peer-output access occurred, and no agents/reviewers were dispatched. Only lane-b/records.json and lane-b/notes.md were written. Validation operated on the constructed objects and permitted inputs before saving, without reading either output. No peer or main judgments were consulted.

- `method.md` — SHA256 `e173afe45712a1afe50bff3d75086464284c7c412b64981e2fb3253b9fcdefa4`
- `material-reference.json` — SHA256 `3bf6a3631a407e4439032f335083d927d56d0cff5061fd4e912c6a4191f76068`
- `role-lexicon.json` — SHA256 `2cd08138a1890f8e61103e6a0c0a36d9ede18c451248dc172e536bf8e74bc09e`
- `blind-packet.json` — SHA256 `3e28c57931f770791d9fa183f861fc1e2752bbaa72c64be510688d1769f5830c`
- `input-manifest.json` — SHA256 `4221fd663d8bea5135efb054e2e2924ebdc8497d79749e5b9baefc6c511c8974`

All four hashes recorded within input-manifest.json match the bytes read; the manifest's own hash above was calculated independently.

## Recognition disclosure

The W01 peptide and W09 bis-aminopropyl ingredient patterns are recognizable as familiar commercial repair-oil patterns. Permitted reference/lexicon metadata itself exposes a K18 source URL and a named Primavera Calendula example corresponding to W04's carrier/extract structure. These are recognition cues within allowed input, not independent product-identity verification. No remembered brand formulation, claim, grade, dose, sensory behavior or other outside fact was used. No exact retail identity was asserted in the records. The generic material priors are intentional inputs, not a claim of full ignorance of ingredient identities.

## Chosen direction and uncertainty

- W02 light/low; W03 medium/low; W05 rich/moderate; W07 medium/low; W08 rich/low (raw-material benchmark); W10 medium/low.
- W01, W04, W06 and W09 remain unknown with estimate:false and low confidence. W04 lacks a decisive sunflower/olive mixture balance; W06 contains opposing whole-carrier priors with unknown ratios. W01 lacks weight-relevant derivative evidence and an exact sunflower-seed prior; W09 lacks decisive silicone/other-carrier grade and residual-film evidence.
- Unknown records use weight_only_blocked to indicate that a substantive class is blocked, although their full weight-only assessment and ingredient ledger are complete. Their nearest_alternative is null because a single nearest class is not supported. Competing class interpretations are recorded individually.
- Every exact material match retains the complete current weight_prior object, including confidence, alternatives and unresolved limits. Generic role evidence does not create a weight prior. Roles describe contextual carrier importance without implying a concentration, fixed first-two rule, tail threshold, or numerical majority.
- No standalone Calendula class, castor-derivative inheritance, unspecified Sunflower Oil-to-Seed Oil alias, Corn Oil-to-Germ Oil substitution, or ferment-extract-to-intact-oil transfer was made.
- Pure-formula results are direct applications of the frozen rough priors, not independent sensory validation. The approved practice anchors for argan, moringa, black seed and Cacay retain their physical counter-signals and low confidence ceiling. Castor alone retains moderate, never higher.
- Medium was rejected as a missing-data compromise for the blends. No percentages, retail grades, fit, penetration, efficacy, other direct-property, intake or production-readiness conclusions were inferred.

## Acceptance checks

Before saving, Python standard-library assertions checked ten unique IDs in packet order, input-kind preservation by construction, all 65 ingredient ranks/names exactly once, all 15 exact material matches with no extra match, allowed role/confidence values, substantive estimate:true, and unknown estimate:false/low with specific unresolved gaps. JSON was serialized with allow_nan=False. Judgments were made manually above; Python performed only data assembly, exact matching, hashes and structural checks. Stop after this save; no peer comparison or subsequent amendments.
