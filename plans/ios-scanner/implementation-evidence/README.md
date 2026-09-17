# Native implementation evidence — 2026-09-12

These are screenshots of the actual SwiftUI implementation on the designated iPhone17Pro / iOS26.5 simulator. They supplement the untouched approved planning evidence; they do not replace it or approve later release scope.

- `cold-link-profile.png`: saved synthetic detailed-account answers after a real captured local email link opened the previously terminated app. The link was passed privately through `simctl openurl`; no credential appears in this image.
- `public-packshot-fixture.png`: native HTTPS image-loading proof using one public catalog packshot in the explicit UI fixture. Its assessment, comparison, price and alternatives are synthetic. This image is not evidence of that real product's suitability.
- `connected-assessment.png` and `connected-alternatives.png`: real local auth/context/catalog HTTP flow using the synthetic Shampoo publication fixtures, including the final comparison label widths.
- `assessment-explanation.png`: the same production SwiftUI component rendered with the shared nonpersonal contract fixture, showing the explanation above the unobscured comparison rows.
- `large-text-rows.png`: largest accessibility text size, vertically labeled comparison values, and omitted main purchase footer when its link is absent.

## Position correction after Nick's walkthrough

The earlier above-table placement in `assessment-explanation.png` and the initial qualitative review below are historical. Nick's explicit correction supersedes that placement only: the result sheet stays fixed and the explanation is centered over the dimmed screen. See [correction and verification](../info-position-correction.md).

- `info-position-before.png`: Nick's supplied original screenshot.
- `info-position-preview.html`: focused position mockup.
- `info-position-after.png` / `info-position-alternative.png`: final main and alternative UI-test captures.
- `info-position-large-text.png`: constrained long content scrolled to the last values at Accessibility XXXL.
- `info-position-connected.png`: final real local synthetic Conditioner flow, left open for Nick.

## Initial simulated-user review

Lens: Lea, a nonexpert first-time scanner user. Review adapted from `simulated-user-review` to the native app, with real UI interaction and rendered screenshots. The approved scanner and connected walkthrough are the reference.

The scan fallback names the unavailable camera and provides a direct product-search action. Results identify product and brand, state the verdict, retain all comparison rows and provide explanations without covering those rows. Alternatives remain readable and expose their own assessment and purchase action. Profile labels distinguish hair pattern, diameter and saved answers. Login-link account-switch confirmation explains the logout and preserves the current account on decline. No save, editing or research-success affordance is implied in this development build.

The connected Shampoo capture revealed broken final-letter wrapping in the first label column; the final68pt column fixes that in both main and alternative tables. Largest text remains scrollable, with explicit product/target labels rather than hidden columns. Some long German compounds still wrap at very large sizes; no essential value was clipped in inspected states.

XCTest checked comparison row and product-specific shop accessibility labels and ran the element-detection, sufficient-description and trait audits. That is semantic accessibility evidence, not a complete VoiceOver traversal. External Safari foreground and return to the existing assessment were observed; the synthetic shop destination is not a working merchant checkout. Physical camera capture/denial, iOS18 runtime and public-release networking/signing/Universal Links remain unverified.

See [verification receipt](../verification-receipt.md) for the exact checked tree, commands and limitations.


## Approved glossary card — 2026-09-12

The new [glossary specification](../explanation-card-spec.md) supersedes earlier card bodies. All screenshots here use synthetic local fixture data. Main compared the native render to the supplied `runde3-liste-final.png`: title/definition/list hierarchy, white rounded card, close circle, equal rows, separators, graded ordered rail and flat unordered rail match the supplied contract. The original result table remains behind the card.

- [Repair](glossary-repair.png): exact three meanings, graded rail,66pt equal rows.
- [Reinigung](glossary-cleansing.png): mixed text lengths with66pt equal rows.
- [Kopfhaut](glossary-scalp.png): all six meanings,118pt label column, flat outlined dots,51.333pt equal rows. This content fits naturally on the402pt simulator; it does not require artificial scrolling.
- [Hitzeschutz](glossary-heat.png):64pt label column, both rows48pt, flat rail and compact natural height.
- [Pflegerichtung](glossary-care-direction.png): categorical authority keeps the rail flat. The exact92pt column allows the supplied longer label to wrap; no copy or font-size substitution was introduced.
- [Largest text open](glossary-largest-text-open.png) and [scrolled to final entry](glossary-largest-text-scrolled.png): bounded internal scroll, stacked labels/meanings, pinned title and reachable close.
- [Reduce Motion](glossary-reduce-motion.png): same final geometry using the no-animation path.

Full VoiceOver traversal and a physical-device/iOS18 run remain unverified. AX labels and geometry were tested; screenshot inspection is not a claim of those broader checks.

[Final connected Repair card](glossary-connected-repair.png): the rebuilt app was relaunched without fixture arguments, restored the existing synthetic account, searched `Chaarlie Local` over real local HTTP, resolved `Leichter Conditioner`, and opened Repair-Pflege. Main inspected this final card and left it foreground in the designated simulator. Next3218 and the isolated stack remain available.
