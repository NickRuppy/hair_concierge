# Scanner funnel comparison preview

Open `index.html` or serve this directory with `python3 -m http.server 8793 --bind 127.0.0.1` and visit http://127.0.0.1:8793.

Eleven views compare the opening, personal context, scanner proof, pricing, unknown products, footer, mobile controls, quiz examples, trial handover, integration/events, and full offers. Both mobile frames are independently scrollable. Plan selectors, quiz navigation, the sample scan and customer video work locally.

## Sources and adapters

- Nick: merged #534 with #536 assets, pinned main `5a3e33f1f641a8693209017ad25c4c9c69870df2`.
- Jonas: #535 `d7de91a02a5435a031b233b27a7444bcd0592f1d`, including the Steffi video.
- Offer HTML is rendered from the actual source components. Nick's three scanner quiz inserts use a fixed answer fixture; Jonas's quiz uses his original `docs/scanner-offer/mockups/quiz-scanner-flow.html`.
- `sources.json` records the fixture and revisions. `build.cjs` reproduces the source render using dependencies from the primary checkout. Run it with Node from this task worktree.
- This is a static comparison, not a running Next application. Images use native image tags. Source hooks, tracking, checkout, registration, navigation and messaging are not hydrated. Local adapters supply section isolation, plan switches, demo navigation and bottom CTA visibility. Nick's animated hero is frozen at its rendered example result. Quiz button/bottom-action wrappers are simplified. Fonts load from Google Fonts.
- Pricing uses the actual shared selector with selectable launch/standard catalog fixtures. This does not establish which live catalog a particular visitor receives. The separate trial plan is explicitly a textual future-plan comparison, not current checkout.
- The original copy and known discrepancies remain visible. In particular, Jonas's result-image/explanation mismatch, unknown-product promise and trial terms have not been silently corrected.
- The comparison is planning evidence. No preferred version, merged design or journey sign-off is recorded.

## Verification

Rendered both source trees successfully. Browser-inspected opening, pricing, quiz, proof/media, mobile CTA positioning and footer. Checked both plan selectors and quiz controls. Original scanner images loaded and the 29.6-second Steffi video loaded. Static JavaScript syntax checks passed. No application test suite or live billing/analytics verification was run for this preview.

## Combined landing draft

The 14 September follow-up is `combined-landing-preview.html` (review frame) and `combined-landing.html` (standalone). The current revision keeps only Jonas’s direct landing and fills the mobile viewport; Nick rejected the earlier added steps/benefits. See `../landing-draft.md` for the current decision record. `jonas-original-quiz.html` is the unmodified original for comparing mobile proportions.

## Current direction: ad visitors start directly in the quiz

`quiz-entry-preview.html` and `quiz-entry.html` supersede the standalone landing drafts for this ad journey. `build-quiz-entry.cjs` renders the actual current first question; `quiz-entry-source.json` pins its source and image assets. The new short explainer and header are proposed mockup content, and navigation/info/selection are local preview adapters. Answers are not submitted or saved. First-question back is hidden in this fresh-entry draft. Existing quiz content and all four source images are retained. Browser-inspected at 406 × 850, including selection feedback; JavaScript syntax checked. Nick approved this composition on 2026-09-14; see `quiz-entry-approval.json` for the acknowledgement and frozen content hashes.

## Next review: quiz progress and feedback

`quiz-progress-preview.html` compares the same second question side by side. The current version is rendered from `09799e227d36ce38103eaf04ebfe71248ab132fe` with a prior wavy-hair answer; `quiz-progress-source.json` records its adapters. Jonas’s view is taken from the original PR #535 quiz mockup, with presentation chrome hidden and automatic advancement paused so its criterion check and answer toast remain reviewable. Both versions retain their own question and answer presentation. Selection is local, and nothing is submitted or saved. Browser-inspected side by side, including Jonas’s criterion completion feedback. Decision closed on 2026-09-14: after speaking with Jonas, Nick chose to keep the current live quiz pages exactly as they are. Jonas’s criteria indicators and completion feedback are not adopted. The previously approved first-question explainer remains selected. This comparison is retained as decision evidence.

## Organic offer → scanner result draft

`result-draft-preview.html` compares the organic source opening and `result-scanner-draft.html`. `build-result-draft.cjs` renders the source component and uses its existing assessment logic. Three diagnostic card blocks are identical across both views. The proposed heading, video and scanner bridge are marked in the review shell; the video is provisional. `result-draft-source.json` records source commit and fictional answer fixture. Review pending.

### Result draft revision 2
Profile and diagnostics now precede the scanner explanation; Jonas’s exact Steffi video sits immediately above pricing. Existing scanner-offer product-tour cards follow pricing. Floating WhatsApp and checkout open local preview dialogs. Trial display follows the separate plan revision 1.6. The source Wistia video remains only in the organic comparison column. Browser playback, plan selection and WhatsApp dialog were checked; no live or conversion test occurred. `result-scanner-sections.html` and `result-scanner-interactions.js` are the new presentation fragments.

### Outcome and proof additions
A concise outcome block now follows the result example. The customer video remains adjacent to pricing. Three verbatim testimonials from the current scanner offer and five short FAQ accordions follow the benefits. There is one floating contact button. Production screenshot capture is still pending login.


### Current mobile revision — 14 September
`scanner-mobile-polish.css` scopes the current draft to a centered mobile layout. A three-row timeline sits immediately above plan selection, with day-five reminder copy reflecting Nick's latest direction. Actual email delivery remains unimplemented in this preview. Pricing prose is reduced; annual/monthly terms follow separate trial plan revision 1.6. Jonas's verbatim customer quotes appear in compact stacked cards. Pricing and testimonials were browser-inspected at 390px and 320px, including monthly terms and FAQ expansion. Source diagnostic cards and approved quiz-entry hashes are unchanged. `outcome-mobile-preview.html?area=pricing` opens the relevant mobile area; `full-draft-comparison.html` retains both complete pages. Actual production result capture remains blocked by login, visibly marked in the phone frame.


### Revision 11 corrections
Removed the three numbered scan-explanation boxes and decorative quote glyphs. Centered outcome/check/video headings with equal gutters and balanced text at 390px and 320px. Day 7 now reads “Dein Abo startet – weiter voller Zugriff.” Customer quotes, pricing disclosures and diagnostic source content are retained. Real production capture is assigned to a separately requested task with Nick's explicit test-account authorization; the placeholder will be replaced only by a genuine captured result.


### Real screenshot integrated (revision 12)
The phone placeholder is replaced with `images/production/ogx-production-scan-390x844.jpg`, an unchanged real production result opened from an existing test account's saved product. Product photo and qualified 2/3 result are visible. See adjacent `provenance.md` for profile and action scope. The frame fits 390px and 320px. No new user/profile or provider change was needed.


### Locked baseline and revised proposal
`refinement-comparison.html` pairs self-contained `locked-v12/` with `proposed-v13/`. The baseline manifest freezes all local dependencies. The right column adds the six UX refinements; subtitles are a locally transcribed timed draft requiring a final listening check. Review header contact placement, scan enlargement and the video via section jumps at390/320px. Original draft remains untouched.
