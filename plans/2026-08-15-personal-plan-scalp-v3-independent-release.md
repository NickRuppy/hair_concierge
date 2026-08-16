# Personal Plan Scalp v3 independent release

Status: **implementation complete; exact-tree checks and adversarial review passed**

Logical release base: exact Mask v4 commit `bd0dda704e7b45805e67f0ed36c1277211d9501f`, canonical content fingerprint `33e84c5ac84f2ce3f5440badf15a1084551f118d9e210a54170dd2cfd355e4a4`. That commit is stacked on K18 commit `180fa9ae4bbec111d943c6cb296d8161d2581190` and current `main@f214e3a050098dd4b1b54cf0d7949e901fa90941`.

This is a later, independently deployable release. It contains the earlier K18 and Mask units as its production baseline, then adds only Scalp authority v3, its exact active-draft transition, role-specific complement/suppression behavior, and release evidence. It must not alter Mask v4 fit behavior or the K18 presentation-only choice.

## Confirmed product contract

- `scalp_comfort` and `scalp_flake_oil_adjunct` complement Shampoo and remain separately recommendable.
- `scalp_exfoliant` may be suppressed only by the exact `portfolio.reset.deep_cleansing_primary` / `scalp_root_reset` coverage fact.
- A generic duplicate-suppression fact or the Shampoo comfort/flake role must not suppress a verified Scalp Care recommendation.
- Stage 1 remains source-bound and image-backed; Stage 3 retains exact role/protocol authority and fail-closed catalogue validation.

## Authority transition

- Current registry: Mask v4 and Scalp Care v3.
- Supported dormant subsets: Shampoo v3→v4, Mask v3→v4, and Scalp Care v2→v3, singly or together; every other version drift is rejected.
- Completed plans are immutable.
- Active draft capture state is preserved and authority decisions reopen.
- The later migration replaces the refresh function only after the earlier Mask migration; it does not amend the Mask migration.

## Verification receipt so far

- Regression first failed because comfort was suppressed by a root-reset coverage fact; it passes after role/rule-specific admission.
- Focused authority and dormant-refresh tests pass 65/65.
- The later migration contract confirms current Mask v4, Scalp v3, the exact three supported legacy transitions, payload normalization, completed immutability, CAS, and service-role-only execution.
- A committed PGlite PostgreSQL/PLpgSQL test executes the actual Scalp migration. It proves the currently deployed pre-Mask fresh-seed path, the preceding Mask-v4/Scalp-v2 path, the dominant scalp-only v2→v3 transition, the combined dormant transition, completed immutability, `revision_conflict`, invalid-source rejection, denial for `anon` and `authenticated`, product preservation, and Scalp v3 persistence.
- Full Personal Plan suite passes 1,635/1,635; nested suite passes 522/522.
- Repository-wide `npx tsc --noEmit` passes.
- The exact-tree production build passes; the Stage 3 lab browser suite passes 5/5 and the five-stage journey browser suite passes 19/19.
- Read-only live coverage passes: all four Scalp roles have verified alternatives (comfort 3, flake/oil 1, density 2, exfoliant 2), and Basis Mask remains 2,280/2,280.
- Task-owned source lint and `git diff --check` pass.
- Claude Opus/high found that the first Scalp migration would reject the currently deployed pre-Mask runtime if sequencing discipline failed, that the executable test omitted both its lenient branch and the dominant scalp-only transition, and that the suppression copy was misleading. All four findings are addressed: the migration admits the exact pre-Mask version set without storing its destructive seed, every runtime phase plus scalp-only refresh is an executable regression, and the copy names the exact reset coverage. Claude's final delta pass was unavailable after its session limit; a separate read-only adversarial review found no runtime or migration defect and identified only an incorrect full Mask base SHA in this evidence, now corrected.
- No commit, push, PR, remote migration, deploy, flag activation, or production write occurred.

## Release boundary and recovery

Before remote application, rollback is omission of this later unit while Mask v4 remains independently deployable. The intended order remains Mask migration/code fully released first, then Scalp migration immediately before Scalp code. As defense in depth, the Scalp migration also accepts the exact currently deployed Mask-v3/Scalp-v2 fresh-seed request without discarding stored capture state, so sequencing drift no longer hard-fails Stage 3. After application, active drafts may have advanced to Scalp v3 and any correction must be a new forward-fix migration/code release; completed plans stay immutable. Mask v4 remains the required product baseline.

The exact-tree browser and adversarial-review publication gates are complete.
