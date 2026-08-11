# Personal Plan post-payment debugging run — 2026-08-11

## Source and status

- Source: Nick's full authenticated production debugging run and nine attached screenshots.
- Overall result: the flow became unusable from the product stage onward. The product review and Routine surfaces did not provide useful guidance, the selected-product handoff into Routine appears broken, and Anwendung could not be tested because it was empty.
- Status: all 13 findings are documented and implemented in the local task worktree; repository and owner-scoped Stage 1→5 verification pass. Publication and production activation remain separate gates.
- Boundary: this document records the submitted feedback. It is not an implementation plan, approval to publish, or authorization for production writes, migration application, feature-flag changes, deployment, or activation.

## Findings

### PP-01 — First transition is too wordy and there are too many transition pages

Screenshot: `codex-clipboard-ac74bae9-68e7-4c4b-8c4c-04162221d566.png`

Observed:

- The first transition contains too much explanatory copy.
- It is not visual enough; it should show a small visual/mockup of the plan reward.
- The explanation that the plan will be made “truly yours” in the next step is unnecessary here.
- The flow appears to use three pages as transitions, creating unnecessary friction.

Requested direction:

- Keep transitions copy-light.
- Use a concise message along the lines of: “Basierend auf deinen Quiz-Antworten empfehlen wir das für dein Haar.”
- Move the promise of personalization to the CTA on the plan/result page instead of explaining it on the transition page.
- Investigate why three transition pages exist and remove redundant transitions.

### PP-02 — Product-category screen appears to duplicate refinement

Screenshot: `codex-clipboard-4ab4a8f9-7b54-4ee4-a952-2004d07618a6.png`

Observed:

- The user already selected which product categories they use during refinement.
- Stage 3 asks for the same information again on “Deine Produktarten.”

Requested direction:

- Determine whether this screen is a true duplicate.
- Reuse the refinement answer when it is authoritative and avoid asking the same question twice.

### PP-03 — OGX search-result names are still inconsistent

Screenshot: `codex-clipboard-8864fb6a-37a9-4d25-b926-a2ba971033fb.png`

Observed:

- OGX results use inconsistent names, for example “Biotin & Collagen,” “Renewing + Argan Oil of Morocco Shampoo,” “Rosemary,” and “Keratin Oil.”
- The expected search-preview format was the full identity: brand + line + product name.

Requested direction:

- Use one canonical full-name formatter for search previews.
- Verify the catalog identity fields and the UI composition path rather than patching OGX strings individually.

### PP-04 — Selecting a search result has slow and unclear feedback

Screenshots: `codex-clipboard-8864fb6a-37a9-4d25-b926-a2ba971033fb.png`, `codex-clipboard-b73ebdad-d020-4bab-a716-82e87354d4d3.png`

Observed:

- Clicking a product gives no immediate confirmation that the selection succeeded.
- After a noticeable delay, the UI unexpectedly changes to the frequency question.

Requested direction:

- Give immediate, unmistakable selection feedback.
- Make the transition to frequency feel causally connected and responsive.
- Investigate network, persistence, render, and state-machine timing separately.

### PP-05 — Saving between product additions is too slow

Observed:

- Interstitial saves between adding products introduce unacceptable delay.

Requested direction:

- Investigate a local/draft state model with one atomic save at the end of the product stage so intra-stage transitions are seamless.
- Compare that with optimistic per-category persistence and explicit retry/recovery behavior before choosing the write contract.

### PP-06 — Frequency slider interaction is broken and auto-advances unexpectedly

Screenshot: `codex-clipboard-b73ebdad-d020-4bab-a716-82e87354d4d3.png`

Observed:

- The frequency control behaves like a one-click selector rather than a familiar editable slider.
- The selected value cannot be comfortably adjusted.
- Clicking a point appears to lock the value and then moves to the next page without an explicit continue action.
- The feedback loop does not match standard slider behavior.

Requested direction:

- Implement conventional slider/range behavior with keyboard, pointer, touch, focus, and accessible value feedback.
- Do not auto-advance on value selection; keep an explicit “Weiter” action.

### PP-07 — Searchable products can be missing required analysis properties

Screenshot: `codex-clipboard-862a2fcd-9290-4b93-9b1f-8ff05b2d9f76.png`

Observed:

- A product can be searchable/selectable in the catalog but still be “Noch nicht beurteilbar” because confirmed product information is missing.
- This violates the expectation that search-visible products are fully part of the usable product database.
- The current action immediately excludes the product from the Routine.

Requested direction:

- Define and enforce the minimum catalog-readiness contract for Stage 3 search visibility.
- A not-yet-analyzed owned product should be presented as temporarily waiting for analysis, not as permanently excluded.
- It may remain non-executable internally until reviewed, but the user-facing state must communicate temporariness and next steps.

### PP-08 — Product-fit feedback page is not useful and diverges from the designed comparison

Screenshots: `codex-clipboard-862a2fcd-9290-4b93-9b1f-8ff05b2d9f76.png`, `codex-clipboard-fa14d0fa-8855-4c9d-8514-022c04e21088.png`, `codex-clipboard-87415a76-6e5c-419b-a3ee-969151e6e374.png`

Observed:

- The page does not explain clearly why a product does or does not suit the user.
- It does not compare the owned product with the ideal profile for that category.
- The current cards do not match the previously designed table/checkmark comparison concept.
- Generic statements such as “Die bestätigten Produkteigenschaften passen nicht zu diesem Bedarf” do not provide actionable value.

Requested direction:

- Restore a category-specific ideal-versus-owned comparison.
- Show concrete criteria with clear pass/fail/unknown states and explain the consequence.
- Redesign the product feedback surface around the comparison table/checkmark concept.

### PP-09 — “Lücke im Plan markieren” copy is unacceptable

Screenshot: `codex-clipboard-87415a76-6e5c-419b-a3ee-969151e6e374.png`

Observed:

- “Lücke im Plan markieren” is unnatural and unclear.

Requested direction:

- Replace it with plain German that describes the user-visible outcome.
- Candidate language must be evaluated inside the real card and in the context of the pending/uncovered state.

### PP-10 — A mask is rated as a strong fit even though no mask was added

Screenshot: `codex-clipboard-87415a76-6e5c-419b-a3ee-969151e6e374.png`

Observed:

- The review shows category “Maske,” product name “Maske,” and “Passt sehr gut,” despite the user not adding a mask.

Requested direction:

- Treat this as a data/state-transfer defect, not a copy issue.
- Trace refinement category selection, Stage 3 inventory, placeholder/fallback construction, persisted assignments, and review-card rendering.
- Add a regression guard proving that an unselected/unowned category cannot become a positive product assessment.

### PP-11 — First Routine should not require a confirmation modal

Screenshot: `codex-clipboard-e1cc21a1-ef9d-49f7-9c99-9d62acb809c0.png`

Observed:

- The first generated Routine opens a “Routine bestätigen” modal.
- The modal says there is no old Routine and that zero components changed, then forces confirmation of the just-generated onboarding result.
- This adds no meaningful decision and is especially confusing with “0 Bausteine bleiben unverändert.”

Requested direction:

- The first generated Routine should be the accepted onboarding result and display directly.
- Reserve accept/reject confirmation for later successor proposals where a real existing Routine and meaningful changes exist.

### PP-12 — Final Routine page needs a complete visual and information-design makeover

Screenshot: `codex-clipboard-b104c1b3-ad7b-4063-ab47-e34f2e94fb91.png`

Observed:

- Card colors, borders, status treatments, layout, hierarchy, spacing, copy, and overall styling are poor.
- The page does not feel like a high-value final result.
- The visible content includes “Kein Produkt ausgewählt” for shampoo despite the user selecting a shampoo, which also indicates a functional transfer defect.

Requested direction:

- Perform a thorough desktop and mobile review of the whole Routine result surface.
- Create and review a world-class redesign in the actual product layout before implementation.
- Fix the underlying product-transfer defect rather than visually masking missing data.

### PP-13 — Anwendung could not be tested because the result was empty

Observed:

- Anwendung was empty, so the final stage could not be evaluated.
- This is downstream evidence that the Stage 3 → Stage 4 product/Routine transfer did not produce executable inputs.

Requested direction:

- Trace the exact selected-product and cadence data through Stage 3 completion, Stage 4 Routine persistence/activation, and Stage 5 compilation.
- Add an end-to-end regression proving that valid selected products populate Routine and then generate non-empty Anwendung guidance.

## Cross-cutting failure statement

From the product stage onward, the experience was effectively unusable:

- intra-stage interactions were slow and gave poor feedback;
- product identity and catalog readiness were inconsistent;
- fit explanations did not deliver the designed value;
- invented/placeholder product state appeared;
- selected products did not reliably transfer into the Routine;
- the first Routine required a meaningless confirmation;
- the Routine result was visually weak and functionally incomplete;
- Anwendung remained empty and therefore untestable.

Every PP-01 through PP-13 item must be explicitly diagnosed, mapped to an implementation task or an explicit product decision, and covered by verification before this remediation can be considered complete.
