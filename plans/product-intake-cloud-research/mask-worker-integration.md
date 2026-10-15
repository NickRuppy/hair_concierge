# Mask worker integration

## Outcome, authority and decision coverage

Execute step 3 of the approved completion checklist: future Mask research uses
locked Mask Standard v1.0 and its existing deterministic adapter, retaining the
complete research and producing exact current catalog values. No catalog write,
matching change, research-method change, historical rewrite or backlog retry.

Decision coverage: **confirmed for this backend slice**. Original authorization:
Nick requested execution of the eight-step setup checklist. In this chat he
confirmed moderate/high conditioning → `detangling_slip`, with no repair or
finished-product efficacy upgrade. The adapter already implements that ruled
baseline; the living README's pending-ruling note is stale. UI approval and exact
product publication remain separate, and do not block this backend preparation.

Internal revalidation: current `category-research-router.ts` marks Mask
unavailable; canonical-INCI extraction does not recognize Mask envelopes.
`mask-research/production-adapter.ts` and frozen calibration already provide the
pure projector, strict method/formula/echo-field gates and deterministic output
hashes. Mask README and bridge identify the missing runbook/worker wiring.

Routine defaults: reuse the existing adapter and router extension points;
current envelope and frozen standard/lexicon pins stay unchanged. A new
operational runbook references their normative sections and introduces no
classification threshold. The new prompt carries exact file paths and requires
reading the standard and lexicon before classification. Frozen files stay byte
identical. No new UI or data migration is needed for this slice.

Undiscussed consequential assumptions affecting this handoff: none.

## Implementation

1. Add `docs/research/mask-inci/v1.0/runbook.md`: exact identity/formula and sourced
   directions, G0 stop outcomes, blind packet/hash, formula-first analysis, narrow
   unblinding, complete research record plus projection envelope, deterministic
   replay, human review triggers, and explicit stop before publication. Link
   existing authority for thresholds instead of duplicating rules.
2. Add `mask-research-prompt-contract.ts` and `mask-research-adapter.ts` under
   `src/lib/product-intake/`. Require exactly one Mask envelope carrier per
   result; project it through the current pure adapter. Before mutation reject
   wrong submission identity, stale method pins, incomplete/invalid formula,
   G0 stop/exclusion, unknown projected fields and a missing complete research
   carrier. Preserve the submitted envelope and complete record unchanged.
   Two distinct sibling payload keys are required: `mask_research_envelope`
   (the unchanged strict version/researchMethod/identity/formula/profile schema)
   and `mask_research_record` (the complete durable record; NEVER inserted into
   or passed as the strict envelope). The complete record uses existing frozen
   Mask record vocabulary: standardVersion,
   productId, identity.rawInciSha256, directProperties, profile, tailMarker,
   aboveTailSegment, bondRoute, hinweise, blindToFinalChanges, reviewTriggers.
   Bind standard/product/formula and profile values to the envelope; require the
   direct-property inventory and review/trace sections. This is a transport
   completeness guard, not a second classifier or proof of factual truth.
3. On successful projection overwrite only `final.product.suitable_thicknesses`, `final.category_specs.product_mask_specs`
   and adapter-owned `final.field_rationales`, deleting stale roots and
   indexed/dotted descendants. Preserve price, identity, protocol and other
   category data. Add projection/warnings/omitted fields/required protocol roles
   to the existing property_synthesis artifact, using the worker-required
   `mask_production_projection` key for the projection and its existing
   `research_input_sha256` / `projection_sha256` fields for server provenance. Any blocker leaves final payload
   unchanged and never stamps a successful projection.
4. Register Mask as active using existing server-owned v1.0 method/adapter pins.
   Replace the legacy flat `maskApprovalContract` that instructs the model to
   hand-author catalog specs; do not append contradictory envelope instructions.
   The prompt requires the envelope + complete carrier, forbids model-authored
   projected fields/protocol rows, uses sourced draft.protocol, and reports
   review-only traces without treating them as catalog fields. Add Mask envelope
   extraction to the canonical-INCI stage so the real worker path uses the same
   exact raw INCI and canonical fingerprint as the adapter.
5. Update living Mask README, bridge and engine skill routing to describe the
   new runbook and code state honestly: integrated code is not a deployed worker
   or an approved product. Preserve offline historical replay and frozen pins.

## Verification and activation boundary

Extend the router/normalization owner tests, with a hand-checked real calibration
projection and independent expected catalog literals. Prove red against current
unavailable Mask routing, then green after wiring. Assert real normalizer output:
Mask provenance/input+projection hashes, exact catalog fields, canonical-INCI
source, trace preservation, protocol boundary and no auto-publish. Cover wrong
submission, duplicate/missing carrier, stale pins, unknown/inconsistent echo
values and missing trace; failures must not mutate caller final payload.

Keep existing pure-adapter and calibration tests as their respective owners; do
not re-test every threshold in the worker wrapper. Re-run the 52-output router
characterization with expected Mask behavior changes explained (legacy Mask
outputs without the newly required envelope become blocked, rather than falsely
claiming engine research). Run focused checks through the shared launcher, final
lint/typecheck once, required hosted CI and read-only Claude branch review.

Deploy only after the migration/runtime prerequisites, host resource controls
and exact reviewed-head gates pass. No blocked job is implicitly requeued. The
first real engine cohort and every product publication remain explicitly gated.

## Artifacts

Commit this plan, runbook, integration, tests and synchronized living guidance.
Keep transient counterpart output in /tmp and discard after disposition is
recorded. Keep private queue/research data and host preservation manifests off
Git. Sanitized retention receipt belongs to the overall completion work.

## Counterpart review disposition

Claude read-only/high: approve with revisions (2026-10-15). Accepted: explicit
worker artifact keys and replacement of the contradictory flat prompt; name the
engine-binding test change. Clarified the envelope versus full-record boundary.
The claimed wrong field vocabulary is rejected as a factual blocker: those
fields are the existing `reference-key-v1` research-record carrier, intentionally
a sibling of the strict envelope; they are not added to the envelope. The review
correctly exposed that the distinction needed clearer wording. The suggested
`final.suitable_thicknesses` target is rejected: the actual intake shape and
existing conditioner/leave-in adapters use `final.product.suitable_thicknesses`.

Owner decision: release-level rollback, matching current engine precedent and
Nick's confirmed one-verified-rollback retention policy; no Mask-specific flag
in this slice. No production switch or implicit retry is authorized by local
code completion. The bounded cohort/activation gate still controls the release.
Runbook is written now with procedural links to the locked standard; no method
threshold duplication. This introduces no new unresolved product decision.
Report: `/tmp/intake-mask-plan-review-20261015.md`; discard after disposition.
