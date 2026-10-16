# Oil blend-weight exploratory round 4

2026-10-03. Authorized by OE30. Ten source-scoped mixed formulas: six new to oil classification, four frozen development replays. This is an application/repeatability trial of policy v0.1 over unchanged material v0.7, not measured hair feel, sensory accuracy, a holdout or intake readiness.

## Artifact manifest

| Files | Authority / purpose |
| --- | --- |
| `method.md`, `policy.json`, `material-reference.json`, `role-lexicon.json`, `blind-packet.json`, `input-manifest.json` | Exact six-file independent-lane read scope. Manifest hashes the other five; output receipts include manifest hash. |
| `source-capture.json`, `identity-map.json`, `display-receipts.json` | Root-only exact product/raw declaration, variant conflicts and source-scoped normalization. Never opened by the blind lanes. |
| `preflight-receipt.json`, `historical-baseline.json`, `provenance-seal.json` | Source/duplicate checks, 80 historical file hashes and nonblind input freeze. |
| `lane-a/records.json`, `lane-a/notes.md`, `lane-b/records.json`, `lane-b/notes.md` | Independent formula-first judgments, role/material matching and declared scope. |
| `main-working.json`, `main-before-lanes-seal.json` | Root interpretation recorded before opening lane outputs; root knows identity/selection/human history and is not blind. |
| `comparison.json`, `adjudication.json`, `working-weights.csv`, `results-for-review.md` | Cohort-separated comparison and post-lane working reconciliation; original disagreements retained. |
| `negative-control-receipt.json`, `output-seal.json`, `verification-receipt.json` | Contract rejection checks, result hashes and fresh positive verification. |

All sources scope published declarations, not verified physical batches. Garnier conflicting declarations are held outside the cohort. Moroccanoil DE MOT02 is separate from official EU MOT01; current DE John Frieda is separate from historical All-in-1; Mielle original US capture has a matching DE offer but no universal batch equivalence. NUXE hazelnut seed oil lacks a material-weight prior. Malformed Mielle literals and unassessed generic functions remain visible. No reference entries or frozen historical rounds are rewritten.

Verification command: `python3 plans/oil-inci/verify-blend-weight-round-4.py` from the task worktree. Read-scope receipts and hashes establish declared inputs, not proof against hidden recognition or access. Matching a reused human choice is policy consistency; fresh-case agreement is method transfer repeatability, never class accuracy.
