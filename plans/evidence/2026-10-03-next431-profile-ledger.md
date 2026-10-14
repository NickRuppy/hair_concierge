# Profile Haar-Check / Verfeinerung lock — complete 20-site ledger

Read-only at `21e0e41f`; complete test and fixture body read of `tests/profile-haarcheck-verfeinerung-lock.test.tsx` (20 declarations), component owners `haar-check-edit-control.tsx`, `memory-toggle-control.tsx`, `verfeinerung-teaser.tsx`, and page/layout caller anchors `profile/page.tsx:1220,1246,2073`, `profile/layout.tsx`. History: F1/F3/F5 introduced in `bad594d6`; page remains current through `3abfe00a`. No runners/edits.

## C1 ready: consolidate the free Haar-Check render union

**Delete declarations:** `:80` sibling/tree inventory and `:110` accessible Premium name. **Transfer into retained:** `:97` rendered free-tier markup, with the same exact input `<HaarCheckEditControl tier="free" onEdit={() => {}} />`.

Required retained assertions after transfer (all execute against real markup):
- wrapper opens as `<span` with both `relative` and `inline-flex` classes;
- exactly one `<button`, labelled text `Haar-Check bearbeiten`, and `aria-label="Haar-Check bearbeiten — Premium"`;
- `data-profile-lock-badge="true"` is present;
- button close exists and lock SVG opens after it (current F1 assertion).

This retains all behavioral/visible observations from :80/:110 while deliberately dropping only private React-component identity checks (`root.type === "span"`, `Button`, `ProfileLockBadge`) and direct-child array inspection. Fault controls: moving badge inside button fails SVG-after-close; removing wrapper positioning/classes fails wrapper checks; losing/changing visible label or Premium aria label fails markup checks; omitting badge fails data attribute. No new input/case. `:126` separately keeps `onEdit` invocation for both tiers; :117 retains premium bare-control compatibility. Native control if main applies: `node --import ./tests/server-only-register.cjs --import tsx --test tests/profile-haarcheck-verfeinerung-lock.test.tsx` (not run).

## R18

|Lines|Independent failure protected|
|---|---|
|49,58|Teaser’s non-degrading German promise and its visible/accessible unlock CTA/badge.|
|68|Shared badge remains decorative, pointer-safe and corner-positioned; neither control test proves standalone badge behavior.|
|117,126|Premium has no wrapper/aria regression; both tiers still invoke the sole page choke point.|
|149|Page passes server-resolved tier and `startQuizEditing`; component tests cannot prove caller wiring.|
|158,190|Free memory blocks PATCH and opens Premium while premium preserves functional switch; distinct state/side-effect contract.|
|211,222|Memory caller receives correct gate source and page never lies `Aktiv` to free users.|
|238,249|Named gate context attribution and registered approved feature copy.|
|259|Tier return precedes editing state change; page-level security/UX choke point.|
|276|Free teaser is additive and premium hair-profile conditional remains live; source wiring regression.|
|288|One mounted PremiumSheet with PayPal-return fallback avoids wrong-gate recovery.|
|300,308|Client does not recompute entitlement; layout uses server route-agnostic loader/provider shared with scan.|

Result: **R18 / C2 / D0 / F0**. C2 means two existing declarations removed after assertion union, not a new test or source closure.
