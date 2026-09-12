# Smart Scanner — review of the reduced actions

Date: 2026-09-11. Planning evidence; Nick approved this first-version scope and the reviewed mockups: “Okay yeah, that works. It's very basic in scope but as a first version it should be fine.”

Question: Does removing the save action preserve the approved sheet and alternative-card design, including clear purchase destinations and dismissal?
Shape: UI, direct adaptation of `ios-abnahme.html`; no new visual direction.
Decision criterion: Nick can inspect the result footer, alternative-card actions, unchanged explanation, and absent-shop-link state in the original design.
Disposition: retain this review copy as evidence; preserve the original approved mockup as historical reference. Reimplement production behavior separately.

Confirmed scope correction: no Merkliste in the first smart-scanner release. Keep full alternatives, tables, explanations, product identity and styling. Remove Hinzufügen and saved/remove sheets; retain Kaufen ↗ and the product-specific purchase destination. No new CTA copy proposed here.

Review states: `#result`, `#alternatives`, `#explanation`, `#good`, `#scalp`, `#no-link`. Desktop review navigation also switches states. Phone controls keep the original interactions. No camera or backend; purchase buttons display the specific fixture product, without opening a real shop. Fixture properties and schematic packshots are inherited illustrative data, not researched claims.

When a main product has no purchase URL, its entire empty footer is omitted. Alternatives retain their own shop actions. Nick approved this presentation while viewing the `#no-link` state on 2026-09-11.

Preview: http://127.0.0.1:8770/scan-ergebnis/smart-scanner.html#result

Verification: rendered result, scrolled alternatives, explanation and no-main-shop-link states inspected in the in-app browser. Purchase stubs independently confirmed Balea alternative versus scanned Olaplex identity. Original explanation positioning is inherited unchanged; this CTA pass is not a new full design/accessibility approval.
