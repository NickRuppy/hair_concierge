# Stage 4 stored portfolio validation oracle repair

The retained test `stored source snapshots fail closed instead of throwing on a legacy portfolio shape` used an invalid routine fixture: its plan/refined IDs failed the UUID schema and it omitted `createdAt`. The real parser validates the routine before the portfolio, so the original negative returned null without exercising the named portfolio guard.

The repair keeps the same declaration and legacy owned-product row. It supplies locally valid routine IDs and timestamp, aligns the portfolio IDs, and first checks that the actual parser accepts the complete valid snapshots. It then changes only the portfolio to the original legacy shape and requires null. Shared fixture state and all other cases remain unchanged. No test-count credit is taken; no runtime source is changed.

Main proved the previous false pass by bypassing only the actual `parseProposedProductPortfolio` call in `parseRoutineSourceBaseSnapshots`. The original test remained green before, during the fault, and after exact source restoration. With the repaired fixture and positive control, the same source fault produced an assertion failure: the invalid owned row was returned in an accepted snapshots object instead of null. The positive acceptance assertion passed first. Before and after runs passed, and the source SHA256 matched exactly after restoration.

Native source-sync file: 37 cases pass before and after, from 36 declaration sites (runtime expansion is not declaration credit). The seven-file Stage 4 sibling cohort runs after formatting. Receipts are `/tmp/test-audit-stage4-portfolio-{old,repaired}-receipt.json` and corresponding TAP files. Full coverage is part of the frozen 299 checkpoint.

This proves the stored-snapshot validator contract. It does not claim database execution, production traffic, provider delivery, or retirement of the dormant acquisition capability that its owning plan explicitly preserves.
