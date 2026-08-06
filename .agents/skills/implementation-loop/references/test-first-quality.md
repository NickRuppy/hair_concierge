# Test-first quality

Load this reference when writing or changing deterministic behavior, a regression guard, or a test double.

## Prove the guard

Before implementation, run the focused test and confirm it fails for the missing or incorrect behavior—not a fixture, import, syntax, or environment error. If the fix already exists, temporarily neutralize that fix, observe the regression test fail, restore it, and observe it pass. Record the command and both outcomes.

## Test a break, not an implementation

- Name the realistic production change the test should catch.
- Derive expected values independently with literals or hand-checked fixtures; do not reuse the code under test to calculate both sides.
- Assert consumer-visible output, state, side effects, or contracts rather than source text, private structure, or mock existence.
- Test project-owned boundaries, not upstream framework mechanics.

## Make mocks earn their place

Use real components until a dependency proves slow, external, nondeterministic, or destructive. Before mocking a method, identify its side effects and keep any behavior the test depends on real. Make mock responses match the complete relevant production shape.

## Finish with a mutation check

Mentally change the likely failure points—wrong branch, constant, argument, validation, state transition, or missing side effect. At least one test should fail for each realistic regression the change promises to prevent. A mutation nothing catches is either unprotected behavior or a test that does not earn its maintenance cost.
