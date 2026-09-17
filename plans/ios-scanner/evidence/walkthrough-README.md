# Connected iOS walkthrough

2026-09-12. Question: does the connected approved journey, including entry and recovery, match Nick’s intended first public smart-scanner app? Shape: interactive UI. Criterion: Nick can complete the journey and explicitly confirm or correct it. Disposition: retain as planning evidence; rewrite through the production workflow. Journey sign-off confirmed by Nick on 2026-09-12 after reviewing the connected walkthrough.

Open `/walkthrough.html` on the evidence preview server (port 8770). Start with existing login or the ten-question regular quiz. The quiz options are a static copy of the planning worktree’s regular quiz source plus its separate scalp/goals components; illustrative choices are local only. Email/link, camera, shop, research, notifications, edits and deletion are simulated; no APIs, analytics, camera or production writes. Result assessments remain fixed fixtures and do not recompute from quiz selections.

The embedded `scan-ergebnis/walkthrough-result.html` derives directly from the approved `smart-scanner.html`. Result visual CSS/data/rendering is retained; embedding chrome, close navigation and an explicit shop preview are added. The approved source is unchanged. Surrounding entry/Profile/recovery screens reuse `ios-flow-review.html`, with the obsolete result and Merkliste routes removed.

This shows the public-v1 journey. First development milestone remains existing test login → scan → result → read-only Profile. New-user onboarding, editing and research are later milestones within that same public product. Privacy/retention decisions remain parked; account-management examples do not settle policy periods, legal copy or provider verification mechanics. No build or release approval is inferred from opening the prototype.

## Verification

Browser checks: existing login → code → simulated permission → scan → loading → embedded approved result; product-specific shop preview; result X → scanner; ten quiz steps plus scalp gate → email, with explicit multi-select continuation; unknown product → category → submitted; Profile edit entry. Inline scripts parse; `git diff --check` passes. The regular-quiz test reached Q9 before the browser tool’s 30-second cell limit; Q9/Q10/email were then verified individually. This was a tool timeout, not an application error.

Known fidelity limits: fixed result fixtures, schematic packshots, static wavy-goal options, simplified scalp sub-answer display, simulated account/email-change mechanics and permission dialogs. No real calculations or production workflows are proven. Existing approved result code is retained separately; no browser camera is started.

Run: `python3 -m http.server 8770 --bind 127.0.0.1 --directory plans/ios-scanner/evidence` from the planning worktree. The server is local-only.


## User acceptance — 2026-09-12

Nick reviewed the connected walkthrough (open at `#answers`) and said on 2026-09-12: “Okay I think we can start with this. Yeah sounds good. Can we do the implementation plan then, including all the designs that we had from before?” This confirms the connected journey and requests the finalized plan. Earlier result/CTA approvals remain in force. It does not approve parked policy details, fixed fixture assessments as domain truth, or production publication. See [final design handoff](../design-handoff.md) for precedence and exception handling.
