# Live regular-quiz missing-relation protection

Whole648 coverage exposed a real lost execution path: `isMissingRegularQuizFieldTestRelation` still serves the live enrollment fallback. The deleted internal-owner helper test had incidentally covered it; ordinary personal-plan missing-relation tests returned before the regular-quiz query.

One boundary registration was reintroduced into the existing enrollment test harness. It reaches the regular-quiz query with actual42P01 missing-table error, requires a successful ordinary fallback and the complete expected enrollment result. This adds one registration/input/owner invocation explicitly as a coverage repair, not pruning credit. Net campaign removals decrease648→647. No production seam or behavior change.

Full enrollment suite23 before→24 after passes; formatted24 passes, zero skips/failures/cancellations. Setting the actual regular relation classifier to false yields the intended ERR_ASSERTION / doesNotReject with the complete missing-relation message at first outer enrollment496:3. Clean1→intended red1→byte-exact source restoration→clean1 passes. Canonical source mode644 checked separately. Root read the complete fault TAP. Formatting preserves the test AST.

26 indexed artifacts111,897 bytes; index SHA2565600f87dbe9de8be4888ad51946fdc33b7db1e75ced1b5dae6d5f76e18d44e3d. This receipt is post-index. Whole-tree coverage after this repair remains pending; prior648 coverage is diagnostic history.
