# Glossary card implementation

2026-09-12. Branch `codex/ios-connected-scanner`, base `469d41f5e81f44702c94829c0ed312e732b01172`, existing owned worktree. Scope: [supplied specification](explanation-card-spec.md) and [reviewed rendered reference](evidence/explanation-glossary/runde3-liste-final.png). No out-of-card product change.

Decision coverage: **confirmed**. Coverage acknowledgement: Nick explicitly requested “plans/ios-scanner/explanation-card-spec.md, I updated mockups here for the info boxes. Can you please check them and then let's implement those.” The coordinating session reviewed the current rendered glossary and passed the implementation instruction plus exact-copy/fallback resolution here on 2026-09-12. Main inspected the spec and rendered reference independently.

- Confirmed with Nick: glossary only, exact supplied definitions/meaning table, hierarchy and metrics; existing row→open→read→close journey with stationary result remains confirmed. Historical A/B/matrix proposals are superseded.
- Inherited from contract: actual backend axisKind/stop IDs/order; no effect/severity inference. Haardicke definition keeps the shown suffix. Missing bespoke meanings use the spec's label fallback; no invented Bondbuilder/reaction copy. Original result fields/table stay present.
- Implementation defaults: additive backend meaning; optional Swift meaning with nonblank label fallback for older payloads; distinct `plumScale` token preserves `plumIce`; adaptive native equal-height layout and accessibility grouping. Explicit axisKind wins over illustrative categories in the spec: a categorical care-direction payload stays ungraded.
- Open consequential assumptions: none. Existing out-of-card health/escalation/release questions stay parked; this change does not claim to resolve them.
- Undiscussed consequential assumptions affecting this handoff: none.

Outcome: title + definition + equal-height glossary entries for every stop, decorative connected points, no product/target/status/categoryFit/eyebrow/footer in the card. The current safe-area-centered anchor, 88% detent, 32% scrim, 180ms fade, Reduce Motion and bounded scrolling remain. Fixed reachable title/close survive long content.

Verification: focused backend mappings/schema/fallback and fixtures; old/new/blank Swift decoding; stop coverage and no comparison-only sentinel content; equal row geometry and minimum 48; repeated stationary opening/closing, Repair, six scalp rows, two heat rows, largest text/scroll and Reduce Motion. Final native screenshots compared to supplied render, then real local search/result/card reopened for Nick. Main owns integration, final verification and focused read-only counterpart review; no unrelated whole-suite reruns.

Execution slices: backend meanings/fixtures; native contract/layout; focused integration/UI verification; delta review and exact-content receipt. Stop before commit/push/PR/deploy/production access. Retain original evolving mockups and sanitized final evidence; transient reviewer output stays outside Git and is discarded after findings are recorded.


## Verification and retained evidence

Final backend mapping/schema/authority checks: **21 passed**, TypeScript and scoped ESLint clean. The four original missing-meaning assertions failed before implementation. Main also reproduced an unknown `future.weight` suffix acquiring authored copy on the prior adapter in an isolated temporary source; the final explicit known-axis guard passes that regression. Only string meanings are accepted from the lookup, so inherited object properties also use the label fallback. The glossary Repair fixture was corrected to the existing authority's amber result for high versus medium; no comparison semantics changed.

Native decoder/layout suite: **25 passed**. The per-axis UI test proves exact grouped labels, no comparison-only sentinel content, equal full-row accessibility bounds and stationary result frames. Repair and cleansing rows are66pt, scalp rows51.333pt, heat rows48pt on the designated402pt simulator. The initial new UI test exposed `ViewThatFits` propagating its body identifier onto short-card rows. Moving the identifier to the concrete scroller and assigning the complete row content shape resolved the issue; the final four-axis test passes.

Retained screenshots and final stationary/scroll regression result are recorded in [implementation-evidence/README.md](implementation-evidence/README.md) and the current [verification receipt](verification-receipt.md). Reviewer findings and disposition are in [review receipt](review-receipt.md). The latter two receipts carry the canonical final tree fingerprint.

Fallback inventory: `oil.role_support`, `bondbuilder.relationship`, criterion-only pass/caution/fail rows (including reaction/safety), unknown axes and unknown stops. These intentionally repeat their contract label instead of adding unreviewed explanations. Native nil/blank meanings also fall back to the label. Existing definitions, including the full Haardicke suffix, are preserved.

Final largest-text equality assertion passed: all three stacked rows386pt; the title stayed fixed and the final entry was reachable. Combined unique native delta coverage:25 unit and5 UI tests.
