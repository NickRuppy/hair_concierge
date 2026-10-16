# Oil weight application — exploratory round 3

Authorized by OE24 on 2026-10-02 after Nick replied “do it” to complete-list review plus a small pure-oil/blend round. This is weight-only application research using v0.7, not a complete oil profile, sensory validation, unseen holdout or intake/production activation.

- Complete-list audit: `complete-list-review.json` (65 identities / 104 names; explicit evidence/limits).
- Current source-scoped declarations: `source-capture.json`; exact identity mapping: `identity-map.json`; product-specific display normalization: `display-receipts.json`.
- Frozen formula-only inputs: `method.md`, `material-reference.json`, `role-lexicon.json`, `blind-packet.json`, `input-manifest.json`. Classifiers may read exactly these five files and no source/identity/peer/catalog/memory content or web pages.
- Independent lane artifacts: `lane-a/records.json` + `notes.md`; `lane-b/records.json` + `notes.md`. Declared read-scope/hashes are verified, but hidden recognition/access is not empirically disproved.
- Main working interpretation: `main-working-weights-v0.7.json`, written before reading peer judgments. Blend alternatives remain explicit; agreement alone does not choose a class.
- Final seals, comparison, readable result and verification receipt are produced after both lanes finish.

Cohort: five pure-oil product formulas, four finished blends, one Cacay raw-material benchmark. Cacay benchmark is separately counted; no retail hair-product eligibility is implied. Cliganic US and Alepia FR/EU formulas retain market scope; current DE equivalence is not asserted. Five identities revisit previous development inputs; none is labeled unseen.

The generic material priors are intended inputs: pure-material agreement tests consistent application. Finished-blend comparison tests interpretation repeatability under incomplete ratios/grades, not actual hair heaviness. Formula rank, botanical count, maker claims and a rich-oil presence cannot independently establish finished weight.

Run verification: `python3 plans/oil-inci/verify-weight-application-round-3.py --inputs-only` before dispatch; same command without the flag after output seal. Historical rounds also retain the earlier verifier. All durable artifacts are retained for eventual authorized publication; no commit/push or external activation follows.
