# Scanner funnel refinement plan

Revision 0.31 · 14 September 2026 · incremental visual review.

**Status: revision 20 visually approved and locked by Nick; revision 12 retained as the original comparison baseline.** Direct ad-to-quiz entry and its explainer are visually approved. The former standalone landing is superseded. Quiz pages retain their current live design and behavior, with only the already-approved first-question explainer. This plan records decisions as they are made. It is not yet an implementation or publication handoff.

**Current implementation planning:** [implementation handoff](implementation-handoff.md) is the consolidated source for the next application work. The sections and appendices below preserve the chronological design discussion; later decisions and the revision-20 lock supersede earlier alternatives. WhatsApp placeholder is now explicitly permitted by Nick.

## 1. Outcome and source context

Refine Nick’s existing live scanner funnel using selected elements from Jonas’s PR #535. Keep one integrated funnel and review each changed surface visually before implementation.

- Worktree: `.worktrees/scanner-funnel-consolidation`, branch `codex/scanner-funnel-consolidation`.
- Current root source checked: `09799e227d36ce38103eaf04ebfe71248ab132fe`; this task’s older worktree is a planning workspace, not the current implementation base.
- Jonas reference: #535, `d7de91a02a5435a031b233b27a7444bcd0592f1d`. PR is a design reference, not intended to be merged as a whole.
- [Initial comparison and findings](comparison.md). Its original preview is historical: current main already includes the legal footer and subsequent polish from #538/#542.
- Separate billing authority: `../free-trial-launch` worktree, `plans/free-trial-launch/plan.md` (revision 1.6 when last checked). Refresh that task before integration; this plan does not override its commercial decisions.

## 2. Chosen direction and decisions so far

| Area | Recorded decision | Review status |
| --- | --- | --- |
| Ad entry / landing | This scanner funnel targets ad traffic. Send those visitors directly to the first quiz question, with a brief explanation of why the scanner needs their hair profile. Remove the standalone landing step from this ad journey. | **Direction and shown mockup approved.** Nick: “Yeah I think that’s good. Let’s lock this in.” |
| Previous landing drafts | The full-screen Jonas landing and earlier combined design are superseded. Preserve them as historical evidence, not active implementation targets. | Superseded by Nick’s latest ad-only entry decision. |
| Quiz pages | Keep Nick’s current live quiz pages: questions, order, illustrated answers, progress display and answer feedback. Retain only the separately approved direct-entry explainer above question 1. Do not adopt Jonas’s criteria indicators or feedback. | **Locked.** Nick, after speaking with Jonas: “On the quiz pages we exactly keep them in my version or as they are right now online.” |
| Interactive example scan | Do not add Jonas’s tappable “Beispiel scannen” quiz screen. | **Explicitly excluded.** The standalone landing and its passive animation are superseded as well. |
| Result/offer page | Draft the opening using the existing organic Personal Plan offer: profile and assessment visualization first. Follow Jonas’s explanation order, then show his customer video directly above pricing; restore the four app-benefit cards below pricing. Add floating WhatsApp. Keep one combined result/offer page. | Nick requested this revised order on 14 September. Updated preview is ready; final rendered composition and journey remain pending approval. |
| Floating WhatsApp | Add it to the result/offer page. | Nick: “we need to add for sure.” Exact contact, message, placement and behavior pending. No landing placement inferred. |
| Additional mobile bottom CTA | Leave it out for now; retain existing sticky-header navigation. | Accepted in Nick’s “Yeah I think that sounds good” following this proposed scope. |
| Trial/pricing | Integrate through the existing separate trial work and shared payment module. Commercial terms remain owned there. | Latest direction: Nick now wants a timeline and a reminder email before the first charge. This supersedes the earlier no-timeline/no-optional-reminder preference for this scanner refinement; exact timing, delivery ownership and broader rollout scope still require reconciliation with the trial task. |

## 3. Scope and non-goals

Current authorized work: document decisions and create/revise reviewable previews, one part at a time. Application implementation, live provider changes, deployment, publication, merging #535 and sending messages to Jonas are not part of this planning pass.

Preserve the existing attribution/package identity, quiz persistence/back navigation, lead/account ownership, checkout authority and scanner continuation. No new quiz question, extra commitment step, new usage entitlement or support turnaround promise follows automatically from a mockup.

## 4. Target map

| Surface | Existing implementation / reference |
| --- | --- |
| Landing | `src/funnels/landing/scan-regal.tsx`; route-owned funnel shell/tracking stays authoritative. Jonas: `docs/scanner-offer/mockups/quiz-scanner-flow.html`, landing screen. |
| Quiz questions/progress | `src/components/quiz/quiz-question.tsx`, `quiz-progress-bar.tsx`, `quiz-option-card.tsx`; `src/lib/quiz/questions.ts`. Jonas mockup screens “Achsen” and “Fortschritt.” |
| Existing quiz inserts | `src/components/quiz/scan-inserts/`; preserve unless specifically reviewed. |
| Lead/reveal | `src/components/quiz/quiz-lead-capture.tsx`, `quiz-preparation.tsx`, `quiz-results.tsx`; verify exact rendered caller when this area is reviewed. |
| Result/offer | `src/components/scan-regal-offer/scan-regal-offer.tsx`, `scan-hero-demo.tsx`; shared result pricing slot. Jonas reference: `src/components/scanner-offer/scanner-offer.tsx`. |
| Footer and contact | `src/components/landing/site-footer.tsx`; inspect existing contact configuration when implementing the chosen WhatsApp entry. |

## 5. Decision coverage

**Overall: pending. Direct-entry visual evidence and retention of current live quiz pages: confirmed.**

- **Confirmed with Nick:** the decisions explicitly marked confirmed/accepted in section 2; review remaining parts in the same visual manner.
- **Inherited from evidence/contracts:** one existing paid scanner funnel; #535 is reference-only; current main already has the result footer; billing remains owned by its separate plan; mockup example products are not visitor-submitted products.
- **Implementation defaults:** continue documentation in this owned worktree; retain pinned original source; use local HTML evidence and inactive checkout/navigation controls.
- **Open consequential assumptions — resolve before handoff:** lead/reveal changes; final result explanation/video arrangement; WhatsApp destination/message/placement; direct-entry desktop/short-screen behavior; the ad destination URL and package attribution without a landing-page visit; first-entry versus resumed-quiz behavior and intro visibility; public legal/login navigation placement; final rollout scope. Each affects only its dependent implementation.
- No undiscussed item is silently approved or treated as an acknowledged parked decision. Rejected quiz demo and extra bottom CTA remain excluded.
- **Coverage acknowledgement:** Nick first approved the direct mobile landing with “good” on 14 September. He subsequently replaced that direction: ad visitors should start directly in the quiz, with a little explanation of why it is necessary. The former approval remains historical. Nick then reviewed the direct-entry mockup and said “Yeah I think that’s good. Let’s lock this in and then actually continue with the other parts.” This locks the shown entry design and explainer on 14 September; it does not imply implementation/publication or final whole-journey sign-off.
- **Quiz acknowledgement:** On 14 September, after discussing with Jonas, Nick explicitly chose to keep the quiz pages exactly as currently live. The focused progress comparison is closed with the current version retained. The prior first-question explainer approval remains in effect; no other quiz redesign is selected.
- **Internal revalidation:** current source and existing preview inspected on 14 September; all standalone landing variants are now superseded for the ad journey. Organic or other unrelated funnel entries are not implicitly removed. Refresh main and trial-plan state before implementation.

## 6. Designed user journey — current draft

1. A visitor follows the scanner ad and immediately sees question 1 of the existing quiz. No separate landing or “start quiz” screen precedes it.
2. A compact explanation above the first question says that product fit is checked against the visitor’s hair profile and indicates 10 questions / about 2 minutes. The source question and four answer images remain intact.
3. Selecting an answer continues through the existing quiz. Ad attribution/package identity must initialize without depending on a landing-page visit. Returning users, refresh, browser back and saved progress require explicit integration handling; do not reset a saved quiz as an incidental consequence of direct entry. The local draft only selects an answer and displays a preview notice.
4. Quiz pages continue exactly as currently live, including their progress display, illustrated answer cards and feedback. No criteria indicators or interactive example scan are inserted. Lead/reveal remains the next separate review area; no change to it is selected.
5. The existing result/offer page remains the destination. The revised draft orders profile and existing assessment, scanner explanation and example, Jonas’s video, shared trial pricing, and the four app benefits. Floating WhatsApp is present. Final composition is still pending.
6. Pricing, account continuation and post-checkout scanner access remain governed by their existing/shared contracts.

Final recovery-state walkthrough and whole-journey sign-off: **pending**, after the remaining visual decisions and counterpart plan review.

## 7. Planning evidence

- **Approved direct-entry mockup:** [mobile review view](preview/quiz-entry-preview.html), [standalone first question](preview/quiz-entry.html). Source and adapters are recorded in [quiz-entry-source.json](preview/quiz-entry-source.json).
- **New result-opening draft, pending review:** [side-by-side organic source and scanner draft](preview/result-draft-preview.html), [standalone scanner opening](preview/result-scanner-draft.html), [source and adapters](preview/result-draft-source.json). The three existing diagnostic cards are rendered from the current source with one fictional answer fixture; markup/copy/scores match the source view exactly. The expanded draft includes Jonas’s original Steffi video directly above a local trial-pricing preview, followed by source app-benefit cards and floating WhatsApp. Both checkout and WhatsApp open local preview dialogs.
- **Superseded landing evidence:** [previous full-screen mobile draft](preview/combined-landing-preview.html), [original Jonas mockup](preview/jonas-original-quiz.html), [landing receipt](landing-draft.md).
- [Historical side-by-side comparison](preview/index.html): useful reference, not a current-production snapshot.

Resolved entry question: how to explain the quiz’s purpose without adding a separate step for ad visitors. The new mockup uses the actual first QuizQuestion component from current main with empty answers, four source images and a small explanation above it. It hides the first-question back button in this fresh-entry view. Fonts/native image tags/info-tip and local selection are preview adapters; app navigation and tracking are not connected.

Browser evidence: inspected at 406 × 850, intro/question/images all visible, one source answer can be selected, and no separate start CTA is present. Nick has approved this revised visual evidence; other viewport/recovery checks remain implementation verification.

## 8. Ordered review and implementation preparation

1. **Direct ad-to-quiz entry — visual review complete.** Preserve the approved short explanation, first question and placement. Before handoff, resolve the campaign destination/package initialization, first-entry/resume/back semantics and public navigation. Verify direct entry retains attribution and does not reset existing drafts. The former standalone landing is no longer the target.
2. **Quiz pages — review complete; keep current live version.** [Reviewed comparison](preview/quiz-progress-preview.html). Nick chose the current quiz unchanged after speaking with Jonas. Retain existing questions/order, answer cards, progress and feedback. Jonas’s four criteria indicators and completion feedback are not adopted; the interactive demo remains excluded. The separately approved first-question explainer remains the only selected quiz-surface addition.
3. **Lead capture and reveal — parked while reviewing the result opening.** Review differences in access wording, added commitment and reveal behavior. Do not imply scanner access is unlocked merely by supplying email. Done when exact retained/changed screens and recovery behavior are recorded.
4. **Current review: result/offer opening.** Review the revised draft: result heading, existing Today/Goal visualization, Jonas-style explanation, customer video directly above pricing, app-benefit cards below pricing and floating WhatsApp. Nick selected the organic offer as the source for this draft; no final composition approval is inferred. After this opening, review WhatsApp entry and relevant FAQ. Correct the known example-image/explanation mismatch; preserve truthful unknown-product expectations. Done when Nick has reviewed exact visuals and content, including video/captions and contact behavior.
5. **Consolidate implementation plan.** Map selected changes to current-main files, shared integrations and specific regression checks. Consume approved screen evidence and produce one reviewed journey. Run one read-only counterpart plan review; resolve findings and get final journey sign-off before handing execution to implementation-loop.

## 9. Verification requirements

- **Automated, when implemented:** preserve existing funnel/attribution, quiz navigation/state and result/checkout regression coverage. Add focused deterministic checks only for selected behavioral changes; execute any new browser path through the repository’s invoked verification commands.
- **Browser:** full mobile viewport, small phones, safe areas, enlarged text, reduced motion, image loading and bounded desktop layout. Verify ad entry opens question 1 without a landing step, attribution initializes correctly, answer selection advances, and back/return keeps expected state, contact opens the intended destination, and shared purchase continuation remains intact.
- **Integration/live state:** no migration or provider write is authorized here. Billing-dependent assertions require the trial task’s receipts and final integration verification.
- **Evidence-sensitive copy:** retain explicit example labeling; verify any commercial, product-fit, turnaround, limit or access claim before reuse.

## 10. Review and handoff

Counterpart implementation-plan review is pending until the selected scope is concrete. This evolving decision record deliberately stops at the next visual review; no final readiness or journey approval is claimed.

Artifact disposition at handoff: commit the chosen refinement plan and final approved evidence/necessary assets; archive historical comparison/original mockups with clear historical labels; discard transient tool/reviewer output. Do not delete any artifact now. Existing unique documents and unrelated worktrees remain untouched. Refresh the implementation base before app edits rather than implementing directly on this older planning checkout.


### Locked entry copy — 14 September

**Damit der Scanner zu deinem Haar passt.**

Der Scanner gleicht Produkte mit deinem Haarprofil ab. Dafür brauchen wir ein paar Angaben zu deinen Haaren.

10 kurze Fragen · ca. 2 Minuten

The approved first-screen composition retains the current question and answer images, omits a separate start CTA, and presents this explanation at the top. [Approval receipt and content hashes](preview/quiz-entry-approval.json). Subsequent quiz pages keep the current live progress display and answer feedback, as explicitly confirmed after the comparison review.

### Result-opening draft — 14 September

User direction: use the production organic Personal Plan offer as the base, including its top video and visualization, and integrate selected scanner-result elements. Source inspected locally at `09799e227d36ce38103eaf04ebfe71248ab132fe`; no new live deployment parity claim. Existing assessment explanations and segment counts are reused unchanged as requested, rather than adding new inferred hair or product scores. Their suitability within scanner positioning remains part of review. The proposed new bridge distinguishes quiz hair-profile output from a later scan of a real product. Final video content and the remainder of the offer are still open.

Verification: source and draft render successfully; all three diagnostic article blocks match exactly; approved quiz-entry hashes remain intact. Browser inspected at a 390px frame width, including cards and the scanner bridge. Reference video uses the source Wistia ID with a poster fallback; scanner video is a local provisional asset. No checkout or lead submission is connected.

### Revised order and restored benefits — 14 September

Nick requested Jonas’s explanation order, moving the video immediately above payment, trying Jonas’s video, adding floating WhatsApp, and restoring the what-you-get app section below payment. The earlier video-first draft is superseded. The selected reference for the benefits is the existing scanner offer’s four-card product tour (Scanner, Plan, Anwendung, Chat), with source images and copy. The exact separate “Wispr Flow” reference was not identified; no claim of recovering that specific artifact is made.

Draft order: profile → existing diagnostic cards → dark scanner bridge → scanner and result examples → Steffi video → trial selection → app benefits → footer. The example caption follows the supplied screenshot and does not reuse Jonas’s contradictory profile-specific explanation or a one-second SLA. Trial display consumes the separate trial plan revision 1.6: annual preselected, 7 days on both plans, monthly 9.99 EUR, annual 69.99 EUR first year then 99.99 EUR. No reminder timeline is introduced.

Verification: all three source diagnostic cards still match exactly; locked quiz-entry hashes unchanged; video bytes match PR #535 and playback was observed advancing from 0:00 to 0:08 of 0:29, then paused. Browser checked the portrait video/pricing adjacency, monthly-to-annual selection and changing terms, floating WhatsApp dialog, and the benefits below pricing at 390px width. Local prototype only: checkout and WhatsApp do not contact providers or send messages. WhatsApp destination/message, final captions, clickable legal navigation and production integration remain open. No conversion or A/B test was run.

### Concise transition — 14 September

Nick confirmed the section order makes sense and requested less copy throughout, with a clearer profile-to-scanner connection. Keep sections focused, short and free of duplicate explanations. Preserve essential pricing terms and explicit example labels. This is a funnel copy guideline in this plan, not a new persistent memory.

The revised green transition reads “Dein Haarprofil steht. Jetzt kann der Scanner Produkte damit abgleichen.” The following action card reads “Welche Produkte passen zu dir? Scanne deine Produkte – im Bad oder im Regal.” Repeated introductions around the example, video and benefit cards were removed; the three scanner steps were shortened. Diagnostic explanations and payment terms are unchanged. Updated rendered copy remains available for review; this does not constitute final journey or production sign-off.

### Single transition and production screenshot styling — 14 September

Nick asked to merge the two adjacent transition cards, retain “So funktioniert der Scanner”, replace the result image with a genuine production screenshot including a visible product photo, and compare phone-mockup styles. The green duplicate was removed; the remaining dark card says “Dein Haarprofil steht. Der Scanner zeigt dir, welche Produkte dazu passen.” Existing diagnostic cards and the first scanner-demo card are retained.

[Three styling options](preview/scan-result-styles.html): A centered complete phone (recommendation for concise copy); B smaller phone with three callouts; C compact cropped phone. A is placed provisionally in the full preview; no final selection is implied. Old missing-product imagery is removed from this active section. `production-screen.js` is intentionally unset until a real production result can be captured and inspected; the styled frames explicitly show missing-source placeholders, not fabricated live content.

Production screenshot capture is pending login: both the in-app browser and Chrome redirected `/scan` to `/auth?next=%2Fscan`. Nick has been asked to sign in and open a saved scan with a product image. Archived references also have placeholder product images and were rejected for this requirement. No entitlement or auth bypass was attempted; no production scan or account mutation was performed. Remaining work: capture the actual production result, verify its visible product image, record provenance, use the same unmodified asset across the styling options, and revisit the rendered mobile comparison.

### Outcome, testimonials and FAQ — 14 September

Nick requested a short outcome section after the scanner result example, said the payment and what-you-get sections are fine, and requested testimonials, FAQ and sticky contact. Retain those reviewed payment/benefit layouts; do not infer final provider integration approval. The revised draft adds “Weniger raten. Bewusster auswählen.” with three short outcomes, then retains Steffi’s video immediately before pricing. After the four app benefits come three existing Chaarlie testimonials and five concise FAQ accordions. Existing customer quotes are copied verbatim from the current scanner offer; titles are reduced to first names, and no new ratings or scanner-specific endorsements are invented. FAQ text is a proposed concise adaptation, with trial language aligned to the separate trial plan.

Floating WhatsApp remains visible throughout; it is the contact control requested here, with its destination still pending. There is no second sticky contact or bottom purchase bar. The live production screenshot remains pending login; the result image area is explicitly a placeholder. All new content is mockup evidence awaiting visual feedback, not a production implementation.

### Single outcome headline — 14 September

Nick requested one concise positive outcome, larger type and fewer text sections. The outcome block now contains only “Finde Produkte, die zu deinem Haar passen.” Remove its eyebrow, prior two-part heading and three bullets. Set the single headline prominently at 36px on mobile, up to 52px on desktop. The page order remains unchanged.

### Visually signal the problem solved — 14 September

Nick found a large outcome headline alone insufficient and requested a visual connection to the pain being solved. [Three visual options](preview/outcome-styles.html) retain short copy: A one-card question-to-clarity split (recommended), B question bubble with an arrow into the benefit, C crossed-out buying on guesswork plus a prominent positive result. All use the benefit “Wissen, welche Produkte zu dir passen.” Green, a check and hierarchy emphasize the outcome; a short question or struck-through pain supplies context. These are isolated options, not a selected change to the full draft. The current one-line outcome remains until a variant is chosen.

### Outcome C selected — 14 September

Nick selected C and requested two compact sections. Applied C to the full draft: a muted crossed-out “Auf Verdacht kaufen.” block, then a green check with “Wissen, welche Produkte zu dir passen.” Removed the bottom “Dein Vorteil mit Chaarlie” label. The latter sentence preserves the existing legible C wording; the dictated phrase in the latest message was interpreted in that context. Revised visual styling remains reviewable; selection of C does not approve the entire journey or production implementation.

### Mobile styling and brand text colors — 14 September

Nick clarified this is a test draft and requested mobile optimization and color-compliant font styling. The selected outcome now uses Chaarlie plum text and accents instead of green: pain text #624c76 on #f3eff6, benefit text #2a1845 on #eee8f6, white check on #7657a2. Mobile uses 28px headline (25px on narrow screens), smaller padding and a 25px check. [Mobile evidence at 390px and 320px](preview/outcome-mobile-preview.html). No publication, production edit or campaign activation is authorized by this iteration.

### Jonas testimonials and revised FAQ — 14 September

Nick accepted the mobile direction (“that looks better”) and requested Jonas’s testimonials and FAQ assessment. PR #535 contains the same three quotes as the existing draft, reordered Kim/Kerstin/Sarah with descriptive name/headings. The preview now uses his verbatim quotes, order and headings. Five-star rating decorations and survey statistics are not added; the source owner’s evidence records are not inspected in this task.

Six proposed FAQs now cover personalization, drugstore coverage, unknown-product review, app inclusions, after-trial charges and cancellation. Removed Jonas’s unsupported day-five email promise, packaging-photo/48-hour/email-return workflow, precise catalog count and weekly-growth claim. Unknown products retain the current review/chat expectation. Trial charges and continued access after cancellation consume the separate trial plan; profile Abo-management navigation is supported by the existing profile controls, without a one-tap promise. This remains a visual draft, with final integrated cancellation flow verification owned by trial implementation.

### Reopen Jonas full draft; timeline and reminder direction — 14 September

Nick asked to see Jonas’s full draft and explicitly said he wants to integrate the timeline with a reminder before the first charge. [Full reference at the timeline](preview/jonas.html?area=full#pricing). Jonas’s example says access today, email on day 5, billing on day 7. Treat this as a reference schedule, not proof of a functioning reminder or the approved final delivery time. The full reference also retains historical commercial copy and should not override current renewal terms.

The latest user direction takes precedence over the earlier exclusion of optional reminders. Record intent to include the timeline and pre-charge reminder in this scanner refinement. Do not silently alter the independently owned trial implementation or claim email delivery is wired: reconcile exact timing relative to actual trial expiry, Stripe/PayPal coverage, ownership of delivery, and cancellation behavior with that task before publishing a promise. The presumed conversion benefit is an untested hypothesis here; no experiment or outside evidence was assessed in this turn. Consolidated preview/FAQ remains unchanged until the revised reminder contract can be reflected accurately.


### Compact timeline, mobile polish and testimonial cards — 14 September

Nick requested the changes directly in the local draft: a genuine scanned-product result screenshot, mobile alignment/padding, fewer words, the timeline immediately before payment, and Jonas-style testimonials. This authorizes the preview revision, not production activation.

- Added one compact timeline immediately before the plan choices: **Heute — 7 Tage voller Zugriff. / Tag 5 — Erinnerung per E-Mail. / Tag 7 — Abo-Start, falls du nicht kündigst.** Removed the repetitive pricing introduction. FAQ now reflects this requested preview schedule. Day-five delivery remains an implementation dependency; do not publish the promise before real trial-relative scheduling, provider coverage, cancellation handling and delivery are verified.
- Retained annual preselection and the separate trial plan revision 1.6 amounts. Actual first-year billing amount is prominent; renewal remains visible. Monthly selection updates its terms locally. No checkout is connected.
- Added scoped mobile styling in `preview/scanner-mobile-polish.css`: centered 480px maximum page, consistent 14–18px mobile gutters, compact phone framing, readable plum text, narrower diagnostic headings, vertically stacked testimonial cards, accessible-size primary controls and wrapped legal links. Kept the intentional horizontal app-benefit carousel.
- Jonas's three customer quotes, order and headings remain verbatim, with coral quotation marks and compact cards. No unsupported rating badges were added. Removed the repeated introduction above the existing diagnostic cards; their markup, explanatory copy and scores remain identical to the organic reference.
- Browser-inspected pricing and testimonials at 390px and 320px; monthly switching and the expanded trial FAQ work. The floating WhatsApp control remains a local dialog and can overlap content while scrolling, as floating controls do; final destination and whole-journey verification remain pending. Body text contrast checked at 7.16:1; primary CTA darkened after the first color check. Approved quiz-entry hashes and all three diagnostic cards remain unchanged.
- **Still blocked:** production tab redirects to login. The explicit phone placeholder remains until Nick signs in and opens a result with a visible product photo. No fabricated image, auth bypass, new production scan, or account mutation substituted for this requirement.

Review the latest [mobile draft](preview/outcome-mobile-preview.html?area=pricing) or [full comparison](preview/full-draft-comparison.html). Final design and journey approval remain pending review of this revision and the genuine result screenshot.


### Screenshot-led corrections and real capture delegation — 14 September

Nick said the layout and sections are otherwise fine, subject to these specific corrections. Removed the three numbered boxes below the shelf image. Removed standalone decorative quotation marks from all testimonial cards; customer quotes remain unchanged. Centered both outcome cards: pain icon/text share a centered row, while the benefit check is centered above a balanced headline with equal padding. Centered the adjacent video eyebrow/heading and kept the portrait video centered. Updated day 7 to **“Dein Abo startet – weiter voller Zugriff.”** Prices and cancellation terms remain directly below the plans.

Browser-inspected the outcome/video at 390px and 320px and the cleaned testimonials at 390px. Source diagnostic card markup and approved quiz hashes remain unchanged. The builder now pins the already-reviewed source commit explicitly, so unrelated root changes cannot silently alter the mockup.

Nick explicitly authorized a separate session to obtain a real scanner-result screenshot through available admin access or a dedicated production test user. A separate capture task was requested; it owns only minimum test-account/profile/result preparation and an unmodified screenshot with provenance. Existing customers, billing settings, product catalog authority and deployment remain outside that request. This task owns preview integration once the asset is returned. Overall section order is accepted; image capture and review of these alignment corrections remain outstanding before design closure.


### Genuine production result integrated — 14 September

The separate task **Capture real production scanner result…** (`01a0a09a-3758-7f62-bc25-561dde4ab39d`) completed the capture. It used Nick's existing scanner-test account and normal auth verification with one admin-generated link; no email, new account, profile seeding, entitlement, billing or catalog change was needed. Temporary auth link removed and camera tab closed afterward.

The preview now includes the unchanged 390×844 native JPEG of **OGX Renewing + Argan Oil of Morocco Shampoo**, showing the product photo and “Passt mit Einschränkung” / 2 of 3 targets. This saved-product result was opened through the real production scanner UI. It belongs to the existing test profile, not the fictional profile above; the caption explicitly says “Echter Scan · Beispielprofil. Dein Ergebnis ist individuell.” The screenshot is rendered natively inside the responsive CSS phone frame, including without JavaScript. No UI or pixels were fabricated or retouched.

Asset: `preview/images/production/ogx-production-scan-390x844.jpg`; [capture provenance and scoped action receipt](preview/images/production/provenance.md). SHA-256: `aa7221d1c44e03fa0ddb4b70f3947fae66f907a47dffd97a921b48fa29724566`. Browser-inspected at 390px and 320px, with visible product photo and result. The previous screenshot-access blocker is resolved. Timeline email delivery and final design/journey review remain independent follow-ups.


### Independent adversarial UX review and subsequent Claude review — 14 September

Nick explicitly requested an independent expert UX/design agent to adversarially review the full current draft. Review baseline is revision 12; content hashes are recorded in `reviews/ux-review-baseline.json`. Review is read-only and covers the whole rendered result/offer journey at 390px and 320px, including clarity, hierarchy, alignment, screenshot legibility, purchase friction and mobile accessibility. Distinguish observed defects from subjective preferences and conversion hypotheses. Preserve the accepted section order unless an evidence-backed issue requires a founder decision. No reviewer suggestions are automatically implementation authority.

Sequence: independent UX critique → verify and discuss prioritized findings with Nick → revise agreed items → Nick locks the final design → run the separately requested Claude review on that locked evidence and corresponding plan. Claude review is explicitly authorized for that later checkpoint, not yet run. Its review remains read-only and terminal, with high effort through the repository's `claude-plan-review` bridge. Final overall user journey and implementation handoff remain separate from section-order acceptance.


### Adversarial review completed — 14 September

[Prioritized findings and evidence](reviews/adversarial-ux-review.md). Independent reviewer inspected the complete 390px/320px draft. Main verified the screenshot scale/price overlap evidence, caption-track absence, example caption placement and unchanged review baseline. Keep the accepted section order. Main recommends resolving the small screenshot and WhatsApp collisions before founder lock; clarify example-profile wording, prepare accurate video captions, enlarge the header touch target, and let Nick decide whether to retain Jonas's editorial testimonial headings. No design changes were applied from this review. Founder design lock remains pending; Claude review is authorized for the following checkpoint and has not yet run.


### Recommendations acknowledged; independent Claude review requested now — 14 September

Nick: “all these sound awesome, keep them notes down and now let claude do the same review independently.” Record agreement with the six recommendations in the prior review. Keep the exact WhatsApp non-overlap behavior and final rendering for later visual review; no mockup edits are requested in this turn. The latest explicit instruction authorizes Claude review now, superseding the earlier wait-until-founder-lock ordering; it does not silently mark the design or implementation journey locked.

Claude receives an isolated neutral revision-12 artifact bundle and unannotated 390px/320px screenshots, with previous findings and this plan excluded to preserve independence. Use the repository Claude bridge at high effort; review is read-only and terminal. Compare and verify the returned critique afterward. Current draft files remain unchanged.


### Independent Claude review completed — 14 September

[Verified Claude notes and reconciliation](reviews/claude-ux-review.md); raw report and neutral input retained alongside. Claude Opus 4.8/high independently reviewed the unchanged revision-12 screenshots/source without access to the previous critique. No live browser interaction was performed by Claude. It independently supports correcting WhatsApp overlap and example-profile clarity, and keeping the existing flow. Main verified the CTA edge overlap, corrected the report's arrow-occlusion and day-five occurrence overstatements, and rejected varying diagnostic bars for appearance. A truthful assessment-scale label is a new low-priority clarity note, not an approved score/logic change. All six recommendations Nick acknowledged remain recorded; this turn changes no draft design. Final revised visual evidence and journey lock remain outstanding.


### Current draft locked; side-by-side refinement proposal — 14 September

Nick explicitly requested: “lock our current draft and show next to it a mockup of one with those changes implemented.” Preserved revision12 and every local dependency under `preview/locked-v12/`, with a SHA-256 baseline manifest. This is the founder-requested frozen before view; it does not activate production or pre-approve the revised version. Original current-draft files also remain unchanged.

[New before/after comparison](preview/refinement-comparison.html): left `locked-v12/result-scanner-draft.html`, right `proposed-v13/result-scanner-draft.html`. Both are independently scrollable, with common section jumps and 390px/320px controls.

The right mockup implements the six agreed directions: WhatsApp remains persistently available in the sticky header instead of covering content; header controls have44px minimum targets; scan heading changes to “So sieht ein Scan-Ergebnis aus” with “Beispiel eines anderen Haarprofils.” above the image; reduced phone framing and a native dialog allow enlargement of the unchanged image; testimonial headings become first names only, preserving quotes; native selectable German captions default on for the Steffi video.

**Captions limitation:** timed ASR draft transcribed locally from the original video using faster-whisper/small. No audio upload. Brand spelling and punctuation normalized; a second decode checked the uncertain middle phrase. Actual caption rendering is reviewable, but a final listening check is still required before publication. This limitation is visible in the comparison's review note and documented beside the VTT. No fabricated claim of human transcription or final subtitle accuracy.

Assessment scores and their source card markup, section order, trial/pricing disclosures, FAQ, actual screenshot bytes and original video are unchanged. The optional scale-label idea was not added. Proposed sticky-header contact placement and enlargement behavior remain for Nick to review here; no application/source implementation, purchase, message or deployment is performed.


Verification of the new comparison: baseline/dependency hashes passed; original and proposed diagnostic cards, quote bodies, trial terms and FAQs compared equal. Browser inspected both columns at320/390px, confirmed non-overlapping header contact, opened and closed enlarged result dialog, and confirmed native German captions visibly rendering at approximately9seconds in standalone playback. Playback-only check tab closed afterward. Final listening check remains open as declared; no claim of publication-ready captions.


### Founder feedback on refinement proposal — revision 14

Nick rejected WhatsApp in the sticky header, requested only the right-hand “Beispiel” pill without the repeated example subheading, and requested larger, properly centered “Auf Verdacht kaufen.” He positively reviewed the subtitled video and next-step section; both remain unchanged. This accepts those visual directions, not final subtitle accuracy, reminder delivery or production readiness.

Updated only the proposed column in [the comparison](preview/refinement-comparison.html?revision=14); revision 12 remains frozen. Removed the header contact control and redundant example paragraph. The pain card now centers the text alone at 20px with equal padding; removed the decorative cross that displaced its visual center.

Contact placement proposal: a 48px bottom-right WhatsApp button, hidden while video, payment, testimonials or FAQ/footer are in view, or when its position would cover copy or the scan-result image. Inline WhatsApp links below payment and before the footer keep help available there. All contact actions still open the local mockup dialog; no message or external navigation occurs. Final contact destination remains pending.

Research: [Intercom Messenger FAQs](https://www.intercom.com/help/en/articles/6612597-messenger-faqs) document bottom-right placement for mobile web; [Crisp hide/show documentation](https://help.crisp.chat/en/article/how-to-programmatically-hide-and-show-the-chatbox-13l0f8e/) supports conditional launcher visibility. The proposed visibility conditions are our design judgment, not a claimed industry standard or proven conversion lift.

Verification: inspected the 320px outcome, scan image and payment layout; payment contact opens and closes its local dialog. Checked that the header has no WhatsApp control, the repeated example paragraph is removed, and the frozen baseline dependency hashes remain unchanged. JavaScript syntax check passed. Contextual contact placement remains a proposal for founder review.


### Persistent bottom contact — revision 15

Nick clarified that contact must stay at the bottom of the viewport while scrolling, rather than appear only at the document footer. This supersedes revision 14's conditional hiding. The proposed draft now keeps the 48px WhatsApp control fixed at bottom right through every page section, with mobile safe-area spacing and extra document-end padding so the last footer content can scroll clear of it. No header contact. Inline payment/footer contact links remain. The button still opens only the local mockup dialog.

The current local source search did not establish an equivalent production support widget; the available production scanner tab is at authentication. Do not claim that live behavior has been verified. No production access change was made. Frozen revision 12 and other page content remain unchanged.


### Correction: persistent purchase CTA, not contact — revision 16

Nick clarified immediately: “I just mean the payment button, the call-to-action purchase button.” This supersedes the revision 15 interpretation. The purchase CTA now stays fixed in a full-width bottom dock, centered within the 480px page with mobile safe-area padding. “7 Tage kostenlos testen” jumps to the existing tariff/payment section; it does not bypass plan selection or initiate a purchase. The previous header offer CTA is moved into this dock. Header retains the brand.

Contact remains an inline WhatsApp link near payment and before the footer; removed the floating contact bubble. All contact/checkout dialogs remain local preview stubs. Added bottom document padding so final content can scroll clear of the dock. Other content and the frozen baseline remain unchanged. This is the corrected reviewable mockup, not production implementation.

Revision 16 verification: browser confirmed the bottom purchase CTA remains at the same viewport position before and after scrolling from profile to scan/outcome at 390px. Its link targets the existing pricing section. JavaScript syntax and all 29 frozen-baseline hashes passed.


### Stronger before/after distinction — revision 17

Nick requested more visual contrast between “Auf Verdacht kaufen.” and the positive outcome below. The proposed pain card now uses pale rose (#fbe9e5), dark muted red text (#8b3545), a dashed rose border and a stronger strike-through. The centered 20px label is retained; the positive outcome keeps its plum styling and checkmark. No extra copy. The fixed purchase CTA and contact placement are unchanged. Frozen revision 12 is preserved.


### Restore visible WhatsApp button alongside purchase CTA — revision 18

Nick explicitly rejected replacing the WhatsApp button with text links and requested research-informed placement. Both controls are required: fixed purchase CTA across the bottom, plus a recognizable green WhatsApp button fixed bottom-right above it. The new 56px WhatsApp button has a 12px gap above the measured purchase-dock height (including mobile safe-area padding). It stays visible while scrolling and opens the existing local contact dialog. Inline links remain supplemental. This supersedes earlier hiding/removal interpretations. No real messages or external contact are sent.

Research: [Intercom Messenger FAQs](https://www.intercom.com/help/en/articles/6612597-messenger-faqs) document bottom-right mobile web placement. [Reddit discussion](https://www.reddit.com/r/DigitalMarketing/comments/1s9epjv/for_mobile_landing_pages_do_you_use_a_sticky/) includes practitioners using sticky bottom-right WhatsApp; these are anecdotes, not conversion evidence. [XTemos support discussion](https://xtemos.com/forums/topic/whatsapp-button-overlapping-sticky-add-to-cart/) documents the real overlap issue between WhatsApp and sticky add-to-cart. The separate vertical position and 12px gap are our layout judgment; no universal optimum or conversion uplift is claimed.

The initial above-dock placement failed visual inspection at 320px: although separated from the sticky purchase CTA, the floating button covered part of a tariff card. Final revision 18 therefore reserves a dedicated slot at the right end of the same bottom dock, next to the larger purchase CTA. WhatsApp remains a separate green 56px icon button; the purchase CTA fills the remaining width. Both stay visible during scrolling, with no floating icon covering prices or copy. Bottom-right positioning follows the documented convention; using a shared dock is our adaptation to this page's two persistent controls. The initial above-dock placement is rejected.

Verification: contact button opens and closes the local mockup dialog at 320px. Frozen baseline hashes and JavaScript syntax passed. The final dock is inspected at 320px and 390px. No destination number was invented or messages sent.


### Requested separate floating-button mockup — revision 19

Nick rejected the combined purchase/contact bar and requested a mockup of the explicitly proposed alternative: full-width purchase CTA fixed at the bottom, with WhatsApp as a separate green floating button on the right, 12px above the measured purchase-bar height. Both remain visible during scrolling. The possibility of temporary overlap with scrolling content was disclosed in the proposal. This revision shows that requested arrangement, superseding the shared-slot design in revision 18. It does not imply final design approval. Frozen baseline, page content and local-only interactions remain unchanged.


### Keep the sticky header offer CTA too — revision 20

Nick approved revision 19's full-width bottom purchase bar plus separate floating WhatsApp button (“good like this”), and explicitly requested retaining the sticky header CTA too. Restored “Angebot ansehen” from the frozen baseline into the proposed header, with the existing 44px minimum touch target. Both header and bottom purchase CTAs lead to the tariff section; the green WhatsApp bubble stays separate, 12px above the bottom bar. This records approval of the control arrangement, not final production readiness or the overall implementation journey. No other content changed and no current production equivalence is claimed without live verification.


### Founder design lock — revision 20

Nick explicitly approved the displayed revision 20: “good, now lets lock this in” / “good now.” This records confirmed visual evidence review and locks the current scanner result/offer design. Saved a self-contained copy of all local files under `preview/approved-v20/`, with SHA-256 hashes in `approval-manifest.json`. The comparison now points to this approved snapshot. Future design changes must use a separate revision rather than overwrite it. Revision 12 remains preserved as the historical before view.

Locked: existing diagnostic/profile content and section order; scanner introduction and real product-result image with a single example pill and enlargement; contrasting rose/plum outcome cards; subtitled Steffi video; compact timeline before plan selection; annual preselection and displayed terms; app benefits, customer quotes, FAQ and legal footer. Controls: sticky header “Angebot ansehen”, full-width fixed bottom “7 Tage kostenlos testen”, and separate green WhatsApp bubble 12px above the bottom bar. Both purchase CTAs lead to pricing; mockup checkout and contact stay local stubs.

Earlier locked entry direction remains: ads enter directly into the quiz with the approved short first-question explainer; other quiz pages retain production behavior/design.

This is design approval. The final production journey, checkout/provider behavior, real reminder delivery, contact destination and final subtitle listening check remain implementation handoff dependencies already recorded above. No production implementation, publication or purchase is performed by this lock.

## Implementation — 14 September 2026

Nick confirmed the integrated journey and authorized implementation: “excellent. lets go implement with subagents”. [Implementation handoff revision 3](implementation-handoff.md) controls this slice. Revision-20 visual evidence remains frozen.

The implementation uses `SCANNER_FUNNEL_REFINEMENT_ENABLED=true` as a server-owned local opt-in. Its default is off. `/lp/scan` redirects through the existing signed attribution boundary; current quiz behavior and saved progress are retained. The eligible commercial scanner result uses the approved composition, actual-answer organic assessment rows, original scan screenshot/video, authoritative shared trial tariff selector and existing checkout controller. Header/bottom purchase shortcuts and the separate WhatsApp placeholder are implemented.

Local real-component preview: `/labs/scanner-refinement` (development only, no checkout/provider call). Its answer/pricing fixtures are QA data, not new production eligibility. The purchase action confirms the selection locally.

Publication still requires the real WhatsApp destination, final caption listening check, verified trial-relative day-5 reminder delivery and explicit rollout authorization. No provider, production data or publication changes are included. Fresh verification and review are recorded in `implementation-verification.md`.
