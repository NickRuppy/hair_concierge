# Stage 3 catalogue authority repair — code-review receipt

## Review identity

- Scope: the complete task tree at canonical content fingerprint `4b01055057fb229837371b86bb0b357ba7b01ad1105d1577b74f3f273df94fbd`.
- Branch: `codex/stage3-catalog-authority-repair`
- Base: `0b5945f3`
- Counterpart: one read-only Claude Opus 4.8 whole-branch review and one successful focused delta review at high effort. The exact-head rerun could not start because the reviewer account reached its weekly limit; the final delta was reviewed locally and is limited to current-main integration, the behavior-equivalent chat-file restoration, and receipt refreshes.

## Findings and rulings

No blocking findings remain.

Release-gate finding:

- The failed exact-head `quality-personal-plan-browser` run was not evidence of a Stage 3 product regression. Its production lab passed, after which development-only pages returned 404 in the same runner and the journey waited until the ten-minute job timeout. The workflow now assigns production build/lab and development journeys to separate runners, and the fail-closed `quality-core` aggregate requires both results. The classifier and chat-evaluation rules were not weakened.

Resolved findings:

1. Oil supportive copy claimed an adjacent weight while the router could previously authorize a two-step `light` to `rich` gap. The router now requires an exact one-step distance and tests reject the two-step gap.
2. Complete-only Shampoo stops (`dandruff`, `dry_flakes`, `irritated`) leaked into rollback presentation. They are now gated with the complete-catalog flag; rollback tests prove the old stop set and unknown positioning remain intact.
3. The audit carried a dead hard-coded completeness field. It is removed; every remaining failure code is reachable and tested.
4. Complete Shampoo authority originally translated route but did not enforce cleansing intensity. It now grades a route-correct intensity deviation as supportive and tests both ideal and supportive paths.
5. A supportive intensity-only owned Shampoo was not keepable and could not serve as a fallback alternative. It now has explicit `keep_owned` authority and a fingerprinted supportive recommendation rule, while uncovered roles remain strict and ideal candidates retain ranking priority.
6. Mask and Bondbuilder treated any non-empty `suitableThicknesses` list as a pass. Both now require the list to include the confirmed evaluation thickness; wrong-thickness candidates are rejected before comparison selection.

Accepted bounded risk:

- Product Intake permits `dry_flakes` as a secondary route for the `schuppen` bucket, but the set-based assessment search currently requires one deterministic route. Live inspection found zero such rows and all 57 current Shampoo specs follow the selected primary routes. Multi-route assessment would require an explicit SQL contract change and is not necessary to activate the current catalogue safely.

## Correctness conclusions

- `products` remains the canonical identity/lifecycle/recommendability table; category specification tables remain the canonical fit-property source, and product/application protocol tables remain the canonical usage source. The change repairs translation, hydration, and ranking rather than introducing another catalogue.
- Complete hydration proves exact product cardinality and batches category facts; it fails closed on incomplete pages or ambiguous singleton facts.
- The three-item transport limit is downstream of complete evaluation, so it no longer turns the first 12 products into the effective catalogue.
- Alternatives remain active, recommendable, exact-role, nonzero-target-coverage products with current server-authored fingerprints.
- Request-scoped caching is keyed by selection context and complete-mode state; rollback cannot reuse complete-mode results.
- No new client authority, personal-data logging, schema mutation, or production write surface was introduced.

## Verification considered

- Recommendation/chat isolation suite: 164/164; `chat_eval=false`; shared chat Shampoo file byte-identical to `origin/main`.
- Full Personal Plan suite: 1575/1575.
- Complete-mode browser journey: 16/16.
- Flag-off typecheck, lint, and production build: passed.
- Focused comparison/authority/persistence/audit regressions: passed.
- Production-shaped benchmark: passed within the recorded readiness budget.
- Live read-only all-category coverage and Shampoo property audits: passed.
- CI orchestration regression: 12/12; aggregate/path/job-result contract suite: 29/29.
- Final authority/comparison regression suite: 139/139.

## Bottom line

No blocking findings. The reviewed tree is ready for guarded ship, merge, deployment, and feature activation.
