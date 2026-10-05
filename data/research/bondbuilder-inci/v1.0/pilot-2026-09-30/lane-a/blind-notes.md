# Lane A — sealed Stage A notes

Seal date: 2026-09-30. Stage: A only. Schema: `bondbuilder-blind-records-v0.1`. Standard: `bondbuilder-inci-v0.1`. Lexicon: `bondbuilder-lexicon-v0.1`.

Eight records (A01–A08) are sealed in `blind-records.json`. No final category, final technology assignment, trust, efficacy, application or fit conclusion is assigned. This seal freezes observations for later comparison; Stage B must retain this file and log subsequent interpretation changes separately.

## Files read

Exactly two input files were read in this lane, each first as text and then for its file SHA-256:

1. `docs/research/bondbuilder-inci/v1.0/bondbuilder-classification-standard.v0.1.md`
   - SHA-256: `712e629f0d92f4d9bafdf3f5fcce151628feb0819b777eb329ec3870c62a2968`
2. `data/research/bondbuilder-inci/v1.0/pilot-2026-09-30/blind-packet.v0.1.json`
   - SHA-256: `8bf4726eaa5a96723ac9243369cbd1c93a713945cc103964c6a0add8bccd1c40`

No linked document, plan, report, named packet, other lane, skill, memory file, repository instruction file or additional source was opened. Instructions already supplied in conversation are not extra file reads.

## Isolation confirmation

No web browsing, fetch, database access, external research, reviewers or subagents were used. No product-name lookup occurred. Only the two owned lane outputs were written. The lane stops after this written seal and awaits explicit Stage B instructions.

## Observation decisions and ambiguity register

- Confidence has separate meanings: high marker-presence confidence means an ingredient is visibly present in the given capture; it cannot mean that capture is the target formula. Candidate confidence refers to formula/lexicon compatibility. Target applicability is moderate for source-resolved but incompletely bound rows, and low for explicit conflict/identity/market holds.
- A01: both required gluconamide/gluconate ingredients are present. Lactic/tartaric acid and octyldodecyl citrate crosspolymer are not the standard's citric acid/sodium citrate clue. Supplied-pack verification remains absent.
- A02: the specific maleate ester is present. Its family is distinct from the dimaleate family. The packet describes the concentrate, and missing dilution quantities preclude an in-use composition or dose. Catalog binding remains unverified.
- A03: both conflicting captures contain citric acid and sodium citrate. Their different bases, polymer systems and ordering remain separate observations. Agreement on a generic clue does not resolve a material same-market formula conflict. No preferred capture was selected.
- A04: the specific designed peptide is present. Generic wheat protein/starch do not establish this family on their own. Citric acid is retained as a secondary weak clue. Foreign-variant differences and catalog binding remain unresolved.
- A05: captured citric acid plus glycine is a possible acid-family clue only. Wrong size, mismatched manufacturer block and unresolved target formula block product-level attribution. No source re-anchoring or correction was attempted.
- A06: citric acid with arginine and betaine makes acid/calcium management a moderate formula candidate; ordinary acidic conditioning remains plausible. This is not a calcium-removal finding. EDTA is only an architecture observation; chlorhexidine digluconate is not the gluconamide/gluconate pair. The packet's source-resolved status is preserved alongside the old/new claim-copy conflict and unverified supplied pack.
- A07: the dimaleate marker is specific. A lipid/cationic conditioning architecture does not exclude targeted treatment, but cannot establish its role. Citric acid is secondary and weak; sodium metabisulfite and chelator presence do not demonstrate native-bond restoration. Market-variant and catalog-binding limits remain.
- A08: both members of the gluconamide/gluconate pair are present in the capture. Generic proteins are not the designed peptide. Citric acid plus arginine remains a secondary weak clue. The explicit market hold prevents DE/EU target-formula verification.
- Generic acid clues are reported consistently wherever citric acid appears (A03–A08), including alongside stronger specific markers. They are not final family assignments or evidence of multiple efficacies. A06 receives moderate candidate confidence because it contains two named supporting markers, but no confidence distinction is a potency comparison.
- The packet supplies complete-looking normalized lists and declared hashes, but intentionally withholds raw capture/source identity. Declared raw/formula hashes are retained as provenance and were not validated against unavailable raw source text.
- Ingredient-function descriptions are bounded formulation interpretations. They establish no physical format, pH, concentration, application sequence, effective dose, sensory outcome, treatment intensity or user fit.
- Named evidence is required to establish specialized intent and applicable directions; even specific markers cannot finalize category membership in Stage A.

## Recognition and incidents

- BI-01 / A02: the distinctive diethylhexyl maleate concentrate triggered a possible epres brand association.
- BI-02 / A04: sh-Oligopeptide-78 triggered a K18 brand association.
- BI-03 / A07: bis-aminopropyl diglycol dimaleate triggered an OLAPLEX brand association.

These are blinding incidents, not identity findings or evidence. No exact product/version was guessed or assigned. No remembered claim, protocol, reputation, supplier or benefit was used. No other distinctive-brand recognition was relied on. This exercise cannot be represented as fully experimental blinding or efficacy research.

## Seal verification

The constructed JSON parsed successfully before writing; its records contain exactly eight unique slot IDs, A01–A08. All input formula statuses and flags are preserved verbatim; A03 retains both capture hashes and separate observations. Per-field confidence and limitations are recorded. The source-file SHA-256 values were computed from the two allowed inputs. Output reads, named access and further classification stop at the seal.

