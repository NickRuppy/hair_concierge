# Independent Stage 5 presentation preflight

## Integrity and scope

Reviewed the seven staged candidates only: C1–C6 and D1. Current hashes match every `before` hash in `/tmp/test-audit-stage5-presentation-manifest.json`:

- navigation test `19a486fd…`, route test `e8103ae2…`, view-adapter test `338ae1d5…`, loading-shell test `475285a4…`;
- all eleven listed owner hashes also match, including navigation access, nav view/shell, route/loading and application view/day/page.

The complete diff is limited to six callback removals, one exact duplicate route callback removal, and transfers into four pre-existing keeper callbacks. Manifest remains **59 → 59 → 52**. No test or source file has been changed or run in this review.

## Candidate verdicts

| Candidate | Verdict | Evidence and relevant predicate |
|---|---|---|
| C1 | Conditional support | Donor `navigation:102` invokes `toAuthenticatedAppNavigationAccess(personalPlanAccess(true,true))` with omitted visit state. Keeper `:36` includes the exact `(true,true)` loop row and deep-equals the full object, including `unvisitedNavSurfaces: new Set()`. `navigation-access.ts:104–128` has no additional branch for this donor. |
| C2 | Conditional support | Both produce navigation from the same omitted visit state and render `PersonalPlanNavigationView`. Donor pathname `/chat`, keeper `/anwendung/wash_day`; `data-nav-unvisited-dot` is guarded by `unvisitedNavSurfaces.has(item.key) && !active` in `personal-plan-navigation.tsx:164–170`. With the identical empty set, the first operand is false before pathname can matter. The transfer adds the donor’s exact no-dot assertion to keeper `:292`. |
| C3 | Conditional support | Donor’s custom fixed five items and keeper’s resolved fixed five items have the same key set; both use tier `premium`. `data-nav-lock-badge` depends only on `tier === "free"` plus fixed item key (`personal-plan-navigation.tsx:168–170`), not pathname or journey stage. Keeper receives the exact zero-lock assertion. |
| C4 | Conditional support | The keeper’s pre-existing `AuthenticatedAppShell` render supplies the same free tier and same five fixed item keys to the real `PersonalPlanNavigation` (`authenticated-app-shell.tsx:31–38`). Donor’s complete header/mobile/link/icon clauses move onto that existing HTML; no additional render or owner read is added. Donor pathname `/scan` versus shell’s hook pathname does not affect lock membership: only free tier + key is read. |
| C5 | Conditional support | Both callbacks set the identical nonstandard HTTPS image URL on both `productBlocks[0]` and the matching `outerSequence` product block before `toApplicationPageView` and `ApplicationPage`. Provisional status in keeper changes `data-application-shelf-slot`, but fallback treatment reads image URL/category only: `application-day-card.tsx:116–148`. The transferred fallback URL/no-silhouette assertions therefore retain the full donor image-owner union while keeper preserves its independent provisional hook clauses. |
| C6 | Conditional support, static only | Donor and navigation keeper read the same `src/app/anwendung/loading.tsx` bytes. The transfer preserves the donor’s two exact negatives (`/<Header/`, `/PersonalPlanNavigation/`) within the existing route-source loop. It adds no source read or runtime claim. Existing `/<Header\b/` was narrower, so retaining the donor’s exact broader regex is necessary and present in the staged diff. |
| D1 | Conditional support | Route donor `:248` and keeper `:215` have runtime-identical Stage 4 access object, four throwing privileged dependency observers, `{state:"feature_disabled"}`, and zero reads. The only differences are TypeScript `as const` / `as never` casts, erased at runtime. No source branch, fixture, callback or assertion is lost. |

## Retained F rows

The staged diff does not touch the seven F declarations: navigation source topology/cache, deferred-write receipt/failure, route diagnostic/default binding, and direct-day validation stay exactly intact. In particular, C6 does not purport to repair the Header topology F, and no pending actual route proof is replaced by a static transfer.

## Required proof and limits

The manifest and diff establish static preservation only. Before credit, main should pin the listed current hashes, require the staged AST counts and keeper bodies, and run the named owner faults/selected keepers. This review found no missing tier, pathname, status, route-frontier, or imagery predicate in the seven assertion unions. It makes no claim about browser hydration, request caching, or the retained F repairs.
