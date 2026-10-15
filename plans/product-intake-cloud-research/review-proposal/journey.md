# Proposed admin review journey

Decision requested: approve the concrete review/publication journey and its
presentation inside the existing admin navigation. This is design evidence,
not implemented production behavior. Product values/images are illustrative.
Counts reproduce the sanitized audit totals and include test/historical rows;
the implemented default queue must distinguish those with approved criteria.

1. An email arrives only when a product is ready or needs a human decision.
   It links to `/admin/produkt-intake/<submission>` after normal admin auth.
2. Queue “Produktprüfung” separates ready packages, human questions and technical
   errors. Detail opens the product identity, exact purchase variant, source
   links, engine/version, exact projected values and application instructions.
3. Nick checks properties/application and the three image renditions separately.
   Approvals belong to the exact payload revision and final asset hash.
4. “Zur Veröffentlichungsfreigabe” is enabled only with both approvals, no open
   blockers and passing server preflight. It opens a final confirmation naming
   the product/revision and the user-link/chat-notification effects.
5. Nick explicitly confirms. Successful catalog publication remains
   `user_submitted`, non-recommended. This does not approve global promotion.
6. A rework instruction invalidates old-version approvals and starts a bounded
   new research cycle. A concurrent new revision returns a reload/review message;
   a stale tab can never approve or publish the new result.
7. New-brand/identity questions require explicit human selection/creation.
   Infrastructure failures show a concrete retry action. If publication commits
   but notification fails, the recovery repeats notification only, never creates
   another product or reports a fully completed handoff prematurely.

Mobile uses the existing horizontal admin navigation and stacks the same cards;
all review facts, versions, approvals and final confirmation remain available.
The old loopback cockpit remains until this replacement passes end-to-end proof.

Evidence source: `src/app/admin/layout.tsx` navigation/shell and
`src/app/globals.css` color tokens; existing intake review and publication
contracts. Design specialist: interaction guidance from `design`/Emil; no new
motion system or visual identity. Static HTML is sufficient for this decision.

Approved by Nick in this chat on 2026-10-15: build the integrated admin review
center with separate data/image approvals and explicit per-product publication.
Central queue decision: Ready for review opens by default; decisions needed and
technical errors remain one tab away. The authenticated queue/detail read
increment is now implemented locally under `/admin/produkt-intake`; the actual
components are inspectable with fictional data at `/labs/produkt-intake`.
Private renditions, revision-bound actions and publication remain pending.
Implemented desktop/390px evidence: `admin-queue-implemented.png`,
`admin-detail-implemented.png`, `admin-mobile-implemented.png`. Production
headers correctly refuse iframe embedding; mobile proof uses the browser's
390px viewport override, then resets it. No header protection was weakened.
