# iOS design handoff

2026-09-12 · **Design evidence and connected journey confirmed by Nick.**

## Precedence

1. Latest confirmed scope/behavior in [implementation plan](implementation-plan.md) and [decisions](decisions.md): no native Merkliste, purchase-only actions, full alternatives, shared profile, web freemium disabled.
2. [Design specification](design-spec.md) plus [final definitions](copy-drafts.md): approved product identity, table, explanation card, carousel, tokens and copy. Latest copy supersedes text in old screenshots.
3. [Smart-scanner result](evidence/scan-ergebnis/smart-scanner.html): approved result appearance and CTA variants. The [embedded copy](evidence/scan-ergebnis/walkthrough-result.html) changes only preview integration, dismissal and simulated shop behavior.
4. [Connected walkthrough](evidence/walkthrough.html): approved navigation/entry/recovery relationship between screens; [record](evidence/walkthrough-README.md) declares fidelity limits. A prototype simplification never replaces an explicit source, security or persistence contract.
5. Earlier explorations and frames preserve design provenance only. Do not implement superseded save/routine/list buttons or old verdict wording. Web design notes are not an instruction to redesign the web app now.

## Screen-to-implementation map

| Surface / behavior | Reviewable evidence | Task | Acceptance |
|---|---|---|---|
| Existing login, code/link, expired/resend and profile-load recovery | [Login](evidence/walkthrough.html#login), [code](evidence/walkthrough.html#code), [failure](evidence/walkthrough.html#linkerror) | B1/T1 | Verified account, preserved destination, failed read offers retry; no repeated quiz for completed users |
| New-user regular quiz and email last | [Quiz](evidence/walkthrough.html#quiz), [email](evidence/walkthrough.html#email) | T1/T2 | All ten current questions plus conditional scalp/goals semantics; consent remains optional and gated by its legal/transport review |
| Camera, search, denied permission and offline retry | [Scan](evidence/walkthrough.html#scan), [search](evidence/walkthrough.html#search), [denied](evidence/walkthrough.html#denied), [offline](evidence/walkthrough.html#offline) | B2/B3/T3/T4 | Real native detection only when visible; preserve barcode on retry; no result replacement while sheet is open |
| Main sheet, product identity, immediate property/target table | [Result](evidence/scan-ergebnis/smart-scanner.html#result) | B3/T4 | Approved visual hierarchy, real product packshot/brand/name, factual deviation line, no hidden main criteria |
| Explanation and alternatives | [Explanation](evidence/scan-ergebnis/smart-scanner.html#explanation), [carousel](evidence/scan-ergebnis/smart-scanner.html#alternatives) | B2/B3/T3/T4 | Final definitions; full evaluated rows; max5 verdict/price order; no copied fixture conclusions |
| Kaufen and missing main link | [No link](evidence/scan-ergebnis/smart-scanner.html#no-link), [connected result/shop](evidence/walkthrough.html#result) | B3/T4 | Footer targets scanned product; card targets its own product; omit missing-link footer; return retains result; no implicit save |
| Missing personal target vs unknown product | [Unavailable](evidence/walkthrough.html#unavailable), [product category](evidence/walkthrough.html#unknown) | B2/T3 | D3 does not trigger research or follow-up quiz; missing product facts use category submission |
| Research + push/email and signed-out return | [Submitted](evidence/walkthrough.html#submitted), [notification](evidence/walkthrough.html#notification), [return login](evidence/walkthrough.html#notificationlogin) | T3/T5 | Public result readiness, per-channel delivery, current profile evaluation after login, no scan-history inbox |
| Profile, edits, save/retry/cancel, logout | [Answers](evidence/walkthrough.html#answers), [edit](evidence/walkthrough.html#edit), [save error](evidence/walkthrough.html#saveerror) | B4/T2/T6 | First milestone reads/logs out; full v1 edits atomically refresh both scanners without changing routines |
| Email change / deletion | [Email](evidence/walkthrough.html#changeemail), [deletion](evidence/walkthrough.html#delete) | T6 | Provider-confirmed identity change; durable cancellation/deletion; no success on pending request; policy-dependent work remains gated |

## Prototype exceptions

- Alternative cards reveal their own details on scroll; table rows open their explanations, Kaufen opens their shop. Card image/name do not open another detail page (design-spec section 4); older preview notes about “opening a card” are not a production interaction.
- All assessments and product data are fixed examples. Real results come from the shared authority, not HTML fixtures or the sample quiz choices.
- Simulated camera/email/shop/notification/deletion and debug navigation never become production buttons or shortcuts. Real code length, token expiry, deep-link and email-change mechanics follow validated provider contracts.
- The quiz prototype has static wavy-goal options and simplified scalp sub-answer display. Native must preserve the actual regular quiz’s conditional vocabulary, mutually exclusive selections, validation and all saved answers.
- Existing-account/new-quiz conflicts, real secure email confirmations, cancellation uncertainty and retained-data handling are governed by the explicit plan even where the prototype is schematic. Nick’s journey approval does not approve a policy period or skipped verification.
- Use the approved fonts/tokens and hierarchy in SwiftUI; bundle licensed fonts or resolve licensing before distribution. Native Dynamic Type and VoiceOver may expand row heights and text rather than copy fixed HTML clipping. Prototype screen zoom is not an accessibility decision.

## Artifact disposition

**Commit** the canonical plan/spec/copy, current prototypes, their required local CSS/JS/font assets, durable evidence records and original screenshots with the eventual PR. **Archive in place, clearly historical**, prior alternatives and superseded list/web interaction evidence; preserve the files, do not delete another agent’s design work. **Discard** transient raw reviewer logs and generated temporary scripts from `/tmp` after durable findings are captured; they are not PR content. Legal drafts remain working documents, not approved public copy.

The inventory below includes every current file in `evidence/` (including previous designs). Status is provenance, not an additional implementation scope.

| Artifact | Status / disposition |
|---|---|
| [assessment-refined.html](evidence/assessment-refined.html) | Historical provenance · archive in place; no independent native scope |
| [first-build-review.html](evidence/first-build-review.html) | Historical provenance · archive in place; no independent native scope |
| [five-assessment-directions.html](evidence/five-assessment-directions.html) | Historical provenance · archive in place; no independent native scope |
| [fonts/PlayfairDisplay-Regular.ttf](evidence/fonts/PlayfairDisplay-Regular.ttf) | Preview dependency / evidence configuration · commit |
| [fonts/PlusJakartaSans-Regular.ttf](evidence/fonts/PlusJakartaSans-Regular.ttf) | Preview dependency / evidence configuration · commit |
| [footer-pages-excerpts-review.html](evidence/footer-pages-excerpts-review.html) | Provisional legal layout · commit; policy approval pending |
| [footer-pages-review.html](evidence/footer-pages-review.html) | Provisional legal layout · commit; policy approval pending |
| [ios-flow-review.html](evidence/ios-flow-review.html) | Historical provenance · archive in place; no independent native scope |
| [ios-product-sheet-rich.html](evidence/ios-product-sheet-rich.html) | Historical provenance · archive in place; no independent native scope |
| [ios-scan-and-profile.html](evidence/ios-scan-and-profile.html) | Historical provenance · archive in place; no independent native scope |
| [mobile-polish.css](evidence/mobile-polish.css) | Preview dependency / evidence configuration · commit |
| [scan-ergebnis/.gitignore](evidence/scan-ergebnis/.gitignore) | Preview dependency / evidence configuration · commit |
| [scan-ergebnis/frames/00-produktion-heute.png](evidence/scan-ergebnis/frames/00-produktion-heute.png) | Historical provenance · archive in place; no independent native scope |
| [scan-ergebnis/frames/01-einschraenkung.png](evidence/scan-ergebnis/frames/01-einschraenkung.png) | Historical provenance · archive in place; no independent native scope |
| [scan-ergebnis/frames/02-erklaerung.png](evidence/scan-ergebnis/frames/02-erklaerung.png) | Historical provenance · archive in place; no independent native scope |
| [scan-ergebnis/frames/03-wohin.png](evidence/scan-ergebnis/frames/03-wohin.png) | Historical provenance · archive in place; no independent native scope |
| [scan-ergebnis/frames/04-chip.png](evidence/scan-ergebnis/frames/04-chip.png) | Historical provenance · archive in place; no independent native scope |
| [scan-ergebnis/frames/05-wohin-entfernen.png](evidence/scan-ergebnis/frames/05-wohin-entfernen.png) | Historical provenance · archive in place; no independent native scope |
| [scan-ergebnis/frames/06-alternativen.png](evidence/scan-ergebnis/frames/06-alternativen.png) | Historical provenance · archive in place; no independent native scope |
| [scan-ergebnis/frames/07-karte2.png](evidence/scan-ergebnis/frames/07-karte2.png) | Historical provenance · archive in place; no independent native scope |
| [scan-ergebnis/frames/08-passt-nicht.png](evidence/scan-ergebnis/frames/08-passt-nicht.png) | Historical provenance · archive in place; no independent native scope |
| [scan-ergebnis/frames/09-passt-nicht-alts.png](evidence/scan-ergebnis/frames/09-passt-nicht-alts.png) | Historical provenance · archive in place; no independent native scope |
| [scan-ergebnis/frames/10-passt.png](evidence/scan-ergebnis/frames/10-passt.png) | Historical provenance · archive in place; no independent native scope |
| [scan-ergebnis/frames/11-passt-ohne-alts.png](evidence/scan-ergebnis/frames/11-passt-ohne-alts.png) | Historical provenance · archive in place; no independent native scope |
| [scan-ergebnis/frames/12-kamera.png](evidence/scan-ergebnis/frames/12-kamera.png) | Historical provenance · archive in place; no independent native scope |
| [scan-ergebnis/frames/13-merkliste.png](evidence/scan-ergebnis/frames/13-merkliste.png) | Historical provenance · archive in place; no independent native scope |
| [scan-ergebnis/historisch-alternativen-optionen.html](evidence/scan-ergebnis/historisch-alternativen-optionen.html) | Historical provenance · archive in place; no independent native scope |
| [scan-ergebnis/historisch-copy-drafts.md](evidence/scan-ergebnis/historisch-copy-drafts.md) | Historical provenance · archive in place; no independent native scope |
| [scan-ergebnis/ios-abnahme.html](evidence/scan-ergebnis/ios-abnahme.html) | Historical provenance · archive in place; no independent native scope |
| [scan-ergebnis/merkliste.html](evidence/scan-ergebnis/merkliste.html) | Historical provenance · archive in place; no independent native scope |
| [scan-ergebnis/prototyp-README.md](evidence/scan-ergebnis/prototyp-README.md) | Historical provenance · archive in place; no independent native scope |
| [scan-ergebnis/prototyp.html](evidence/scan-ergebnis/prototyp.html) | Historical provenance · archive in place; no independent native scope |
| [scan-ergebnis/referenz.html](evidence/scan-ergebnis/referenz.html) | Historical provenance · archive in place; no independent native scope |
| [scan-ergebnis/smart-scanner-README.md](evidence/scan-ergebnis/smart-scanner-README.md) | Current approved evidence · commit |
| [scan-ergebnis/smart-scanner.html](evidence/scan-ergebnis/smart-scanner.html) | Current approved evidence · commit |
| [scan-ergebnis/walkthrough-result.html](evidence/scan-ergebnis/walkthrough-result.html) | Current approved evidence · commit |
| [walkthrough-README.md](evidence/walkthrough-README.md) | Current approved evidence · commit |
| [walkthrough.html](evidence/walkthrough.html) | Current approved evidence · commit |
| [web-alignment.css](evidence/web-alignment.css) | Preview dependency / evidence configuration · commit |
| [web-alignment.js](evidence/web-alignment.js) | Preview dependency / evidence configuration · commit |
