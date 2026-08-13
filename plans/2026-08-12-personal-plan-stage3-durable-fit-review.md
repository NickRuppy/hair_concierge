# Personal Plan Stage 3 durable save and product-fit review

Status: PR 1 and PR 2 shipped. PR 3/4 addendum updated and independently reviewed after final product/UX grilling. Nick approved implementation on 2026-08-13; PR 3 is in implementation and PR 4 remains a separate follow-up.

## Outcome and source context

Stage 3 becomes one coherent, trustworthy workflow:

1. capture complete product facts for each confirmed category;
2. compute fit and exact alternatives from canonical server facts;
3. let the user review each product individually and make one explicit choice;
4. save that semantic choice durably;
5. reconcile canonical state before retrying an uncertain write;
6. compile owned, pending, overridden, uncovered, and planned products into Routine truthfully.

The plan consolidates:

- the production 409/503 investigation and canonical-save recovery work from task 019ff566-b29c-7663-8043-fc1aa0b64d55;
- the signed product-fit redesign from task 019ff565-80fb-7ef2-9570-db115ac63c43;
- the 2026-08-12 cross-plan grilling in the current task;
- current source on origin/main at 032245c5, including the shipped PR 1 recovery/readers and PR 2 server fit/replacement/v3-writer contract.

Durable evidence:

- [Combined fit and recovery states](./mockups/2026-08-12-stage3-durable-fit-review.html)
- The category presentation matrix in this plan

### Planning contract

- Outcome: every Stage 3 save has a deterministic desired state and bounded recovery, while the signed individual product-fit journey is implemented against that safe foundation.
- Constraints: preserve owner isolation, current refined-source authority, expected-revision CAS, exact-product facts, the five-stage journey, and truthful owned-versus-planned availability.
- Non-goals: no command ledger, background worker, generic workflow engine, new recommendation score, inferred product facts, Product Intake redesign, database migration, production activation, or Stage 3 GET prepare/passive-read migration. Product research completion alone never activates a Routine; only a later explicit affected-product reconfirmation may do so.
- Done when: all four ordered delivery slices satisfy their own acceptance gates, the combined journey is rendered and reviewed, ready-check and whole-branch review pass for each PR, and production deployment remains a separate authorization.

## Chosen direction

Use one master plan with four ordered pull requests. The fourth is a deliberately separate lifecycle change, not a condition for shipping the core individual-review redesign.

### PR 1 — Canonical save recovery and forward-compatible readers

PR 1 is always-on and behavior-preserving. It fixes the unknown-save-outcome and retry architecture behind the reported failures without changing the current visible decision order. PR 375 addressed a distinct Stage 3 access classification defect; before PR 1 is described as resolving the live incident, recheck the deployed head and reproduce the remaining 409/503 path:

- keep the current criteria UI, grouped clear-fit acceptance, and automatic Oil outcomes;
- represent category capture, category reopen, individual decisions, automatic batches, and completion as deterministic desired states;
- make PATCH canonically idempotent by checking desired-state satisfaction before rejecting a stale revision;
- replace captured React retry closures with explicit, serializable recovery state;
- preserve current GET first-entry behavior in this incident slice;
- add privacy-safe failure phase and correlation diagnostics.
- expand portfolio parsers, Routine compiler/source reconciliation, and acquisition readers to understand the future v3 decision-keyed planned identity without emitting v3 yet.

PR 1 ships and is verified before any v3 writer. The tolerant v3 branches are dead under PR 1 production behavior, but they make PR 2's first v3 writes safe and preserve a reviewed rollback target after any v3 portfolio has been created.

### PR 2 — Server fit/replacement contract and v3 writer

PR 2 depends on PR 1 and adds no new customer UI. It:

- builds and transports the bounded server-authored comparison projection;
- selected alternatives are revalidated server-side and persisted with exact identity and fact fingerprint;
- adds the explicit select_replacement contract and schema-v3 portfolio writer;
- keeps the old customer journey, which does not emit select_replacement.

### PR 3 — All-user individual fit review

PR 3 depends on the deployed PR 2 server contract and replaces the whole visible decision journey:

- every product is reviewed individually, including clear fits and Oil subjects;
- the owned product is compared with up to three exact, server-verified alternatives;
- one sticky primary CTA is paired with quieter replacement, override, or permitted-uncovered actions;
- replacements enter Routine and Anwendung as Noch kaufen;
- replaced owned products remain owned and appear as Nicht verwendet in Profile and in a collapsed secondary section at the bottom of Routine;
- when no verified alternative or other truthful action exists, the review says so and returns to product capture without inventing a product;
- the final successful product decision opens Routine directly.

There is no redesign feature flag or maintained dual-path UI. PR 3 is verified in Preview before deployment. Operational rollback means redeploying the reviewed PR 2 release, which has the old UI plus recovery and v3-safe server readers. PR 3 deletes the superseded criteria/grouped/automatic UI instead of carrying it indefinitely.

### PR 4 — Later-verified product re-review

PR 4 follows PR 3 and adds the later verification lifecycle: a read-derived Routine invitation, affected-product-only reconfirmation, and direct guarded successor activation. Keeping it separate prevents the relatively rare Product Intake follow-up path from blocking or destabilizing the core Stage 3 redesign. It includes the narrow migration that treats explicitly confirmed `product_review` proposals differently from rejected automatic proposals.

## Canonical state is the receipt

Do not add an idempotency table. The Stage 3 draft and its compiled identifiers can prove whether each deterministic intent committed.

| Mutation family        | Desired state                                                               | Canonical satisfaction test                                                                                | Recovery                                                                   |
| ---------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Category capture       | Complete category snapshot: products, roles, frequency, gaps                | Project the canonical draft through the existing commandFromDraft/categoryCaptureCommandsEqual contract    | Reuse and harden the persistent category queue                             |
| Reopen category        | Target category is the active cursor and its affected decisions are cleared | Draft is in product_capture, cursor matches, completed marker is absent, pruned decisions are absent       | Treat already-open as success; otherwise canonical check before one resend |
| Individual decision    | subjectKey, semantic action, and exact selected candidate when required     | Persisted decisionKey has the same resolution action, choice state, product/candidate, and acknowledgement | Persist one minimal pending intent and reconcile                           |
| Legacy automatic batch | Fresh automatic outcomes for the current draft-wide authority snapshot      | Reload and recompute after each committed chunk; no eligible automatic outcome remains unresolved          | PR 1/2 recover the old UI path; PR 3 removes the caller                    |
| Completion             | Current draft is ready for Routine                                          | Stable portfolio/routine identifiers or internal already-completed result                                  | Return the client-visible ready_for_routine handoff idempotently           |

Search is read-only. It can retry a transient read once but never enters the save queue.

## Shared mutation and error contract

### Server mutation order

For every Stage 3 PATCH:

1. authenticate the owner and verify Stage 3 access;
2. parse the requested intent;
3. load the owner-scoped canonical draft and current refined authority;
4. evaluate the operation-specific desired-state predicate;
5. if the exact state already exists, return the canonical draft through the existing saved response and record an internal reconciled outcome;
6. if the same subject has a different canonical choice, return revision_conflict with the latest draft;
7. compare expectedRevision;
8. validate the snapshot, action, and selected replacement against current authority;
9. apply the existing owner/source-guarded CAS exactly once;
10. return the canonical saved draft.

The server never blindly retries writes, rebases a generic snapshot, substitutes a changed product, or returns a client-projected draft.

### Stable response classes

| Status | Code                                 | Client behavior                                                                                               |
| ------ | ------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| 200    | saved                                | Install canonical draft and continue                                                                          |
| 400    | invalid_request                      | Do not retry; surface a safe contract error                                                                   |
| 401    | unauthorized                         | Stop recovery and return through authentication                                                               |
| 404    | personal_plan_not_available          | Stop recovery and return to the current journey entry                                                         |
| 409    | revision_conflict                    | Install latest draft and classify the desired state                                                           |
| 409    | stage_not_ready                      | Stop the pending recovery and reload the current journey checkpoint; this body has no latestDraft             |
| 409    | stale_refined_source                 | Discard pending intent and reload current journey authority                                                   |
| 409    | stale_authority_snapshot             | Discard pending intent, reload review bundle, require a new explicit choice                                   |
| 409    | stage3_replacement_candidate_invalid | Reload the current comparison, clear the obsolete candidate, require a new explicit choice                    |
| 409    | completion_not_ready                 | Canonical GET, reopen the unresolved/current comparison, and require a valid decision; do not loop completion |
| 429    | rate_limited                         | Retain intent, respect Retry-After, then automatically start with a canonical read                            |
| 503    | temporarily_unavailable              | Treat outcome as unknown and begin canonical reconciliation                                                   |

Mutation errors remain small. PR 2 introduces stage3_replacement_candidate_invalid only for select_replacement allowlist/fingerprint staleness and maps it to HTTP 409. Existing category-capture stage3_authority_candidate_invalid and subject/action/shape validation remain HTTP 400 invalid_request. The production/fixture gateway must throw the distinct replacement code so the route does not infer mutation type from a discarded generic error. A changed recommendation is recovered through the canonical GET/review-bundle read instead of attaching the full comparison payload to a 409.

Add invalid_request, unauthorized, personal_plan_not_available, stage_not_ready, stale_refined_source, stale_authority_snapshot, stage3_replacement_candidate_invalid, revision_conflict where applicable, rate_limited, completion_not_ready, and temporarily_unavailable to the existing closed Stage3ProductsGatewayErrorCode union; preserve every existing snapshot/compensation/idempotency member. Stage3ProductsGatewayError carries the parsed code, HTTP status, and optional retryAfterSeconds. The HTTP gateway parses Retry-After from the Response before throwing; it does not discard the response and later attempt to infer the header from the JSON body.

Do not widen Stage3MutationResponse with a reconciled field. The client already knows it entered checking_canonical, and server logs/metrics can distinguish desired-state satisfaction internally. Both paths install the same canonical saved draft and emit one user-visible success.

### Privacy-safe diagnostics

Reuse the existing production persistence timing vocabulary and add only the missing route boundary names. A sanitized correlationId may carry one failurePhase from:

- journey_access
- canonical_draft
- source_context
- authority_facts
- cas_save
- response

Preserve the existing Server-Timing names auth, journey, rate_limit, and gateway. Logs and analytics exclude product names, queries, profile facts, request bodies, local pending payloads, and free text.

The route's 429/503 early returns must emit the same timing/phase metadata as gateway failures. Canonical GET remains outside the mutation rate limiter; add a route regression test because automatic 429 recovery depends on that invariant. Use the existing fixedWindowRetryAfterSeconds helper for the actual remaining fixed-window wait instead of a hardcoded 60-second header.

Use layered owner-scoped Stage 3 mutation budgets: a coarse 90-per-60-second aggregate ceiling, category capture/reopen at 30 per 60 seconds, and individual/legacy-batch decisions at 60 per 60 seconds. Every PATCH consumes the aggregate budget and exactly one parsed operation-family budget; completion remains separate below. This prevents earlier capture traffic from starving a fast individual review while still bounding total authenticated writes. Treat these as conservative initial limits and validate production-shaped maximum and p95 journey counts before release; tuning the numbers must not change the layered contract. Cover aggregate and family limits directly and do not infer the mutation family from an unparsed body.

### Completion route contract

Completion is a separate POST /api/personal-plan/stage-3/complete with its own 8-per-60-second limiter. Apply the same code/status/header parser, correlation/phase logging, Retry-After handling, and unknown-outcome reconciliation to this route explicitly.

- completion_not_ready is deterministic, not temporarily_unavailable: load canonical draft/evaluations, reopen the unresolved decision or refreshed replacement comparison, and require a valid decision;
- revision_conflict with latestDraft installs and classifies that draft;
- a lost response after successful staging checks the completed draft and stable portfolio/routine identifiers before another POST;
- 429 waits once, then begins with canonical GET;
- 503 begins with canonical GET;
- completed portfolio replay is success, not an active mutation retry.

Separate the internal completion result from the production HTTP client contract. The server/fixture completion service may return not_ready with a draft internally, but the production route converts that state to 409 completion_not_ready. The HTTP gateway therefore returns only ready_for_routine on success and throws the typed completion_not_ready error otherwise; remove the unreachable client response arm and the flow branch that currently expects it over HTTP.

## Client recovery state machine

Replace handleMutationError(error, retryClosure) and handleConflict(latestDraft, retryClosure) with explicit state:

    idle
      -> submitting
      -> checking_canonical
          -> saved
          -> resend_once -> saved
          -> reconfirm_changed_authority
          -> canonical_conflict
          -> waiting_for_retry_after -> checking_canonical
          -> manual_recovery

### Persisted individual intent

Persist at most one unresolved decision intent for the active draft, using the same bounded expiry convention as the category queue:

    personalPlanId
    refinedVersionId
    draftId
    ownerId
    subjectKey
    action
    selectedCandidateId (only when required)
    expectedRevision
    createdAt

subjectKey is the wire/authority identifier and maps to persisted decisionKey. The selected comparison bundle uses productId; the existing mutation wire field remains selectedCandidateId.

Mirror the existing category queue's owner-scoped storage key and clearOnLogout(ownerId) behavior. Never store names, images, comparison dimensions, profile data, auth data beyond the opaque owner scope key, or free text. Recovery uses the persisted production IDs and never fixture fallback IDs. A different authenticated owner cannot see or replay another owner's pending intent.

### Recovery order

After a timeout, network failure, or 503:

1. retain desired state and show Wir prüfen deine Auswahl.;
2. lock Back and all Stage 3 decision actions while the outcome is unknown;
3. call the canonical Stage 3 GET once;
4. if the desired state is present, install it and continue without PATCH;
5. if revision is unchanged and desired state is absent, resend once;
6. if revision advanced:
   - exact desired state now present: continue as saved;
   - draft already completed: clear the intent and reconcile through the completion handoff rather than report a revision conflict;
   - category changed: install canonical state and reopen the category;
   - reopen target satisfied: enter it without another PATCH;
   - decision unresolved and the same action/candidate remains authoritative: update expected revision and resend once;
   - subject resolved differently: show the canonical choice;
   - authority or candidate changed: discard the old intent and reopen the refreshed detailed comparison with an update notice;
7. if the canonical read or one resend remains unavailable, show Speicherstatus noch offen.;
8. Speicherstatus erneut prüfen restarts at the canonical read and never invokes an old closure.

The user may leave the page while recovery is open. On return or hot reload, recovery runs before Stage 3 input is enabled.

For 429, show a short waiting state, respect Retry-After, then automatically begin with the canonical read. Do not repeatedly write on a timer.

The existing category queue permits two attempts per 60-second window and currently throws a plain category_capture_retry_limited error before persisting a third attempt. Replace that throw-only boundary with an explicit retry-limited classification carrying retryAt. Persist the minimal attempt count/window boundary in the same owner-scoped queue envelope so hot reload cannot reset the bound. Initial submit plus the one automatic resend consume the two attempts; a manual status check still performs canonical GET immediately but waits until retryAt before any further write. The decision-intent reconciler uses the same durable bounded write-attempt rule so category and decision recovery cannot diverge.

### Duplicate and concurrent input

- Suppress duplicate clicks while one save owns the submission state.
- Do not allow Back, alternative switching, or another action during checking, rate-limit waiting, or manual recovery.
- Two tabs remain safe because desired-state comparison and CAS use canonical state.
- A different choice in another tab is installed and shown; it is never overwritten automatically.
- A completed draft is classified as completion success when stable portfolio/routine identifiers are available; it is never resent as an active decision.

## Product-fit action contract

| Review state                      | Sticky primary                                | Quiet actions                                           | Persisted result                                             |
| --------------------------------- | --------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------ |
| Owned ideal                       | {Owned product} weiterverwenden               | Cycle verified alternatives; take visible alternative   | keep_owned, or selected planned replacement                  |
| Owned supportive                  | {Owned product} weiterverwenden               | Take visible ideal/supportive alternative; cycle        | keep_owned with limitation, or selected planned replacement  |
| Owned mismatch                    | {Visible ideal product} als Ersatz übernehmen | Cycle; Mit Einschränkung weiterverwenden                | selected planned replacement, or informed override           |
| No owned coverage                 | {Visible ideal product} in Routine übernehmen | Cycle; Vorerst ohne Produkt only when authority permits | planned product, or confirmed uncovered role                 |
| New submission pending            | Verifizierte Alternative wählen               | Cycle                                                   | pending source remains; verified alternative becomes planned |
| Existing catalog analysis missing | Erneut versuchen                              | Back after no save is pending                           | unresolved system/data error; no normal uncovered escape     |
| No truthful action available      | Zurück zu meinen Produkten                    | none                                                    | unresolved; no placeholder product and no completion         |

Normal successful actions save and advance immediately. Only Vorerst ohne Produkt opens a short confirmation. The final successful decision completes Stage 3 and opens Routine.

Product-card taps change marker focus only. Alternative arrows change the displayed candidate and its purple markers only. Only an explicit action persists.

There is no purchase CTA on the comparison page.

If the bounded candidate bundle is empty, first apply the subject's remaining truthful action contract: keep an eligible owned product, permit an informed override only when authority allows it, retain a pending submission, or permit an uncovered role only when authority allows it. Only when none applies, show **Keine passende Alternative verfügbar.** with **Zurück zu meinen Produkten**. The user remains unresolved and Stage 3 cannot complete; the client never fabricates a recommendation or silently drops a required role.

### Exact replacement action

Add select_replacement to the authority action union and every exhaustive mapper. The client sends the visible product ID through selectedCandidateId. The server:

1. rebuilds the bounded candidate allowlist from current signed context;
2. verifies the requested exact product is still ideal or supportive for the subject;
3. persists that candidate's identity and current fact fingerprint;
4. records resolutionAction: select_replacement;
5. rejects forged, disappeared, or changed replacement candidates as stage3_replacement_candidate_invalid while leaving category-capture candidate errors unchanged.

Legacy plan_recommendation remains accepted for compatibility and passes through the same current-authority validation.

Mechanically, production and fixture gateways must change as one unit:

- carve select_replacement out before the ordinary evaluation.allowedActions guard in production-persistence-gateway resolveDecision and fixture-gateway resolveDecision; all other actions continue through the existing guard;
- validateSelectedCandidate accepts any product in the rebuilt bounded comparison allowlist, not only evaluation.recommendation.productId;
- buildAuthorityDecision uses an exhaustive action switch: select_replacement and legacy plan_recommendation map to choiceState planned_purchase and require the selected recommendation branch; no known action may fall through to unassigned;
- buildAuthorityDecision builds recommendation and recommendationFactFingerprint from the selected candidate's full facts, including candidate 2/3;
- authorityActionForChoiceState first reads persisted resolutionAction when present and only derives the legacy action from choiceState for old decisions;
- completionDecisionsRemainCurrent uses resolutionAction to revalidate select_replacement against the current allowlist and exact fingerprint.
- stage3ProductDecisionSchema persists resolutionAction instead of silently stripping it;
- authorityDecisionIntent attaches selectedCandidateId for both select_replacement and legacy plan_recommendation.

authorityEvidence remains schema version 1 because the selected product and fingerprint already fit its existing fields; do not widen the evidence payload merely to carry resolutionAction.

The action remains a gateway-level allowlist carve-out. Category adapters do not add select_replacement to their ordinary allowedActions; they continue to describe authority-required actions, while voluntary replacement exists only when the server-built comparison contains an eligible exact candidate.

When replacement validation fails, the client reloads the current review bundle, clears the obsolete local candidate, resets the carousel to the first current candidate, shows Die passenden Alternativen wurden aktualisiert. Bitte wähle erneut., and requires a fresh click.

## Portfolio and downstream truth

- Parse portfolio JSON versions 1, 2, and 3. Emit version 3 only when the completed draft contains a v3-only resolutionAction, decision-keyed planned purchase, or retained-owned projection; otherwise preserve the current version-1/version-2 derivation.
- Add sourceDecisionKey to each planned purchase.
- Use planned:{decisionKey} as plannedPurchaseId so multiple same-role replacements cannot collide.
- Add retainedOwnedProducts with the owned product identity, sourceDecisionKey, and planStatus: not_used. Do not derive this only in the UI: frozen categoryResolutions carry capturedProductId but not the product ID/display identity required after the mutable draft is gone.
- A replaced owned product remains owned and is excluded from active Routine/Anwendung. It renders as Nicht verwendet in Profile and in a collapsed, secondary **Nicht verwendete Produkte (n)** disclosure after all core Routine sections.
- A selected replacement enters plannedPurchases and the intended Routine/Anwendung slot as Noch kaufen.
- Planned is not owned and is not executable until the existing Ich habe es schon gekauft acquisition succeeds.
- A pending submission may coexist with a verified planned alternative. The submission stays Wird geprüft and never silently replaces the routine later.
- An informed override remains active and renders downstream as Mit Einschränkung.
- Completion revalidates select_replacement against the current allowlist and stored fingerprint rather than assuming the adapter's first recommendation.

retainedOwnedProducts do not enter RoutinePayloadV1 and do not create a Routine item or a new availability enum. The Routine page loader presents them as separate read-only portfolio context, outside `RoutinePayloadV1`; Profile reads the same frozen portfolio truth. The bottom disclosure is omitted when empty, collapsed by default when present, and never creates an Anwendung step. PR 3 must test both presentation surfaces and the no-Routine-item invariant.

planned_purchase_not_acquired remains an internal execution-gap reason until acquisition. When an exact planned item is present, customer UI shows that item as Noch kaufen and does not also label the role generally uncovered; the uncovered wording is reserved for an actual leave_uncovered decision.

Pending-plus-planned is one reviewed decision with two deliberate portfolio projections, not two decision subjects and not a special nested decision shape. The decision retains the pending capturedProductId and the exact selected recommendation/fingerprint; portfolio projection independently emits the original submission to pendingProducts and the verified replacement to plannedPurchases. It emits both corresponding internal execution gaps without allowing either branch to return early and suppress the other.

routine-candidate-compiler explicitly accepts wrapper and snapshot versions 1, 2, and 3 and preserves their equality check. Existing compiled version-1/version-2 routines keep their stored identities. For v3, every planned lookup uses sourceDecisionKey === resolution.decisionKey; category/role is only a v1/v2 fallback. Acquisition remains a truthful product-ownership fact: when the owner acquires an exact catalog product, source reconciliation resolves every already-approved planned Routine use of that same exact product/category, never merely the first match. It adds no new role and does not touch a different product. This works through the existing product-keyed ownership event and needs no new acquisition migration. Source reconciliation and acquisition resolve both the legacy category/role identity and new decision-keyed identity; they never rewrite an active legacy Routine merely because PR 2 deployed.

Noch kaufen and Mit Einschränkung are derived only for schema-v3/resolution-action items. Existing version-1/version-2 routines retain their current Geplant/Bewusste Wahl presentation, so PR 2 does not silently relabel old customer plans.

PR 3 requires no database migration. PR 4 adds one narrow migration: `product_review` is removed from automatic rejected-fingerprint suppression because the preceding affected-product confirmations are explicit user consent. `source_sync` and `acquisition` remain suppressed exactly as before.

## Later product verification and direct Routine activation

A successful Product Intake review is a new fact, not permission to change the active Routine. Detection is a canonical read, not an automatic write:

1. Product research completion updates the owner-scoped `user_product`; existing intake/outbox behavior remains unchanged.
2. The Routine loader compares the active frozen portfolio's `pendingProducts` with current owner products. A formerly pending source that is now `matched` becomes an affected product-review invitation. Each pending product joins to every `categoryResolution` with the same `capturedProductId`, yielding exact decision keys even when one product fills multiple roles. No `(category, role)` fallback is used, no proposal is staged, and the active Routine remains untouched.
3. On Routine entry, show **Dein Produkt wurde geprüft.** with **Jetzt prüfen** and **Später**. Dismissal changes nothing; the prompt returns while the active portfolio still contains that now-resolved pending source.
4. **Jetzt prüfen** loads fresh server-authored fit bundles for only those affected decision keys. The user reconfirms each through the same comparison component; unrelated decisions are not reopened.
5. Keep a proposal-scoped, owner-scoped minimal local envelope of confirmed semantic actions so navigation/hot reload does not lose progress. It contains opaque decision/action/candidate IDs only and is discarded when authority changes, ownership changes, activation succeeds, or the owner logs out.
6. The final reconfirmation is the consent boundary. One server endpoint reloads the active portfolio, current owner products, plan/source revisions, and fit authority; revalidates every supplied action/candidate; projects a successor portfolio; compiles the successor Routine; stages it with `origin: product_review`; and accepts that exact proposal through the existing `personal_plan_confirm_routine_proposal` CAS.
7. On success the successor becomes active and Routine reloads directly. There is no second proposal summary.
8. If the first transition staged but the confirmation response is lost or fails, the pending proposal's `origin` is exposed by the Routine read contract, the generic successor sheet is suppressed, and canonical reload determines whether the exact candidate activated, remains retryable, or was superseded.
9. On every failure the old active Routine remains active. Changed authority returns to the affected comparison; a transient final failure shows **Deine Routine konnte noch nicht aktualisiert werden. Erneut versuchen** without discarding still-current confirmations.
10. The failure state also offers **Aktualisierung verwerfen**. It rejects the exact pending `product_review` proposal through the existing guarded rejection RPC, clears the local confirmation envelope, and returns to the unchanged active Routine. Because the underlying verified-product fact still exists, the non-blocking invitation may appear again on a later visit.

This is direct in the user journey, but deliberately retains the existing guarded stage-then-confirm persistence lifecycle. It needs no new table or activation RPC: a new application service and route own the idempotent orchestration, while database confirmation remains the single active-pointer transition. The narrow suppression migration prevents an explicitly reconfirmed `product_review` candidate from being discarded as an earlier rejected automatic proposal. The server, never the client, builds the successor portfolio and Routine from canonical facts.

## Product-fit presentation contract

The server returns a UI-agnostic review bundle containing:

- the existing authority evaluation;
- owned product identity and presentation-only image;
- zero to three ordered exact alternative candidates;
- zero to three honest comparison dimensions;
- comparison, compact, or unavailable presentation mode.

The client never derives fit, ranking, target corridors, scores, or reason copy.

### Alternative ordering

1. reuse already-loaded active, recommendable candidates;
2. exclude the owned product;
3. evaluate against the same category authority and signed context;
4. exact ideal first, exact supportive second;
5. within each group, existing authority recommendation first, then sort_order, then product ID;
6. replace the existing catalog-facts literal .limit(12) with one exported STAGE3_AUTHORITY_CANDIDATE_QUERY_LIMIT and reuse it; normalization may yield fewer than 12 evaluable facts, and transport remains capped at three;
7. omit arrows/count for one candidate and omit the alternative card for none;
8. clearly label supportive alternatives as Sehr passend and use Trotz Einschränkung übernehmen.

Presentation-only image and supported-stop data remain outside authority fingerprints.

### Category presentation matrix

| Subject                   | Dimension 1      | Dimension 2                  | Dimension 3          | Boundary                                                                                                         |
| ------------------------- | ---------------- | ---------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Everyday Shampoo          | Reinigungsstärke | Kopfhaut-Fokus               | Geeignete Haardicke  | No invented cleansing target; show stored product stops without a target corridor                                |
| Targeted dandruff Shampoo | Reinigungsstärke | Schuppen-Fokus compact match | Geeignete Haardicke  | Do not force dandruff states onto the oily/dry rail                                                              |
| Conditioner               | Pflegegewicht    | Pflegerichtung               | Repair-Unterstützung | Separate presentation-supported care directions from target-relative authority spec                              |
| Mask                      | Pflegegewicht    | Pflegerichtung               | Repair-Unterstützung | Required-benefit failure may replace the lowest-priority row                                                     |
| Leave-in                  | Pflegegewicht    | Pflegerichtung               | Repair-Unterstützung | Every role uses this primary set; Hitzeschutz appears only as a blocking fact when it changes a pre-heat verdict |
| Oil leave-on/dry finish   | Anwendung        | Pflegegewicht                | Geeignete Haardicke  | Role is exact; set-valued support is never averaged                                                              |
| Oil pre-wash              | Anwendung        | Geeignete Haardicke          | none                 | Do not invent a third row or weight target                                                                       |

Specialist categories heat_protectant, deep_cleansing_shampoo, dry_shampoo, bondbuilder, and scalp_care use compact role/capability/protocol facts. They receive an alternative only when the server has a distinct exact ideal or supportive candidate.

If a lifecycle, reaction, required-benefit, role, thickness, heat, or protocol fact controls a mismatch/unknown verdict and is not in the normal rows, it replaces the lowest-priority row. Missing authority remains Noch offen. No presentation value is inferred from product name, ingredients, claims, or adjacent properties.

Reason copy is a fixed German mapping over signed profile/plan facts and controlling authority criteria. Every reason is one sentence.

## Scope and non-goals

### In scope

- PR 1 canonical recovery for capture, reopen, individual decisions, legacy automatic batches, and completion.
- Structured 409/429/503 contracts and diagnostics.
- PR 2 fit comparison projection and accessible component.
- Individual review order and navigation as the sole post-PR-2 journey.
- Exact server-validated replacement action.
- Schema-v3 decision-keyed planned identity and retained ownership projection.
- Truthful Stage 4/5 status continuity.
- Collapsed Routine/Profile visibility for retained owned products.
- Explicit later-verified-product review with direct guarded successor activation after affected choices are reconfirmed.
- Typed analytics, bounded payload/performance checks, responsive and fault-injection verification.

### Non-goals

- Stage 1 or Stage 2 redesign.
- Product search/capture UI redesign beyond recovery feedback and first-decision Back destination.
- Recommendation rule, category verdict, target, score, or catalog enrichment change.
- Product Intake submission/compensation changes.
- Direct purchase on the comparison page.
- Automatic Routine activation when product research completes; activation requires the later explicit affected-product reconfirmation.
- New DB table, activation RPC, worker, offline sync, or cross-device unsent-intent recovery. The only persistence change is PR 4's narrow product-review suppression migration.
- Stage 3 prepare/passive-GET migration; keep it as a separately reviewed follow-up after recovery is stable.
- Production deployment, production migration/write, or old-worktree cleanup.

## Target map

### PR 1 likely surfaces

- src/lib/personal-plan/products/category-capture-queue.ts
- src/components/personal-plan-products/use-stage3-category-capture-controller.ts
- new decision-recovery helper under src/lib/personal-plan/products/
- src/lib/personal-plan/products/gateway.ts
- src/lib/personal-plan/products/http-gateway.ts
- src/lib/personal-plan/products/production-persistence-gateway.ts
- src/lib/personal-plan/products/fixture-gateway.ts
- src/app/api/personal-plan/stage-3/route.ts
- src/app/api/personal-plan/stage-3/complete/route.ts
- src/lib/rate-limit.ts
- src/components/personal-plan-products/stage3-products-flow.tsx
- src/components/personal-plan-products/stage3-decision-controller.ts
- src/lib/personal-plan/products/contracts.ts and portfolio parsers
- src/lib/personal-plan/routine-candidate-compiler.ts and routine/source-reconciler.ts
- planned-item acquisition route/service forward readers
- src/lib/personal-plan/products/stage3-analytics.ts and src/lib/analytics/events.ts
- focused queue, gateway, route, flow, completion, analytics, and browser tests

### PR 2 likely surfaces

- new src/lib/personal-plan/products/fit-comparison.ts
- authority contracts and catalog-facts loaders
- production, HTTP, and fixture gateways plus Stage 3 route
- stage3-decision-projection.ts for the widened exhaustive action union while the legacy UI remains unchanged
- products/contracts.ts, portfolio.ts, routine-candidate-compiler.ts, and routine/source-reconciler.ts
- planned-item acquisition route/service
- src/lib/personal-plan/products/stage3-analytics.ts and src/lib/analytics/events.ts for stable journey-level baseline events
- production-shaped gateway, portfolio, compiler, source, and acquisition tests

### PR 3 likely surfaces

- new src/components/personal-plan-products/product-fit-comparison.tsx
- stage3-decision-controller.ts, stage3-decision-projection.ts, stage3-products-flow.tsx, and index.tsx
- Routine status and item cards
- src/lib/personal-plan/routine/contracts.ts, repository.ts, and load-view.ts for the shared active-portfolio presentation context
- src/components/routine/personal-plan/personal-plan-routine-client.tsx and routine-page.tsx for the collapsed retained-product disclosure
- typed analytics, fixture data, component/domain/browser tests
- the Profile product presentation for retained-owned Nicht verwendet status

### PR 4 likely surfaces

- the shared Routine active-portfolio presentation loader from PR 3, extended with read-derived product-review invitations
- Routine contracts/repository/load-view/proposal-service plus a bounded product-review successor service
- PersonalPlanRoutineClient and the existing Routine proposal read/resolve routes for prompt, retry, discard, and generic-sheet suppression
- the Routine successor lifecycle migration's automatic-rejection suppression predicate
- owner-scoped minimal product-review confirmation recovery
- focused loader/service/route/migration/component/browser tests

Before each remaining PR implementation, refresh its target map against the preceding merged head and record every changed seam in the implementation contract. None branches from a superseded planning worktree. Completion criterion: each starts with a no-write seam audit naming the actual files/functions it will change.

## Designed user journey

Original sign-off: confirmed by Nick on 2026-08-12. Renewed PR 3/4 evidence review and journey sign-off were confirmed by Nick through explicit implementation authorization on 2026-08-13.

1. An authenticated Personal Plan owner enters Stage 3 after Stage 2 saved the refined need and confirmed categories.
2. For each category they search and select the exact product, assign roles, and provide required frequency/usage facts.
3. A complete category snapshot saves as one canonical unit. Competing actions are disabled while it is submitting.
4. If the save result is uncertain, the page says Wir prüfen deine Auswahl. and checks canonical state before any write is repeated.
5. If the choice is already present, the user continues automatically. If absent and still valid, it is resent once.
6. If recovery remains unavailable, the page says Speicherstatus noch offen. and offers Speicherstatus erneut prüfen. Back and decision actions remain locked; leaving the page is safe because recovery resumes before new Stage 3 input.
7. After capture, the PR 3 journey shows one product review at a time. The owned product stays fixed beside the first verified alternative. Up to three dimensions show honest targets/positions; specialist categories use compact facts.
8. Alternative arrows cycle up to three exact candidates without saving. Card taps only focus markers.
9. The sticky action reflects the authority result: keep a good owned product, choose a replacement for a mismatch/no-owned role, or choose a verified alternative for a pending submission. Quiet actions allow an informed override, a voluntary replacement, or an authority-permitted uncovered role.
10. When an alternative is chosen, the server revalidates that exact product. On success the replacement becomes Noch kaufen in Routine/Anwendung and the replaced owned product becomes Nicht verwendet without losing ownership.
11. If no verified alternative and no other truthful action exists, the page says Keine passende Alternative verfügbar. and returns to product capture. The role remains unresolved and no placeholder is planned.
12. If the candidate changed during save, no substitute is applied. The same detailed comparison reloads with current alternatives, an update notice, and a fresh product-specific CTA.
13. A 429 shows a short wait and then automatically starts canonical recovery after Retry-After. A 503 or lost response always checks canonical state before one resend.
14. Back toward a previous completed product choice uses the existing guarded correction path and reopens that product's category capture; persisted decisions are never made locally editable again. From the first decision it returns to product capture. Back is unavailable only while a save outcome is unresolved.
15. Correcting an owned product recomputes only the affected product/category and preserves unrelated accepted decisions.
16. After the final successful decision, completion is reconciled idempotently and Stage 4 Routine opens directly.
17. Routine shows active products first. If retained owned products exist, a collapsed Nicht verwendete Produkte (n) section appears at the bottom; expanding it shows those products without adding Routine or Anwendung steps.
18. If a pending product is verified later, Routine detects the difference between the active frozen portfolio and the current owner product without staging or activating anything. Routine shows Dein Produkt wurde geprüft. with Jetzt prüfen and Später.
19. Jetzt prüfen opens only the affected product reviews with fresh server-authored facts. After the last affected confirmation, the server revalidates, builds, stages, and accepts the exact successor; the updated Routine opens directly with no second summary.
20. If direct activation cannot be confirmed, the old Routine remains active and the completed confirmations remain retryable. A canonical reload decides whether to finish, refresh a changed comparison, or show Erneut versuchen.

Meaningful variants:

- PR 1/2 legacy grouped/automatic UI with the same recovery foundation; PR 2 is the PR 3 deployment-rollback release;
- owned ideal, supportive, and mismatch;
- zero, one, and three alternatives;
- supportive alternative;
- no owned product and optional uncovered confirmation;
- pending submission plus verified planned alternative;
- no verified alternative and no other truthful action;
- later verified pending product with one or multiple affected decisions, dismissal, stale authority, and direct-activation retry;
- existing product analysis unavailable;
- multiple owned products in one category;
- Oil roles and specialist compact states;
- lost response after commit, failure before commit, changed candidate, concurrent tab, hot reload, 429, and manual recovery;
- mobile and desktop, keyboard, missing image, reduced motion.

Completion: one canonical portfolio preserves owned, pending, override, uncovered, and planned truth; Routine receives stable source identifiers and shows the next useful action.

## Planning evidence

Combined mockup question: Can the signed comparison remain the primary decision surface while uncertain saves, rate limiting, manual recovery, and changed candidates remain truthful and prevent duplicate decisions?

Decision criterion:

- the user always knows whether they are choosing, waiting, or recovering;
- only one actionable intent can own the screen;
- a changed candidate is visible in the detailed comparison before reconfirmation;
- no uncertain outcome is falsely called failed or unsaved;
- recovery does not add a second competing CTA.
- later verification never mutates the active Routine before explicit affected-product reconfirmation, and successful reconfirmation never adds a second summary.

Selected direction:

- retain the signed image-led two-product comparison and bounded carousel;
- replace the older generic changed-recommendation card with the refreshed detailed comparison plus update notice;
- render checking, rate-limit waiting, and manual recovery as locked full decision states;
- preserve one sticky product action only when the system is ready to accept a new choice.
- show the downstream consequence states Noch kaufen, Nicht verwendet, Mit Einschränkung, and the authority-permitted Vorerst ohne Produkt confirmation in the same artifact.
- keep Nicht verwendete Produkte collapsed below core Routine content and add the later-verification prompt plus direct-activation contract.

Evidence review status: the original combined artifact was confirmed by Nick on 2026-08-12. The updated no-alternative, retained-product, and later-verification evidence and journey were approved through explicit implementation authorization on 2026-08-13.

## Ordered implementation tasks

### PR 1 task 1 — Lock desired-state and structured error contracts

Consumes: current category queue, authority intents, Stage 3 mutation responses, and the contract above.

Define pure satisfaction/classification functions for category capture, reopen, individual decision, automatic batch recomputation, and completion. Define the owner-scoped persisted intent, logout/expiry/clear rules, subjectKey-to-decisionKey mapping, exact status/code parser, Stage3ProductsGatewayError status/retryAfterSeconds fields, Retry-After header parsing, completed-draft classification, and diagnostics. Add one typed privacy-safe personal_plan_stage3_recovery_outcome event with finite operation/outcome/failurePhase values in stage3-analytics.ts and analytics/events.ts; use it to derive the operational counts rather than creating one event per counter.

Produces: one typed recovery vocabulary shared by route, gateways, queue, and flow.

Complete when focused tests cover exact/already-present/different/missing/completed state, owner switch/logout, persisted-ID reload, expiry, serialization exclusions, typed analytics registration/payload mapping, 400/401/404/409 classes including a body without latestDraft, 429 headers, and 503 phases.

### PR 1 task 2 — Make PATCH canonically idempotent

Consumes: task 1 predicates.

Check desired-state satisfaction before expected-revision rejection, then preserve authority validation and CAS. Return the existing saved response with canonical state on desired-state satisfaction and latest draft on revision conflict. Record the reconciled outcome only in internal logs/metrics.

Produces: repeat-safe server mutations without a ledger.

Complete when lost-response replay cannot duplicate a semantic change and a different canonical choice cannot be mistaken for success.

### PR 1 task 3 — Replace closure retry with bounded reconciliation

Consumes: tasks 1 and 2.

Harden the category queue by replacing its plain category_capture_retry_limited throw with a typed retryAt result, persist its minimal attempt count/window boundary in the owner-scoped envelope, add owner-scoped decision-intent persistence, centralize explicit submit/check/wait/reconfirm/conflict/manual states, migrate all handleMutationError and handleConflict call sites, and reconcile on hot reload before enabling input. Move commandFromDraft and the desired-state predicates out of the React controller into a shared domain module. Apply the aggregate plus parsed capture/reopen or decision mutation budgets, return the actual fixed-window Retry-After, and add fake-timer coverage plus route guards proving canonical GET is not mutation-rate-limited.

Produces: no retry CTA that invokes a captured mutation callback.

Complete when tests cover before-save failure, after-commit lost response, GET failure, one-resend failure, third-write deferral until retryAt, duplicate click, manual canonical check, navigation lock, reload, expiry, two tabs, changed authority, and automatic 429 recovery.

### PR 1 task 4 — Recover legacy batches and completion

Consumes: canonical load/evaluation and task 3 state machine.

Keep current grouped clear fits and automatic Oil behavior in PR 1/2. Each chunk of at most 25 intents is one CAS, but a multi-chunk sequence is not globally atomic. After any ambiguous chunk, reload and recompute only currently unresolved eligible intents; never replay captured payloads or treat partial presence as proof that the whole sequence committed. Apply the separate completion-route contract: classify completion_not_ready deterministically, preserve its 8/60 limiter and actual Retry-After, add completion phases/timing, split internal not_ready from the production HTTP success response, remove the unreachable flow response branch, and reconcile active/already-completed drafts to ready_for_routine with stable identifiers.

Produces: the reliable current journey and deployment-rollback release.

Complete when rg and focused flow tests prove acceptClearFits and acceptAutomaticOutcomes are the only PR 1/2 batch callers, multi-chunk partial commit resumes only unresolved subjects, completion_not_ready returns to a valid decision rather than looping, completion rate-limit/lost-response paths reconcile, and completion replay opens Routine exactly once. PR 3 later deletes both batch callers with the superseded UI.

### PR 1 task 5 — Expand future-v3 readers without writing v3

Consumes: the exact schema-v3 shape and decision-keyed identity contract in this plan.

Add tolerant v3 parsers; widen the Routine compiler wrapper/snapshot gate to [1,2,3]; teach compilation and sourceIdentity/makeItem to resolve a v3 planned item by sourceDecisionKey === resolution.decisionKey with category/role only as the v1/v2 fallback; teach completed-portfolio replay, acquisition, and source reconciliation to resolve every already-approved planned use of the acquired exact product/category instead of taking the first matching productId; ignore retainedOwnedProducts in Routine. Do not emit v3 from Stage 3 in PR 1.

Produces: an expand-only forward reader that makes PR 2 writes safe and permits rollback to PR 1 even after PR 2 has created v3 portfolios. The normal PR 3 rollback target remains PR 2.

Complete when a production-shaped frozen v3 portfolio with two same-role planned replacements replays completion and compiles the correct items; acquisition resolves every approved use of the acquired exact product but no different product or unapproved role under PR 1 code; v1/v2 behavior remains byte-for-byte compatible; focused tests prove createProposedProductPortfolio still emits only current v1/v2.

### PR 1 task 6 — Verify and ship the reliability foundation

Run focused tests, full Personal Plan checks, CI, transition benchmark, authenticated mobile/desktop fault injection, ready-check, and one whole-branch Claude code review.

Complete when current user-visible behavior is unchanged, the future-v3 reader tests pass without v3 writes, no open P0/P1 finding remains, and recovery performance stays within the existing transition budget.

### PR 2 task 1 — Build the bounded comparison projection

Consumes: current signed targets, product facts, authority evaluations, the matrix above, and PR 1 gateway contracts.

Implement the pure presentation registry, supported-stop extraction, controlling-failure substitution, fixed reason copy, exact coordinates, and zero-to-three candidate selector without additional catalog reads.

Produces: buildStage3FitComparison and a bounded review bundle with no percentages or raw rows.

Complete when tests cover every category/role, no-invention rules, exact overlap, targetless Shampoo cleansing, multi-stop support, specialist compact mode, fingerprints, ordering, reuse of the exported 12-row query limit with fewer normalized facts allowed, and payload at most 64 KiB. Add or extend a production-shaped Stage 3 review-readiness benchmark that actually measures the review bundle; do not assume the transition benchmark covers it. Warm p95 must remain at most 3,000 ms.

### PR 2 task 2 — Add exact replacement validation and start writing portfolio v3

Consumes: PR 2 task 1 candidate allowlist and PR 1 desired-state recovery.

Add select_replacement; carve it out before the ordinary allowedActions guard; update validateSelectedCandidate and buildAuthorityDecision together; map it explicitly to planned_purchase with the exact recommendation; make authorityActionForChoiceState prefer persisted resolutionAction; update completionDecisionsRemainCurrent; persist resolutionAction in the schema; attach selectedCandidateId in the intent builder; update every exhaustive action projection including stage3-decision-projection.ts while keeping the legacy UI incapable of emitting the new action; add deterministic selected-candidate recommendation snapshots, decision-keyed planned identity, retained owned products, pending-plus-planned coexistence, and explicit version-3 emission. For pending-plus-planned, retain one decision and project both pendingProducts and plannedPurchases before either projection branch can return. Reuse the PR 1 readers/compiler/source/acquisition compatibility.

Produces: exact truthful cross-stage state.

Complete when forged/stale candidates fail closed with the distinct replacement code; category-capture candidate errors remain 400; candidate 2/3 persists exactly as planned_purchase with a recommendation; a pending source and its chosen verified alternative both survive portfolio projection; no select_replacement can fall through to unassigned; same-role replacements resolve by decision key and never collide; v1/v2 remain usable; acquiring one exact product resolves all and only its already-approved planned uses.

### PR 2 task 3 — Verify the server contract before UI activation

Run focused authority/gateway/portfolio/compiler/acquisition tests, production-shaped response-size/readiness benchmarks, CI, ready-check, and one whole-branch Claude code review. The old UI remains active and emits no select_replacement. Land privacy-safe journey_started and routine_opened events here, using the same definitions PR 3 will retain, so the no-flag rollout has a directly comparable completion baseline before the visible redesign.

Complete when the server can read/transport comparisons and safely persist exact replacements through direct tests, v3 replay works after redeploying PR 1 code, the stable journey-level baseline is recording without product identity, no visible journey changed, and no open P0/P1 finding remains.

### PR 3 task 1 — Build the accessible comparison component

Consumes: PR 2 review bundle and the combined artifact.

Implement product cards/images, alternative arrows/count, comparison rails and compact facts, exact overlap/stacking, one-sentence reasons, verdict strip, live announcements, image fallback, reduced motion, and state-specific sticky/quiet actions. Add the explicit no-truthful-action state with Keine passende Alternative verfügbar. and Zurück zu meinen Produkten; it must not appear while keep, override, pending, or authority-permitted uncovered remains valid.

Produces: ProductFitComparison.

Complete when component tests prove accessible focus/navigation, candidate-specific CTA, no horizontal overflow, one sticky action, no persistence from card/arrow interactions, and truthful zero-alternative fallback without a placeholder selection.

### PR 3 task 2 — Integrate one normal individual review end to end

Consumes: PR 2 server contract, task 1 component, and PR 1 recovery state machine.

Connect one ordinary owned-product subject to `ProductFitComparison`. Route keep and replacement through the same pending-intent recovery; explicitly bypass the current client `evaluation.allowedActions` rejection only for `select_replacement` when the current server bundle allowlists that exact product. Preserve changed-candidate reconfirmation and unresolved-save navigation locks. Keep the legacy UI components/callers in place during this stop-gate.

Produces: one fully tested vertical slice without removing rollback behavior inside the branch.

Complete when component/flow tests prove normal keep, exact replacement, changed candidate, 503/lost-response recovery, and no duplicate decision.

### PR 3 task 3 — Add navigation and the full subject matrix

Extend the individual history to multiple products, previous-decision Back, first-decision return to capture, correction isolation, Oil roles, specialist compact states, pending submissions, no-owned roles, optional uncovered confirmation, analysis error, and the no-truthful-action fallback. Do not delete legacy components yet.

Complete when flow/browser tests cover every signed action state, multiple same-category products, direct Routine handoff, mobile/desktop navigation, and all error/recovery variants with the old path still available only as internal branch fallback.

### PR 3 task 4 — Switch over, add analytics, and delete the legacy decision path

Make the individual history the only production post-capture journey. Delete grouped clear-fit and automatic Oil callers/components after every replacement test passes. Retain the PR 2 `journey_started`/`routine_opened` definitions and add typed `personal_plan_stage3_review_viewed`, `review_action`, `review_back`, and `review_completed` events using only finite category/verdict/action/destination/position/count fields—never product identity or comparison facts.

Complete when focused/flow tests pass and `rg` proves grouped-clear-fit and automatic-Oil production callers are absent.

### PR 3 task 5 — Align Routine, Anwendung, and Profile statuses

Consumes: portfolio v3.

Render Noch kaufen and Mit Einschränkung only for schema-v3/resolution-action items. Add one owner-scoped active-portfolio presentation loader reused by Routine and Profile. Render retained owned products as Nicht verwendet in Profile and in a collapsed Nicht verwendete Produkte (n) disclosure after the Routine sections; keep them outside RoutinePayloadV1 and omit the disclosure when empty. Keep planned products unowned/non-executable until acquisition while retaining the exact future item and verified protocol fields already produced by the compiler. Existing schema-v1/v2 routines keep their current copy and identities.

Produces: truthful downstream continuity.

Complete when Profile, Stage 4/5, source reconciliation, legacy active Routine, and acquisition tests pass for multiple replacements and pending sources; planned exact items show Noch kaufen rather than a duplicate uncovered label; retained products are collapsed by default, expandable, absent from Anwendung, and omitted entirely when none exist.

### PR 3 task 6 — Verify and review the all-user release

Run focused domain/component tests, Personal Plan browser journeys, CI, responsive rendered review, recovery fault injection, ready-check, and one whole-branch Claude code review. Verify the production candidate in Preview before deployment and record the current completion baseline for post-deploy comparison.

Complete when the implementation matches the reviewed artifact, no presentation fact becomes authority, PR 2 is recorded as the deployment rollback target, and production deployment remains separately unauthorized.

### PR 4 task 1 — Reconfirm later-verified products and activate directly

Consumes: the active frozen portfolio, current owner products, fresh PR 2 fit bundle, and guarded Routine successor/confirmation lifecycle.

Extend the Routine loader with a bounded product-review invitation projection: compare active-portfolio pending entries with owner products that are now matched, and derive their exact source decision keys. Show the reviewed prompt; Später preserves the active Routine and the read-derived invitation. Jetzt prüfen opens only those comparisons. Persist completed confirmations in a minimal owner/proposal-scope recovery envelope so a transient final activation failure is retryable without replaying product decisions.

After the final affected confirmation, call one product-review activation service/route. It reloads canonical plan/source, active portfolio, owner products, and current fit authority; validates every supplied semantic action; builds a successor portfolio and Routine server-side; stages it with `origin: product_review`; then accepts that exact proposal through the existing CAS. Expose pending proposal origin for lost-response recovery and suppress the ordinary successor sheet for `product_review`. Reconcile uncertain outcomes by reloading the Routine view: exact active candidate is success, a current pending candidate is retryable, a superseded candidate returns to fresh affected review. The active Routine pointer never changes on a partial failure.

Produces: explicit, bounded product re-review followed by a direct updated Routine with no second summary.

Add a narrow migration that excludes `product_review` from `last_rejected_auto_fingerprint` suppression while preserving suppression for `source_sync` and `acquisition`. This is safe only because the application service requires a fresh explicit affected-decision confirmation before using that origin.

Complete when service/component/browser/migration tests cover exact capturedProductId-to-decisionKey mapping, dismiss-and-return, one/multiple affected decisions, stale authority, suppressed automatic proposals remaining suppressed, product-review restaging after an earlier rejection, superseded proposal, lost response after acceptance, retry without decision replay, discard escape hatch, old-Routine preservation on failure, exact direct activation, and absence of the generic successor sheet for product_review.

### PR 4 task 2 — Verify the later-verification lifecycle

Run focused loader/service/route/migration/component tests, the authenticated Routine browser journey, CI, recovery fault injection, ready-check, and one whole-branch Claude code review. Verify the production candidate in Preview before deployment.

Complete when the implementation matches the reviewed prompt/direct-activation/error states, PR 3 remains a viable product rollback target, and production deployment/migration application remain separately unauthorized.

## Verification

### Automated

- Focused Node tests for recovery predicates, queues, gateways, routes, authority, comparison, portfolio, compiler, source reconciler, acquisition, components, flow, analytics, and completion.
- npm run test:personal-plan
- npm run test:playwright:personal-plan-stage3
- npm run bench:personal-plan-transitions
- npm run ci:verify

Use the repository server-only register and tsx import pattern for focused Node suites where required.

### Browser and fault injection

- 390px mobile and representative desktop.
- Normal save, 503 before save, response lost after commit, GET failure, one-resend failure, manual recovery, hot reload, concurrent tab, changed candidate, 429 countdown/automatic check, and completion replay.
- Product focus versus alternative switching versus persistence.
- Zero/one/three alternatives, supportive candidate, pending submission, analysis error, no-owned, optional uncovered confirmation, multi-product and Oil/specialist states.
- No-truthful-action fallback, retained-products accordion empty/closed/open states, and later-verification dismiss/review/direct-activation/retry states.
- Keyboard order, live regions, disabled navigation, non-color identity, reduced motion, no horizontal overflow, and unobstructed sticky CTA.
- Exact replacements and statuses through Routine/Anwendung and acquisition; retained owned products never create Routine/Anwendung items.
- A deployment rollback to PR 2 restores the complete old decision journey with canonical recovery and v3-safe readers.
- After PR 4, a Routine activated through `product_review` must still load under the PR 3 rollback code; the migration is additive and leaves source_sync/acquisition suppression intact.

### Rollout and observability

- PR 1: deploy recovery plus tolerant v3 readers; no v3 writer is active.
- PR 2: deploy server comparison/replacement and v3 writer contracts while retaining the old UI, which emits no replacement action.
- PR 3: verify in Preview, then deployment exposes the new journey to all eligible Stage 3 users; deployment remains a separate authorization.
- Record comparable journey-start-to-Routine baseline from the PR 2 events before PR 3 deployment.
- Immediate rollback to PR 2 for any ownership/product misassignment, v3 completion replay failure, or cross-decision acquisition.
- Fast tripwire: roll back if any rolling 24-hour window has at least 10 eligible review starts and zero Routine completions.
- Main evaluation uses consented analytics explicitly: evaluate when 50 consented eligible Stage 3 starts are observed or on day 14, whichever comes first. At day 14, record the sample size; apply the completion-rate threshold only with at least 20 starts, while warm p95/readiness and recovery-error tripwires remain active regardless. Roll back if review-to-Routine completion is more than 10 percentage points below the consent-matched PR 2 baseline, warm p95 readiness exceeds 3,000 ms, or save-recovery failure materially regresses.
- Operational counts: failure phase, response class, canonical recovery result, one-resend result, manual recovery entry, rate-limit wait, changed-authority reconfirmation, and completion replay.
- No duplicate save/success analytics when canonical reconciliation finds committed state.

## Review and handoff

- PR 3 planning worktree: /Users/nick/AI_work/hair_conscierge/.worktrees/personal-plan-stage3-fit-ui
- PR 3 planning branch: codex/personal-plan-stage3-fit-ui
- Refreshed base: origin/main at 032245c5 after PR 1 and PR 2 shipped.
- Source recovery worktree: preserved and unmodified.
- Source fit worktree: preserved and unmodified.
- Cross-plan decisions confirmed:
  - one master plan, four ordered PRs; PR 4 isolates the later-verification lifecycle from the core PR 3 redesign;
  - PR 1 behavior-preserving;
  - uncertain saves lock Stage 3 decisions;
  - changed candidates return to the refreshed comparison;
  - 429 resumes canonical recovery automatically after Retry-After.
  - no redesign feature flag; PR 3 is an all-user deployment with PR 2 as rollback.
- Final grilling decisions confirmed:
  - one pending-source decision projects both the pending submission and verified planned alternative;
  - Stage 3 writes use layered aggregate plus capture/reopen or decision budgets with actual Retry-After;
  - comparable journey start/completion telemetry begins in PR 2 before the redesigned UI;
  - acquiring one exact product resolves every already-approved Routine use of that product, never merely the first matching slot.
  - a true zero-action state says no alternative is currently available and returns to product capture;
  - retained owned products appear in Profile and a collapsed bottom-of-Routine disclosure, never as Routine/Anwendung items;
  - later product verification triggers a read-derived invitation; after affected choices are reconfirmed, the successor Routine activates directly with no second summary.
- Earlier counterpart review: three high-effort read-only passes completed for the consolidated PR 1–3 plan. A renewed high-effort read-only Claude review of the PR 3/4 addendum completed on 2026-08-13 with approve-with-revisions. Verified findings were incorporated: the invalid test command was removed, PR 3 execution was split into explicit stop-gates, Profile/Routine share one portfolio read, later verification moved to PR 4, exact pending identity uses capturedProductId, product-review suppression gets a narrow migration, discard recovery is defined, and rollout sampling is consent-matched and time-bounded. The claimed missing decision-key join was rejected after source inspection because `categoryResolutions.capturedProductId` provides the exact one-to-many mapping.
- Original combined evidence review: confirmed on 2026-08-12. Updated PR 3/4 evidence review: confirmed on 2026-08-13.
- Original designed-user-journey sign-off: confirmed on 2026-08-12. Updated PR 3/4 journey sign-off: confirmed on 2026-08-13.
- Artifact disposition after sign-off:
  - commit this plan and the combined mockup with PR 1;
  - keep the plan on main as PR 2 and PR 3's implementation contract;
  - archive or discard the two superseded untracked source plans/mockups only after the consolidated artifacts are safely committed and Nick authorizes cleanup.
- Publication boundary: planning approval does not authorize implementation, commit, push, PR, merge, deploy, migration, production write, or cleanup.
- Stop point: no implementation begins until the combined mockup has been reviewed, counterpart findings are reconciled, and Nick explicitly signs off the consolidated journey.

## Consolidation findings ledger

| ID  | Type                   | Evidence                                                                                                                                                       | Decision                                         | Plan change                                                                                                                                               | Revalidation                                            |
| --- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| R1  | scope/product          | Recovery plan removed grouped clear fits before the redesigned UI was ready                                                                                    | accepted user decision                           | PR 1/2 preserve behavior; PR 3 replaces the old journey for all eligible users                                                                            | PR 1 behavior tests and PR 3 absence tests              |
| R2  | architecture           | Legacy automatic Oil exists only in the current controller but is part of the failing journey and rollback release                                             | accepted                                         | PR 1 recovers it; PR 2 retains it; PR 3 deletes its caller and shows individual Oil decisions                                                             | Batch tests and PR 3 rg/browser proof                   |
| R3  | UX                     | Recovery's generic changed-recommendation card conflicts with the signed detailed comparison                                                                   | accepted user decision                           | Refresh same comparison, clear old candidate, show update notice, require fresh action                                                                    | Combined artifact and changed-candidate browser test    |
| R4  | safety                 | Back during unknown outcome can create a second intent                                                                                                         | accepted user decision                           | Lock Stage 3 decisions/navigation until canonical status is known                                                                                         | Component/flow/browser tests                            |
| R5  | reliability            | 429 supplies a server wait boundary                                                                                                                            | accepted user decision                           | Respect Retry-After, then automatic canonical read and at most one resend                                                                                 | Fake-timer gateway/flow tests                           |
| R6  | contract               | Recovery's older action/status table used one recommendation and Geplant; signed redesign uses selected replacement and Noch kaufen                            | accepted                                         | Signed redesign supersedes the old follow-up table                                                                                                        | Contract, portfolio, Routine tests                      |
| R7  | architecture           | Candidate selection and recovery both need stable semantic identity                                                                                            | accepted                                         | Pending intent stores action plus selectedCandidateId; server checks exact canonical resolutionAction/product/fingerprint                                 | Lost-response and stale-candidate tests                 |
| C1  | defect                 | Existing category queue is owner-scoped; first draft pending intent was not                                                                                    | accepted                                         | Add ownerId storage scope and clearOnLogout behavior                                                                                                      | Owner-switch/logout tests                               |
| C2  | defect                 | Route maps all Stage3AuthorityMutationError values to 400                                                                                                      | accepted                                         | Candidate-invalid alone becomes 409; shape/action errors stay 400                                                                                         | Route/gateway changed-candidate tests                   |
| C3  | defect                 | stage_not_ready and personal_plan_not_available do not carry latestDraft                                                                                       | accepted                                         | Add terminal 409/404 recovery exits                                                                                                                       | HTTP and flow tests                                     |
| C4  | defect                 | HTTP gateway discards status/header and flattens error codes                                                                                                   | accepted                                         | Error carries code, status, retryAfterSeconds parsed from Response                                                                                        | Gateway tests                                           |
| C5  | defect                 | choiceState reverse mapping would collapse select_replacement to plan_recommendation                                                                           | accepted                                         | Prefer persisted resolutionAction; legacy fallback only when absent                                                                                       | Mapper/completion tests                                 |
| C6  | defect                 | validateSelectedCandidate/buildAuthorityDecision only support evaluation.recommendation                                                                        | accepted                                         | Rebuild allowlist and persist exact selected full candidate/fingerprint                                                                                   | Candidate 2/3 tests                                     |
| C7  | defect                 | Portfolio version is derived and compiler hardcodes [1,2]                                                                                                      | accepted                                         | Define v3 emission, compiler [1,2,3], and legacy/new identity reconciliation                                                                              | Portfolio/compiler/acquisition tests                    |
| C8  | plan ambiguity         | Reviewer assumed Nicht verwendet needed a Routine availability state                                                                                           | corrected after source/plan inspection           | Retained products never enter RoutinePayloadV1; Profile and a separate Routine portfolio-context disclosure own the label                                 | Profile/Routine surface and no-Routine-item tests       |
| C9  | rollout defect         | A global copy rename would alter existing v1/v2 plans                                                                                                          | accepted                                         | New copy derives only for v3/resolution-action items                                                                                                      | Legacy/new Routine UI tests                             |
| C10 | defect                 | reconciled marker, completed draft, GET rate-limit invariant, and early-return diagnostics lacked exact consumers/guards                                       | accepted                                         | Name shared consumers and add route/completion tests                                                                                                      | Focused route/flow tests                                |
| C11 | scope                  | Reviewer proposed adapter-level select_replacement allowedActions                                                                                              | rejected                                         | Voluntary replacement remains a gateway candidate-allowlist carve-out; category adapters keep authority-required actions only                             | Gateway/adapters regression tests                       |
| C12 | evidence               | Combined mockup omitted downstream statuses and uncovered confirmation                                                                                         | accepted                                         | Add Noch kaufen, Nicht verwendet, Mit Einschränkung, and skip confirmation evidence                                                                       | Nick evidence review                                    |
| C13 | product/rollout        | Review asked whether to retain a redesign flag                                                                                                                 | superseded by user decision                      | No redesign flag; Preview verification then all-user PR 3 deployment, with PR 2 rollback                                                                  | Deployment plan and browser verification                |
| C14 | defect                 | select_replacement was rejected by the ordinary allowedActions guard and could fall through to unassigned                                                      | accepted                                         | Name production/fixture carve-out and exhaustive planned_purchase/recommendation mapping                                                                  | Direct gateway and mapper tests                         |
| C15 | rollback defect        | PR 1 compiler could not replay a frozen v3 portfolio after PR 3 rollback                                                                                       | accepted with user decision                      | Three PRs; PR 1 ships tolerant v3 readers/compiler/source/acquisition before PR 2 writes v3                                                               | Frozen-v3 replay under PR 1 code                        |
| C16 | defect                 | Existing stage3_authority_candidate_invalid is also used by category capture                                                                                   | accepted                                         | New stage3_replacement_candidate_invalid is replacement-only; capture remains 400                                                                         | Route tests for both mutation families                  |
| C17 | defect                 | Queue attempt limit, completion_not_ready, separate completion limiter, closed error union, multi-chunk batch semantics, and analytics ownership were implicit | accepted                                         | Add explicit queue retryAt, completion contract, widened error union, per-chunk recovery, and typed event owners                                          | Queue/complete/route/analytics tests                    |
| C18 | architecture tradeoff  | categoryResolutions lacks frozen product display identity for a derived Nicht verwendet surface                                                                | accepted                                         | Keep explicit retainedOwnedProducts array and document why UI-only derivation is insufficient                                                             | Portfolio/profile tests                                 |
| C19 | scope tradeoff         | reconciled marker added wide shared-contract churn without different client behavior                                                                           | accepted                                         | Drop public marker; retain internal reconciliation metric                                                                                                 | Route/gateway/analytics tests                           |
| C20 | scope defect           | Catalog query already has a literal 12-row cap                                                                                                                 | accepted                                         | Export and reuse that existing limit instead of adding a second constant                                                                                  | Catalog/selector tests                                  |
| C21 | contract ambiguity     | Current portfolio projection returns after one branch, so a pending source plus planned replacement could disappear                                            | accepted by Nick                                 | Keep one decision carrying pending captured identity plus selected recommendation; independently emit both pending and planned projections                | Draft/portfolio/compiler tests                          |
| C22 | identity defect        | Compiler takes the first category/role planned match and source reconciliation takes the first productId match                                                 | accepted by Nick                                 | Resolve v3 compilation by sourceDecisionKey; product acquisition resolves every already-approved use of that exact product/category, never just the first | Same-role/same-product acquisition tests                |
| C23 | type defect            | Widening the authority action union also widens stage3-decision-projection.ts                                                                                  | accepted                                         | Move its exhaustive select_replacement handling into PR 2 while keeping the old UI unable to emit it                                                      | PR 2 typecheck and projection tests                     |
| C24 | recovery defect        | In-memory retry attempts reset on hot reload                                                                                                                   | accepted                                         | Persist minimal attempt count/window in the owner-scoped recovery envelope                                                                                | Reload/fake-timer tests                                 |
| C25 | rate-limit tradeoff    | Per-product saves can compete with capture under the current shared 30/60 budget; 429 hardcodes 60 despite an existing fixed-window helper                     | accepted after senior-engineering recommendation | Use a coarse 90/60 aggregate plus 30/60 capture and 60/60 decision budgets; return the real fixed-window remainder                                        | Route/load tests and production-shaped count validation |
| C26 | rollout tradeoff       | PR 3 introduces its own completion signals, leaving no directly comparable pre-redesign baseline                                                               | accepted by Nick                                 | Land stable journey start/Routine-opened events in PR 2 and retain them in PR 3                                                                           | Analytics tests                                         |
| C28 | ownership semantics    | Fresh main still emits a product-keyed acquisition event, so first-match reconciliation is ambiguous when one product fills two approved slots                 | accepted by Nick                                 | Treat ownership as product-wide and resolve every already-approved planned use of the acquired exact product/category; add no clicked-slot migration      | Same-product multi-role acquisition tests               |
| C27 | contract defect        | Production completion HTTP converts internal not_ready to 409, making the client success-union arm unreachable                                                 | accepted                                         | Split internal completion result from HTTP success and recover through typed completion_not_ready                                                         | Gateway/flow/completion tests                           |
| C29 | UX fallback            | A bounded comparison can truthfully yield no alternative and no permitted fallback                                                                             | accepted by Nick                                 | Show Keine passende Alternative verfügbar.; return to product capture; keep the role unresolved                                                           | Zero-action component/flow/browser tests                |
| C30 | information hierarchy  | Retained owned products should remain available without becoming core Routine content                                                                          | accepted by Nick                                 | Keep Profile status and add a collapsed bottom-of-Routine disclosure, omitted when empty and excluded from Anwendung                                      | Closed/open/empty and no-item tests                     |
| C31 | lifecycle architecture | Product verification is a new fact, while direct Routine mutation would skip user consent and a second summary would duplicate that consent                    | accepted by Nick                                 | Detect from active portfolio vs owner product; reconfirm only affected decisions; server builds/stages/confirms successor and opens Routine directly      | Re-review, CAS, lost-response, and old-active tests     |
