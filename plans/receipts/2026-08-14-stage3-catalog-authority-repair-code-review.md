# Stage 3 catalogue authority repair — code-review receipt

## Review identity

- Scope: the complete task tree at canonical content fingerprint `f3ebf5d36d0dac6bbb664dd432e0099a4008054990e2a498566e6be37cddbf7a`.
- Branch: `codex/stage3-catalog-authority-repair`
- Base: `53c15176`
- Counterpart: one read-only Claude Opus 4.8 whole-branch review and one successful focused delta review at high effort. A final micro-review of the supportive-Shampoo follow-up could not start because the reviewer account reached its weekly limit; that bounded delta was reviewed locally and is covered by 137 focused and 1,573 full-suite tests.

## Findings and rulings

No blocking findings remain.

Resolved findings:

1. Oil supportive copy claimed an adjacent weight while the router could previously authorize a two-step `light` to `rich` gap. The router now requires an exact one-step distance and tests reject the two-step gap.
2. Complete-only Shampoo stops (`dandruff`, `dry_flakes`, `irritated`) leaked into rollback presentation. They are now gated with the complete-catalog flag; rollback tests prove the old stop set and unknown positioning remain intact.
3. The audit carried a dead hard-coded completeness field. It is removed; every remaining failure code is reachable and tested.
4. Complete Shampoo authority originally translated route but did not enforce cleansing intensity. It now grades a route-correct intensity deviation as supportive and tests both ideal and supportive paths.
5. A supportive intensity-only owned Shampoo was not keepable and could not serve as a fallback alternative. It now has explicit `keep_owned` authority and a fingerprinted supportive recommendation rule, while uncovered roles remain strict and ideal candidates retain ranking priority.

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

- Full Personal Plan suite: 1573/1573.
- Complete-mode browser journey: 16/16.
- Flag-off typecheck, lint, and production build: passed.
- Focused comparison/authority/persistence/audit regressions: passed.
- Production-shaped benchmark: passed within the recorded readiness budget.
- Live read-only all-category coverage and Shampoo property audits: passed.

## Bottom line

No blocking findings. The reviewed tree is ready for guarded ship, merge, deployment, and feature activation.
