> Superseded on 2026-10-13: Nick selected the existing Research Lab instead. This cockpit mockup was never approved and is retained only as historical planning evidence. Use intake-integration-lab-review-v0.1.md and the current chosen plan.

# Oil intake review planning evidence

Local self-contained preview: [open HTML](intake-integration-review-preview-v0.1.html).

This is a planning artifact, not a working review application or approval. It embeds the current cockpit `globals.css` and retains the existing properties, summary, comment/rework, artifact, and CLI-handoff layout. Images, queue details, and unrelated operational sections are omitted to keep the oil decision visible. No external resources or backend requests are used.

## Concrete journey

1. Review `product_oil_specs.weight = medium`, `role_support = ["dry_finish"]`, and `provides_heat_protection = false` alongside the always-visible Rahua provisional estimate caveat.
2. Review matching suggestions as drafts. The example normal/coarse rows are illustrative UI content, not new product rulings or approved catalog tags.
3. Use the existing **Eigenschaften passen** action to approve the current properties and suggestions together. For corrections, use the existing field-path comment and **Rework product** flow; no new matching editor or approval stage is proposed.
4. After changed research or matching, the previous approval no longer applies. The preview selector also shows the rejection message for a concurrent change during approval.
5. The final handoff remains the separately authorized CLI path. The complete historical H04 research envelope is available in the existing research artifact section; it is evidence for the preview, not a freshly bound intake envelope.

The preview's state selector and simulated buttons are demonstration controls only. They make no writes and do not implement production freshness guards. The later implementation must bind approval and handoff validation to the current persisted oil research and matching revision, as specified in the integration plan.

## Verification

- HTML parser completed, element IDs are unique, and inline JavaScript passed Node syntax validation.
- Browser-use IAB bootstrap was attempted on 2026-10-13 but reported that no Codex IAB backend was discovered. Browser rendering, layout, interactions, and narrow-screen behavior were not visually verified; no screenshot is claimed.
- Current cockpit reference: `apps/product-intake-review/app/submissions/[submissionId]/page.tsx`, `submission-actions.tsx`, `review-property-rows.ts`, and `apps/product-intake-review/app/globals.css`.

## Deliberate choices

| Before | Proposed | Reason |
| --- | --- | --- |
| Oil singleton omitted from the readable property table | Show the three exact projected values | Make the actual proposed catalog facts reviewable |
| Rich oil data only discoverable in raw JSON | Keep JSON and expose estimate/manual-review caveats nearby | Avoid losing consequential context without building a new editor |
| A prior properties approval can remain visible after rework | Require review of the current oil revision; explain rejection/recovery | The existing approval action must refer to what Nick actually reviewed |

Matching draft approval is settled by Nick's answer: “Draft suggestions; I approve or correct them.” No additional product-policy choice is introduced by this preview.

## Parent browser verification

The browser-use IAB connection failed again in the parent, but the available Chrome connection rendered the mockup successfully. Parent visually inspected the normal desktop layout and exercised Entwurf prüfen → Eigenschaften bestätigt → Nach Rework erneut prüfen → Zwischenzeitlich geändert → Entwurf prüfen. The approval button disables after approval, re-enables after changed research, and the conflict state displays the explicit reload/review message while leaving publication disabled. Screenshots: [draft](intake-integration-review-preview-v0.1.png), [conflict](intake-integration-review-preview-v0.1-conflict.png). The local preview tab is retained for proposal review. This is mockup verification only; actual application, database freshness and narrow-screen implementation remain future checks.
