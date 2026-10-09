# Personal Plan ready/readiness complete ledger

**Scope.** Read-only audit of every current AST declaration: `tests/personal-plan-ready-readiness.test.ts` **39** plus `tests/personal-plan-field-test-readiness.test.ts` **1**, total **40**. Read test callbacks/fixtures, `src/app/plan-bereit/readiness.ts`, enrollment/profile/artifact/funnel closures, relevant routes/operator references, history, and CI inclusion. No repository edits, test execution, provider/environment/credential access, or DB operation.

**Disposition: 40 R / 0 C / 0 D / 0 F.** No candidate repeats an existing keeper with the same authorization/identity/version/provisioning input and observation. No test-only owner or obsolete executable route was found. Machine candidate list: `/tmp/test-audit-ready-readiness-machine-candidates.json` is an empty array.

## Production closure

- `loadPlanBereitInitialReadiness` at `src/app/plan-bereit/readiness.ts:708` resolves identity, artifact/profile/source readiness and calls scan provisioning before it can return ready (:734-71); `loadPlanBereitReadiness` :786 is its production wrapper.
- `resolvePlanBereitFunnelPackage` :842 distinguishes organic/missing/broken attribution; `ensureScanBuyerProvisioned` :1014 calls the Stage1 provisioner and keeps failure non-ready. `updateMissingPlanBereitSourceFact` :1042 validates allowed missing facts, scope, source version and links/provisions only after complete recovery.
- Artifact/profile loading and exact source facts are enforced at :469-702 and link is an RPC at :899-98. Field-test admission is tied to `findPersonalPlanEnrollmentForUser` in `src/lib/personal-plan/enrollment.ts:192` and is distinct from a synthetic email string.
- Current history includes main/PR634 adaptation `3635fdab` after the central profile save path `3abfe00a`, scanner-return `1291bad1`, and scan_v1 package work `f8c28328`; these are active compatibility/recovery paths, not retirement evidence. Native CI’s glob includes these files through `package.json:49` and `.github/workflows/ci.yml:158`.

## Evidence key

| Key | Independent regression retained |
|---|---|
| F | exact missing-fact vocabulary, owner scope, source-version CAS and canonical profile projection |
| L | legacy source/profile semantic equality and idempotent link/post behavior |
| A | attached artifact identity/owner/race and readiness preconditions |
| S | package attribution, scan buyer provisioning, retry and organic separation |
| T | exact active field-test enrollment admission for synthetic guest email |

## Exact declarations

### tests/personal-plan-ready-readiness.test.ts — 39 R

| Line | Declaration | Mark | Evidence |
|---:|---|---|---|
| 15 | email return recovery asks only absent or invalid Stage-1 facts | R | L |
| 42 | Personal Plan missing facts remain distinct from missing artifacts and context answers | R | F |
| 69 | missing-fact patch rejects wrong enums, duplicates and contradictory treatments | R | F |
| 78 | migration quiz recovery retains the existing hair-length repair and rejects authorization failures | R | F |
| 249 | legacy readiness is ready only when the exact lead is already projected into hair_profiles | R | L |
| 280 | legacy readiness is not a no-op when the persisted profile misses a projected fact | R | L |
| 312 | legacy readiness compares every projected profile field and ignores goals plus unrelated fields | R | L |
| 382 | legacy readiness treats missing projected fields and array order drift as unequal | R | F |
| 426 | legacy initial readiness skips posting when already semantically projected | R | L |
| 455 | legacy initial readiness keeps the authoritative POST for an unprojected owner lead | R | L |
| 483 | legacy readiness accepts the exact active regular-quiz field-test enrollment as linkable | R | T |
| 537 | legacy readiness asks only the canonical hair-length question when that exact fact is missing | R | F |
| 577 | missing hair length persists against the exact owner-scoped lead with source-version protection | R | F |
| 624 | foreign exact leads are forbidden and never patched from the recovery form | R | F |
| 651 | Personal Plan readiness keeps the attached artifact and projected profile requirement | R | A |
| 684 | Personal Plan readiness is not ready when the attached artifact is not yet linked | R | A |
| 725 | Personal Plan initial readiness links when an attached artifact belongs to another user | R | A |
| 762 | Personal Plan POST keeps the authoritative artifact owner race rejection | R | A |
| 847 | email return saves only a currently missing fact, retaining other answers and version CAS | R | F |
| 894 | legacy German-valued recovery preserves source answers and projects canonical profile values | R | F |
| 929 | stale missing-fact writes do not replace a newer quiz | R | F |
| 952 | email package recovery needs the exact supplied lead session | R | S |
| 977 | Personal Plan email returns provision only with facts, attached artifact and exact session | R | A |
| 1034 | exact email return repairs a missing Personal Plan artifact only after the post-access POST | R | F |
| 1116 | email return will not use a stale Personal Plan artifact as scanner-ready source | R | A |
| 1179 | a scan_v1 buyer gets the initial need snapshot provisioned inside the link poll | R | S |
| 1212 | scanner provisioning repeats safely once the lead is already linked | R | S |
| 1231 | organic legacy buyers keep the pre-scanner link behaviour | R | S |
| 1250 | a personal-plan lead never triggers scanner provisioning | R | S |
| 1297 | failed scanner provisioning reports transient_error instead of an empty camera | R | S |
| 1312 | a lead with no funnel session at all is an organic buyer, not a blocked one | R | S |
| 1333 | a missing funnel session still reaches ready — organic, with no package | R | F |
| 1347 | a package lookup that cannot answer never reports ready, on either status path | R | S |
| 1387 | the resolved package travels with every readiness outcome | R | S |
| 1412 | the production package resolver separates a missing row from a broken lookup | R | F |
| 1451 | a scan_v1 buyer whose profile is already linked is provisioned before ready is reported | R | S |
| 1474 | a scan_v1 buyer never sees ready while provisioning fails, and a plain retry re-runs it | R | S |
| 1496 | an organic lead reaches ready without any provisioning call | R | S |
| 1512 | a personal_plan source is never even looked up on the read path | R | L |

### tests/personal-plan-field-test-readiness.test.ts — 1 R

| Line | Declaration | Mark | Evidence |
|---:|---|---|---|
| 6 | plan-bereit accepts only the exact active field-test enrollment when the guest email is synthetic | R | T |

## Limits

Static evidence only. I did not execute native, browser, PGlite, provider, mutation, or DB controls. A passing current source reference does not prove live production data state; it establishes that these source paths remain wired and must retain their independent tests until stronger same-input proof exists.
