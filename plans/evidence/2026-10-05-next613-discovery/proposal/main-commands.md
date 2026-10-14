# Main-only validation commands

These are proposed commands, not executed. No source editor or fault driver is provided in this discovery lane. Start in /Users/nick/AI_work/hair_conscierge/.worktrees/test-audit-pruning.

Read-only static check:
```sh
node /tmp/test-audit-discovery-operational163/verify.cjs
```

Full exact cohort (contains local PGlite execution, no browser tests):
```sh
node --import ./tests/server-only-register.cjs --import tsx --test tests/discovery-call-toolkit-migration.test.ts tests/discovery-call-tracking.test.ts tests/discovery-checklist-categories.test.tsx tests/discovery-checklist-projection.test.ts tests/discovery-cockpit-complexity-dom.test.tsx tests/discovery-cockpit-depth.test.ts tests/discovery-enrollment-optional-email-migration.test.ts tests/discovery-frequency.test.ts tests/discovery-heat-flow.test.ts tests/discovery-heat-styling.test.ts tests/discovery-intake-item-image.test.tsx tests/discovery-middleware-gate.test.ts tests/discovery-participant-routing.test.ts tests/discovery-product-label.test.ts tests/discovery-products-loading.test.tsx tests/discovery-quiz-answers.test.ts tests/discovery-quiz-identity.test.ts tests/discovery-reconcile.test.ts tests/discovery-refined-usage.test.ts tests/discovery-runsheet-locked-in-dom.test.tsx tests/discovery-search-sheet-props.test.tsx tests/discovery-swap-sort.test.ts tests/discovery-unanswered-categories.test.tsx tests/discovery-call-toolkit-sql-execution.test.ts
```

Each focused command should select exactly one keeper. A focused process must be bounded/cleaned by the main operator; no permissive pass on zero selection. Source faults only after full tool review and approval within main.

## C1

```sh
node --import ./tests/server-only-register.cjs --import tsx --test --test-name-pattern='^the\ loading\ screen\ reuses\ the\ real\ screen'"'"'s\ layout\ classes\ and\ has\ no\ controls$' tests/discovery-products-loading.test.tsx
```

Owner: `src/app/beratung/produkte/loading.tsx`; transfer/cut first assertion lines: 55/47. Expected ERR_ASSERTION / deepStrictEqual.

## C2

```sh
node --import ./tests/server-only-register.cjs --import tsx --test --test-name-pattern='^R28:\ „Neu\ dazu“\ steps\ say\ Essenziell\ /\ Optional\ with\ the\ step'"'"'s\ benefit,\ pronoun\-free$' tests/discovery-cockpit-complexity-dom.test.tsx
```

Owner: `src/components/discovery/cockpit/discovery-call-cockpit.tsx`; transfer/cut first assertion lines: 281/281. Expected ERR_ASSERTION / ==.

## C3

```sh
node --import ./tests/server-only-register.cjs --import tsx --test --test-name-pattern='^R28:\ a\ click\ saves\ \{complexity\}\ to\ the\ call\ sheet\ at\ once;\ a\ refusal\ rolls\ back\ with\ a\ line$' tests/discovery-cockpit-complexity-dom.test.tsx
```

Owner: `src/components/discovery/cockpit/discovery-call-cockpit.tsx`; transfer/cut first assertion lines: 212/212. Expected ERR_ASSERTION / ==.

## C4

```sh
node --import ./tests/server-only-register.cjs --import tsx --test --test-name-pattern='^batch\ 9:\ the\ legacy\ fixture'"'"'s\ third\ oil\ joins\ the\ first\ oil\ step\ —\ its\ hash\ moves\ on\ purpose$' tests/discovery-refined-usage.test.ts
```

Owner: `src/lib/discovery/refined-routine.ts`; transfer/cut first assertion lines: 218/218. Expected ERR_ASSERTION / ==.

## C5

```sh
node --import ./tests/server-only-register.cjs --import tsx --test --test-name-pattern='^a\ submitted\ intake'"'"'s\ untouched\ step\ says\ so\ at\ the\ step\ —\ never\ „benutzt\ nichts“$' tests/discovery-unanswered-categories.test.tsx
```

Owner: `src/app/admin/beratung/[enrollmentId]/page.tsx`; transfer/cut first assertion lines: 286/286. Expected ERR_ASSERTION / ==.
