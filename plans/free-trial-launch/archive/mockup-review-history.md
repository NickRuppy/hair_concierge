# Trial offer comparison

Commercial update, 12 September: Nick confirms seven-day trials for both monthly and annual plans. Earlier notes that monthly trial availability is provisional are superseded. EUR 9.99 monthly pricing and final quarterly exclusion remain to confirm. The locked annual-selected visual is unchanged; the eventual monthly-selected state must disclose its own seven-day trial and recurring monthly amount.

## Locked design

Nick locked the final design including the corrected scanner image on 12 September 2026. Canonical files: `cal-ai.html`, `scanner-hero.webp`, `cal-ai-mobile-scanner.png`; review URL: <http://localhost:8769/mobile.html>. Preserve this layout and asset for implementation. Earlier layouts/photos and any pending offer-review notes below are superseded. The visual lock does not settle the separately documented provisional monthly commercial terms or downstream lifecycle decisions.

Approved-layout image correction: `cal-ai.html` now uses the previously generated scanner image, copied unchanged from `.worktrees/scanner-funnel/public/images/funnels/scan/regal-scan-flasche.webp` to `scanner-hero.webp`. Nick specifically requested that earlier scanner asset. Current visual evidence is `cal-ai-mobile-scanner.png`, checked at 390×844. Preserve the layout and this asset choice in the implementation handoff; the previous product-shopping/chat photo is superseded.

**Approved offer design:** Nick approved `cal-ai.html` / `cal-ai-mobile.png` on 12 September 2026 (“Excellent. That looks good.”). This is the chosen mobile visual direction. Earlier pending-review notes for this variant are superseded. Monthly commercial terms and the downstream customer journey still require decisions; the artifact remains a static design preview.

Latest requested variant: `cal-ai.html`, shown by <http://localhost:8769/mobile.html>. Nick explicitly requested mirroring the captured Cal AI paywall. This variant follows its image → bold trial headline → annual trial strip/selected row → secondary monthly row → rounded CTA → small terms hierarchy, removing the separate plan-choice instruction. Uses the existing project `public/images/offer/products.jpg`, copied unchanged as `cal-ai-product-visual.jpg`; the image shows existing Chaarlie product guidance, not a verified current scanner UI. Annual EUR 69.99 first-year / EUR 99.99 renewal remains confirmed; monthly EUR 9.99 and its trial remain provisional. The rounded 42% first-year saving depends on that provisional monthly price. Static preview only. Captured `cal-ai-mobile.png`; checked 390×844 and 360×740 without horizontal overflow, CTA visible in both. Nick's review of this variant is pending; `draft.html` remains the preceding proposal.

Focused plan-framing comparison: <http://localhost:8769/selection-comparison.html> places the archived Cal AI plan picker, Headway offer, Blinkist offer and current compact Chaarlie mobile screenshot side by side. Describes visible choices versus secondary alternatives and how each connects free days to later billing. Four images verified loaded and visually inspected; retained `selection-comparison.png`. Proposed quieter label “Dein Abo nach der Testphase” is a recommendation only; no draft wording change made in this comparison pass.

Mobile review entry: <http://localhost:8769/mobile.html> fixes the preview at 390 × 844 px even in a wide browser. The embedded view hides review-only chrome. Following Nick's mobile-first feedback, the illustration is now a compact horizontal preview at mobile widths, preserving text sizes and plan styling. Verified at 390px: no horizontal overflow; the trial CTA ends at approximately 697px, within the 844px viewport. Current capture: `draft-mobile-compact.png`. Desktop retains the existing illustration size. Visual review remains pending.

Current revision: **one page, one CTA** in `draft.html`, following Nick's correction on 12 September. Bridge: “Wähle jetzt dein Abo für die Zeit nach den 7 Gratistagen.” Preserves the approved type treatment and card styling, with shared header/footer and responsive columns. Current captures: `draft-one-page-desktop.png`, `draft-one-page-mobile.png`; desktop and 390px mobile visually checked, no horizontal overflow, one trial CTA. `draft-two-screens.html`, `draft-desktop.png` and `draft-mobile.png` preserve the superseded two-screen proposal. Plan rows/checkout remain static and monthly terms remain provisional.

Latest Chaarlie draft (12 September): [draft.html](draft.html), served at <http://localhost:8769/draft.html>. Nick accepted the trial-first proposal; this is its first rendered two-screen layout. The first CTA links to the second frame. Plan selection and checkout remain static. Desktop/mobile evidence: `draft-desktop.png`, `draft-mobile.png`; mobile checked at 390px without horizontal overflow. This supersedes `index.html` as the current proposal. Shorter-plan terms remain provisional; final design review and journey sign-off are pending.

Latest feedback: Nick prefers a trial invitation with concise product value, followed by subscription choice. Revision 2 below is historical layout evidence to revise, not an approved hierarchy. `references.html` compares five actual public archived Cal AI / Headway / Blinkist screens with sources and adoption notes. All five images were visually inspected and verified loaded in Chrome on 11 September 2026; `references-reviewed.png` retains the gallery capture. The gallery loads remote originals and includes direct source links; its prices are historical reference content. RiseGuide's full paywall was not accessible and is not claimed as visually reviewed.

Planning evidence only, revised 11 September 2026 after Nick rejected the first version as too text-heavy. Visual review of revision 2 and final selection pending.

Current evidence: `a-mobile-v2.png`, `b-mobile-v2.png`, `c-mobile-v2.png`, `c-desktop-v2.png`. Unsuffixed proposed screenshots below are historical, superseded evidence. The current `index.html` removes the timeline, authorization explanation, repeated trial copy, separate zero-price block and first-year launch banner. It compares monthly equivalents at the same visual weight, retains the annual total on its card, and consolidates renewal information below the CTA. Supporting copy is 12px. Revision 2 was checked on mobile and C desktop; only planning artifacts changed.

Open `index.html` directly, or serve this directory locally. Current preview: <http://localhost:8769/?variant=c&view=mobile>.

Use the review bar to compare A (monthly/annual), B (monthly/quarterly/annual), and C (Cal AI-inspired annual emphasis). Desktop and 390px mobile framing are available. Product plan rows and checkout button are static: only the review controls work.

## Source and scope

The existing offer was inspected in this worktree's development harness, with the membership arm and launch pricing. `current-offer.png` captures its pricing section. Relevant production sources: `src/components/quiz/result-offer-pricing.tsx`, `src/components/personal-plan-offer/personal-plan-offer.tsx`, `src/lib/stripe/pricing-plans.ts`, and `src/app/globals.css`. These are recreations of the pricing section, not a redesigned full information page. System serif/sans fonts approximate the product typography.

Cal AI inspiration follows the dated offer capture and experimentation research linked in the parent plan. It adapts annual preselection, stronger annual hierarchy, trial framing and a monthly-equivalent comparison. It does not claim to reproduce Cal AI's current checkout or prove a conversion gain.

## Confirmed and provisional

- Confirmed annual schedule: seven days free, EUR 69.99 for the first paid year, then EUR 99.99/year. Cancellation before trial expiry stops the charge while preserving access through original expiry.
- Provisional shorter-plan values: EUR 9.99/month and EUR 19.99/quarter, drawn from the current launch catalog. Continuing these for the new cohort is not confirmed.
- Seven-day trials on shorter plans are an explicit comparison assumption, not a confirmed rule.
- Annual preselection, the exact visual hierarchy and number of alternatives await review. General annual emphasis with a shorter alternative is accepted.
- Revision 2: 42% first-year saving is rounded from 1 - 69.99 / (9.99 × 12), comparing the annual launch year to twelve provisional monthly payments. EUR 5.83/month is the rounded equivalent of the first paid year, not monthly billing. Recompute the claim if the monthly price changes.
- No fabricated time limit, popularity claim or unconfirmed reminder promise.

## Verification and retained artifacts

- `a-mobile.png`, `b-mobile.png`, `c-mobile.png`: reviewed at a real 390px browser viewport. C is cropped to the product surface; A/B retain the review assumptions banner.
- `a-desktop.png`, `b-desktop.png`, `c-desktop.png`: reviewed in the default desktop viewport with review controls visible.
- C viewport check: document client width and scroll width both 390px.
- Captured through Chrome browser tooling. Temporary viewport override reset after review.
- No payment actions, account creation, provider mutation or application-code changes.

These artifacts resolve offer hierarchy only. Other lifecycle states require separate mockups after their product decisions are settled. Browser review is not production checkout verification.
