# final504 portfolio-presentation coverage attribution

493→504 raw branch counters changed **45/35 covered to 41/30 covered**. The source removes `plannedLabelFor`; coverage function maps show its prior function and its internal branch arms at old lines 97–102 disappear. That accounts for four branch locations and is deleted code, not a surviving gap.

The shared pre-existing zero locations remain at source-map lines 53,54,57,59,64,83,84 plus generated line 1; they are reader/parser error/null/legacy paths, not new in 504. The sole new zero location in 504 is line 95 in surviving `routinePresentationLabels`: the false/null side of `presentation?.schemaVersion === 3 || ... === 4` used by `fitLabelFor`.

The surviving `fitLabelFor` false/null behavior already has an existing owner assertion at `tests/personal-plan-portfolio-presentation.test.ts:65-66`: `routinePresentationLabels(null).fitLabelFor("informed_override") === null`. Therefore line-95’s raw zero is source-map/function-counter attribution inconsistent with the retained direct assertion, not evidence for a new repair. No additional assertion or restored callback is warranted from this flag.

The deleted pending-label donor may incidentally have exercised a v3 snapshot with empty retained products, but that parser/read path is distinct: `loadOwnerPortfolioPresentation` still parses the snapshot at lines 58-60 and normalizes retained products at 63-68. No evidence here shows those surviving branches newly zero; do not restore the deleted planned-label callback merely for incidental coverage. A parser-specific keeper would need an existing strict snapshot test with empty retained products and an exact parse/response assertion.

Limits: source-map generated counters at line1 and raw totals cannot establish user behavior. No test/run/mutation occurred.

Main checked the complete live owner and retained callback and ran a valid source fault setting hasReplacementPresentation=true. Existing null assertion failed with Mit Einschränkung != null at line66; clean selected runs before/after passed, exact source SHA restored. Receipt final504-fit-controls.json. The numeric flag remains disclosed, not reclassified as a raw per-file pass.
