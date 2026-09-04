# Shampoo v1.4 pilot validator

`validate-pilot.mjs` is a task-local, read-only gate for the five-product pilot.
It deliberately validates research evidence and lane process, not the Production
Light projection logic. The shipped adapter remains the only projection oracle.

Run it from the worktree:

```bash
node plans/scan-db-expansion/research/shampoo-v14/tools/validate-pilot.mjs
node plans/scan-db-expansion/research/shampoo-v14/tools/validate-pilot.mjs --phase sources
node plans/scan-db-expansion/research/shampoo-v14/tools/validate-pilot.mjs --phase lanes
node plans/scan-db-expansion/research/shampoo-v14/tools/self-test.mjs
```

Expected packet shape is intentionally documented here rather than inferred from
old manifests. `source-packet.json` has `version`, `product_id`, `identity`,
`formula`, `blind_packet`, and `post_unblind_evidence`. `formula` needs
`raw_inci`, `normalized_ordered_inci`, `normalized_inci_string`,
`sha256_normalized_inci`, canonical source binding and complete provenance.
Raw manufacturer punctuation may differ from the normalized formula only with
`normalization_notes`; the ordered array must join exactly to the normalized
string. The blind packet contains formula architecture only: positional
surfactant and conditioning-route facts plus `fact_id`/`text` architecture
facts. Claims and directions must live under `post_unblind_evidence`, never
`blind_packet`.

Each lane file has `version`, `productId`, `properties`, and a lane-specific
receipt. Every direct property uses `{ value, confidence, formulaFacts,
counterSignal, neighboringAlternative, evidenceRefs }`; the neighboring
alternative uses the same enum/type as the selected value and must differ from
it (order-insensitive for `focusSecondary` arrays). Each formula fact has an ingredient
and integer position. `weightPotential` additionally has
`weightAssessment.depositionLoad`, `persistence`, and `resetCapacity`.
`comparison.json` records both lane member IDs and `judgmentProperties`
(exactly the seven non-dandruff keys); `adjudication.json` contains
the final eight properties. The validator computes agreement from the lane
records itself, including order-independent `focusSecondary` arrays and a
formula-derived dandruff check (Piroctone Olamine / Climbazole).

For each product, run the shipped CLI into two nested, fresh output directories:
`adapter-artifacts-run-1/` and `adapter-artifacts-run-2/`. Keep its JSON stdout
as `adapter-cli-receipt-run-1.json` and `adapter-cli-receipt-run-2.json`, and
write `adapter-determinism-receipt.json` with the two matching output and summary
SHA-256 values. The rendered Markdown is not expected to contain the CLI command.
This tool never invokes the CLI: it is strictly read-only and the CLI writes
artifacts. Never use `--overwrite` against a product research directory.

## Focus v1.5 overlay

Complete validation also requires `focus-v15.json` for every pilot product. It is
an additive review overlay: the validator joins it to the exact product ID,
canonical formula fingerprint, exact v1.4 adjudication-file SHA-256, and the
prior v1.4 adjudicated primary/secondary focus values. It then validates the
separate forward taxonomy (`volume`, `shine`,
`repair`, `moisture`, `clarifying`, `scalp_active`, `general`), formula facts,
counter-signal, care-direction support state, claim role, and decision trace.

The overlay is never passed to the shipped v1.4 Production Light adapter and does
not regenerate adapter inputs or determinism receipts. `gentle` remains valid in
the frozen v1.4 record and for cleansing interpretation, but is invalid as an
effective v1.5 focus.
