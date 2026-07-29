# Personal Plan Quiz V1 — Implementation Decisions

Status: historical implementation log; later refinement and offer-integration plans supersede temporary decisions where noted

Source plan:

`/Users/nick/AI_work/hair_conscierge/.worktrees/riseguide-quiz-flow-plan/plans/2026-07-27-universal-personal-hair-plan-funnel.md`

## Working outcome

Build a rough but runnable parallel paid-ad quiz from the first hair-texture selection through:

- the agreed RiseGuide-inspired question and persuasion sequence;
- a provisional personalized profile summary;
- three loading and commitment stages;
- merged email and optional marketing-consent capture;
- a safe placeholder handoff owned by the future offer-page plan.

The existing `/quiz` remains unchanged. This pass prioritizes a coherent frontend experience over production-ready diagnosis, persistence, email delivery, or offer integration.

## Decision log

### D001 — Start before final plan sign-off

- **Decision:** implement now even though final mockup and designed-journey sign-off were still marked pending.
- **Why:** Nick explicitly requested a built version by tomorrow morning and accepted a roughly 60%-good base.
- **Risk:** some product and copy decisions will be revised after the first walkthrough.
- **Revisit:** after the first browser review.

### D002 — Frontend-first vertical slice

- **Decision:** the first slice may keep answers and derivations client-side and use a safe placeholder at the email handoff.
- **Why:** this produces the fastest useful artifact without forcing unresolved V2 schema, lead, Customer.io, consent-gating, or routine-engine decisions.
- **Risk:** refreshing or switching devices may not preserve all state until draft persistence is added; email submission is not production-capable.
- **Revisit:** after the frontend journey is accepted.

### D003 — No offer implementation

- **Decision:** stop after the merged email and optional marketing-consent screen.
- **Why:** Nick explicitly moved the offer page to a separate workstream.
- **Temporary behavior:** successful local submission shows a clearly labeled handoff placeholder rather than checkout or an invented offer.
- **Revisit:** when the separate offer-page plan defines its route and payload contract.

### D004 — Preserve the live quiz

- **Decision:** create a new funnel variant and V2 component/state namespace instead of changing the current `/quiz` step switch.
- **Why:** the new flow is intentionally parallel and significantly longer.
- **Risk:** selected shared primitives may need additive changes; any such change requires existing quiz regression checks.

### D005 — Provisional computation is explainable, not predictive

- **Decision:** the first frontend summary derives only directly recognizable values:
  - hair profile from texture, thickness, and density;
  - care focus from selected goals and current concerns;
  - scalp and rhythm from scalp and wash-frequency answers;
  - plan style from the routine preference and weekly time commitment.
- **Why:** this is enough to demonstrate real answer use without pretending the final recommendation engine already exists.
- **Risk:** priority ordering and safety routing are incomplete.
- **Revisit:** when deterministic V2 logic is specified.

### D006 — Use the existing funnel package boundary

- **Decision:** create package `meta_personal_plan_v1` at `/lp/haarplan`, with landing variant `personal-plan-quiz`, channel `meta`, and the existing `default` offer reference.
- **Why:** this preserves campaign attribution and URL handling without routing through the live `/quiz`.
- **Risk:** the package references an offer variant that this implementation intentionally never renders.
- **Revisit:** when the separate offer-page work defines its route and package.

### D007 — Add a disabled-by-default server kill switch

- **Decision:** `/lp/haarplan` is available only when `PERSONAL_PLAN_QUIZ_V1_ENABLED` is exactly `true`.
- **Why:** funnel package `status` is metadata, not runtime gating. The explicit flag keeps an unfinished flow unavailable by default in every environment.
- **Risk:** local reviewers must start the app with the flag enabled.
- **Revisit:** before any preview or production release.

### D008 — Use semantic V2 screens and isolated draft state

- **Decision:** the new flow uses semantic screen IDs, a history stack, and a separate `chaarlie:personal-plan-quiz-draft:v2` key.
- **Why:** the live quiz is coupled to numeric steps, V1 answer normalization, and its result route.
- **Risk:** shared answer mappings and migration are intentionally deferred.
- **Revisit:** after the question set is stabilized.

### D009 — Do not call legacy lead or result endpoints

- **Decision:** the final email action validates locally, does not persist personally identifiable information, and navigates to an isolated `/lp/haarplan/angebot` placeholder.
- **Why:** the current lead API requires a name and a complete legacy answer schema; the current result route immediately records an offer view and renders existing pricing.
- **Risk:** the final CTA is demonstrational, not a functional lead or result delivery.
- **Revisit:** when the V2 lead, consent, result-artifact, and offer contracts are defined.

### D010 — Reuse only generic primitives

- **Decision:** reuse generic buttons, inputs, and progress presentation where compatible, but fork the quiz shell, questions, loading, summary, and lead capture.
- **Why:** the legacy components encode old answer keys, auto-advance behavior, billing access, and result navigation.
- **Risk:** the rough version may not visually match every mature detail of the current quiz.
- **Revisit:** during the first visual QA pass.

### D011 — Use interim visual treatments

- **Decision:** use the existing texture-specific Chaarlie portrait illustrations for the opening cards and simple visual symbols for thickness, aspiration, and meaningful-moment cards.
- **Why:** no approved coherent editorial image set exists yet, and the first build must be reviewable before that image work is complete.
- **Risk:** the cards demonstrate hierarchy and interaction but do not yet meet the intended professional photographic direction.
- **Revisit:** during the dedicated visual-design pass.

### D012 — Keep Section 6 as a structural placeholder

- **Decision:** represent `Dein Haar`, `Passende Pflege`, and `Klarer Ablauf` with a deliberately simple three-part visual and the approved positive closing copy.
- **Why:** Nick explicitly accepted the visualization as a placeholder so the flow could move forward.
- **Risk:** this remains the weakest visual section and must not be treated as an approved final concept.
- **Revisit:** before design sign-off.

### D013 — Reuse only existing approved testimonials

- **Decision:** show the three already approved Chaarlie customer quotes during preparation rather than inventing plan-specific proof.
- **Why:** the requested plan-specific testimonial set does not exist in the reviewed evidence.
- **Risk:** the current quotes emphasize Chat and product recommendations more than the new personal-plan proposition.
- **Revisit:** when attributable routine- or plan-specific proof is available.

### D014 — Profile summary precedes weekly-time detail

- **Decision:** Section 10 shows `Plan-Stil` from the aspirational routine choice only; the weekly time is collected on the following separate screen.
- **Why:** the agreed journey keeps weekly time as Section 11, so it is not yet available when the Section 10 card first renders.
- **Risk:** the first summary is slightly less specific than the example copy in the plan.
- **Revisit:** decide whether to reorder the question, refresh the summary after Section 11, or intentionally keep the narrower label.

### D015 — Defer quiz milestone analytics

- **Decision:** preserve route-owned landing attribution but add no new `quiz_started`, screen-view, completion, or lead events in this rough build.
- **Why:** the event and consent contract for the parallel V2 journey has not been reviewed, and the final CTA is not a real completion or lead write yet.
- **Risk:** local review cannot validate the eventual funnel event sequence.
- **Revisit:** before any experiment or external preview.

### D016 — Safety flags replace the encouraging profile state

- **Decision:** when the user selects a medically adjacent safety signal, replace `VIEL POTENZIAL` and the green positive-validation card with `ABKLÄRUNG EMPFOHLEN` and a calm statement that the cosmetic plan cannot assess or treat the complaint.
- **Why:** the hair-safety review found that a universal positive state contradicted the referral signal and could provide inappropriate reassurance.
- **Temporary wording:** `Die von dir genannten Beschwerden kann dieser Haarpflegeplan nicht beurteilen oder behandeln. Bitte lass sie zeitnah ärztlich oder hautärztlich abklären.`
- **Revisit:** during final medical/trust copy review before release.

## Open decisions and shortcuts

Keep this list current during implementation.

- Final editorial images for texture, thickness, aspiration, and meaningful-moment cards.
- Final Section 6 causal-reframe illustration.
- Approved routine- or plan-specific testimonials for loading.
- Exact medically adjacent guidance and whether safety flags alter or only annotate the provisional profile.
- Exact V2 goal and concern taxonomy projection into the current routine engine.
- V2 draft persistence, lead schema, dedupe, optional-name database handling, Customer.io result email, and double opt-in.
- Final analytics and consent-gating sequence.
- Final handoff route and payload once the offer-page plan exists.
- Removal or replacement of the current `in zwei Minuten` campaign claim for this longer funnel.

## Verification target for this rough pass

- A local user can enter the new route and finish the complete frontend flow.
- Back navigation preserves answers during the session.
- Conditional scalp and heat questions appear only when relevant.
- The profile summary visibly changes when representative answers change.
- Loading progress is monotonic and commitments can be completed.
- Email and marketing consent share one final page and consent remains optional.
- The final action does not call checkout, create a production lead, or send an email.
- The existing `/quiz` route and its focused tests remain green.

## 2026-07-28 refinement implementation update

The approved refinement plan at
`plans/2026-07-28-personal-plan-quiz-refinement.md` supersedes the rough-build
decisions where they conflict. The following decisions were made while implementing that plan.

### D017 — Persist a discriminated V2 lead before the offer handoff

- **Decision:** replace the frontend-only D009 behavior with a dedicated
  `/api/quiz/personal-plan-lead` write. Store the complete durable answer envelope in the existing
  `leads` table with `quiz_kind = 'personal_plan'`; admissions, daily time, loading commitments,
  email suggestions, and testimonial content are excluded from the envelope.
- **Compatibility:** the database still requires `name`, so V2 inserts use an internal empty value
  that is never displayed or synchronized. Legacy lead/result/profile consumers explicitly accept
  only `quiz_kind = 'legacy'`.
- **Uncertainty:** the result adapter and stable return URL remain owned by the later offer-page
  workstream. No V2 result email is activated here.

### D018 — Use the generated natural-editorial image set as provisional runtime assets

- **Decision:** supersede D011 for the implemented prototype. Crop the reviewed controlled texture
  and thickness contact sheets into responsive WebP option images, use a texture-specific photo in
  the evolving profile, and use the reviewed recognition, commitment, and causal-reframe photos for
  the major persuasion beats.
- **Uncertainty:** length, density, surface, elasticity, aspiration, and meaningful-moment screens
  still need a final production asset decision. The current compact symbols are interaction
  scaffolding where no approved controlled photographic comparison exists.
- **Launch gate:** the generated people and prototype photographs require final visual approval,
  crop/accessibility QA, and rights/provenance confirmation before external activation.

### D019 — Keep the positive receipt and contextualize ordinary scalp complaints

- **Decision:** supersede D016. Ordinary cosmetic scalp answers never replace the encouraging
  `VIEL POTENZIAL` receipt. A short contextual boundary explains that strong, sudden, or persistent
  complaints belong with a medical or dermatological professional.
- **Uncertainty:** final medical/trust copy still requires compliance review before launch.

### D020 — Track diagnostic screen views without persisting conversion answers

- **Decision:** supersede D015. Record `quiz_started` through the first-party funnel milestone and
  `lead_captured` after the successful server save. Send stable V2 screen and section identifiers to
  PostHog only; never send answers, admissions, commitments, email, or testimonial content in that
  event.
- **Uncertainty:** immediate PostHog collection and the consent presentation require a separate
  privacy/compliance review before activation.

### D021 — Keep prototype loading proof visibly separated from durable customer data

- **Decision:** supersede rough D013 with the three reviewed `Verstehen → Personalisieren →
  Umsetzen` prototype statements. They support pacing and hierarchy only and are not written to
  `leads`, Customer.io, Meta, or the analytics screen event.
- **Launch gate:** replace them with attributable, approved customer proof serving the same three
  message roles before production use.

### Remaining iteration points after this build

- Final offer/result computation and V2 result-page adapter.
- Stable personalized return URL and final result-email content.
- Final controlled visual series for the factual and aspirational questions that still use compact
  symbols.
- Attribution and approval of the three preparation-stage testimonials.
- Compliance review of medical-boundary copy, marketing consent semantics, and immediate PostHog
  diagnostics.
- Feature-flag activation, migration application, deployment, and production verification remain
  separately authorized actions.
