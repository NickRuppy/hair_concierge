# Independent preservation preflight — profile care cohort

## Scope and current integrity

Read-only review of exactly D1–D3 and their unchanged keepers in `/tmp/profile-care-cohort-ledger.md` and `/tmp/profile-care-cohort-evidence.json`, plus the current owner paths. Current donor/keeper test hashes match the evidence receipt:

- `tests/profile-plan-overlay.test.ts` — `1beaaee100327de0d9f087eaa339d2b9aee0f61299f97e0ed7c5f00fc335e9fb`
- `tests/profile-section-config.test.ts` — `c9f38b596e41ed06a4b9d4e38d67f859ee7aa8e9fc4b717d48127dc82379fd6f` (retained-only cohort context)
- `tests/onboarding-care-vocabulary.test.ts` — `a18fcfa8554004bb8bd05fc9b6fdfdca4f2f112a3ab53189cd81b2e6b1a166f0`
- `src/lib/profile/section-config.ts` — `32801fdf7049e318cb6190eeda67eb75acd07704c03eae384f1e28add37be74a`
- `src/lib/vocabulary/onboarding-care.ts` — `e5f92f3ec2571da3d821d7b9df75db34939a103d4cb1de7ce972bf54d0a8e547`

These five paths have no current worktree diff. `test:node` includes both test files via `package.json:49`; CI `quality-node` invokes it at `.github/workflows/ci.yml:148–164`. `tests/server-only-register.cjs` only substitutes the `server-only` marker and does not alter these functions.

## Verdict by candidate

| Candidate | Verdict | Exact preservation evidence | Fault status |
|---|---|---|---|
| D1, overlay `:48` | **Supported, conditional on exact deletion only** | Donor is exactly `dryingMethodField.getValue(null, {}) === null`. Unchanged keeper at `:52–58` includes the identical invocation/assertion as its fifth clause. The actual `drying_method` owner at `src/lib/profile/section-config.ts:337–353` reads only `profile?.drying_method`, then `plan?.dryingRoutes`; both inputs are absent/null in both callbacks. | Evidence anchor `D1-missing-drying-answer` changes only the final return to `"Nichts davon"`; keeper’s same clause should fail. Receipt marks it static-parse-only; no actual fault proof yet. |
| D2, overlay `:89` | **Supported, conditional on exact deletion only** | Donor and keeper `:79–87` both call actual `towelTechniqueField.getValue(null, { towel: { material: "no_towel" } })` and require `"Keine Trocknungstechnik"`. The `as const` in keeper has no runtime effect. `resolveTowelSource` (`section-config.ts:97–126`) reads only legacy towel signal, material, and technique; both inputs yield no legacy signal, `planMaterial=no_towel`, `planTechnique=null`. Keeper also retains the material outcome; no donor assertion is substituted by that separate clause. | `D2-no-towel-technique` changes only the plan no-towel technique branch to null, so the retained technique assertion is the intended failure. Static-parse-only, not executed. |
| D3, vocabulary `:44` | **Supported, conditional on exact deletion only** | Donor asserts membership of `loose_tied` and absence of legacy `loose_braid`/`loose_bun`. Keeper `:50–64` asserts strict deep equality of the same `NIGHT_PROTECTIONS` literal array: exactly five entries including `loose_tied` and neither legacy string. Strict ordered array equality implies all three donor clauses. This is the actual exported vocabulary used to create `NIGHT_PROTECTION_OPTIONS` (`onboarding-care.ts:98–124`), not a test-produced value. | The three D3 anchors remove `loose_tied`, add `loose_braid`, or add `loose_bun`; each should fail the retained deep-equality assertion. Static-parse-only, not executed. |

## Owner and public-path check

- `PROFILE_FIELD_CONFIG` is rendered at `src/app/profile/page.tsx:870–876`, which calls `field.getValue(hairProfile, refinementAnswers)`. D1 preserves missing-answer display and D2 preserves plan-only no-towel display at that exact owner.
- `NIGHT_PROTECTIONS` feeds both the canonical-value set and `NIGHT_PROTECTION_OPTIONS`; the onboarding flow normalizes persisted values on resume and save at `src/components/onboarding/onboarding-flow.tsx:181,499`, and exposes options at `:669`. D3 removes only a strictly weaker inventory assertion; normalization regressions remain independently covered by the neighboring callbacks.
- The three proposed deletions do not modify source, exported vocabulary, consumers, fixture setup, assertions in the keepers, or test invocation inputs.

## Preflight limits and required control gate

No repository mutation, test, typecheck, coverage, or fault execution occurred. The evidence JSON contains prospective source fault texts and hashes, but this review found no independently stored prospective test-cut file to diff; main should make the cut from current hash-pinned bytes and verify the only changes are the three complete callback deletions. Before credit, run each named owner fault against its named keeper, require the stated assertion failure, restore exact source bytes, and confirm the unchanged keeper body/hash. No new scenario, call, or assertion is justified.
