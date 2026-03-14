# Profile Learning Loop Backlog (Cross-Category)

Status: Backlog (parked)
Owner: Product + AI Eng
Scope: Cross-category profile enrichment from chat behavior and explicit user statements

## Why This Exists

Current recommendation quality depends on profile completeness and freshness. Onboarding captures a strong baseline, but user realities change over time (new treatments, routines, preferences, reactions). We need a general learning loop that improves profile quality across all categories, not logic embedded in one category path.

## Current State

- Chat pipeline already runs a post-response async extractor for unstructured memory (`conversation_memory`).
- Profile updates happen mainly via onboarding/profile edit APIs.
- There is no structured, audited, chat-driven updater for concrete `hair_profiles` fields.

## Goals

- Keep `hair_profiles` updated from trustworthy user-provided chat signals.
- Improve recommendation precision without category-specific hacks.
- Preserve safety and trust: explicit evidence, validation, and auditability.

## Non-Goals (Initial)

- No silent overwrites of high-confidence onboarding diagnostics without explicit user confirmation.
- No category-specific learning logic in shampoo/conditioner/mask branches.
- No real-time blocking writes in request-critical path.

## Recommended Architecture

1. Trigger point:
Run post-response as fire-and-forget in chat API, next to memory extraction.

2. New module:
Add `extractProfileUpdates(conversationId, userId)` to parse recent user turns into a typed `ProfileUpdateProposal`.

3. Validation layer:
Whitelist updatable fields and validate proposal values against existing vocabulary/enums before write.

4. Persistence:
Apply conservative patch updates to `hair_profiles` with explicit merge rules per field type.

5. Audit:
Store every attempted/applied update in an audit table with:
`user_id`, `conversation_id`, `field`, `old_value`, `new_value`, `evidence`, `confidence`, `applied`, `reason`.

6. Safety policy:
Only apply if confidence threshold is met and user statement is explicit (not inferred from assistant text).

7. Observability:
Emit structured events for proposal count, applied count, rejection reasons, and per-field drift.

## Suggested Data Contracts

- `ProfileUpdateProposal`:
`updates: { field, value, confidence, evidence }[]`
- `ProfileUpdateResult`:
`applied[]`, `rejected[]`, `errors[]`

## Phased Rollout

Phase 1 (Read-only):
- Extract proposals and write only to audit log (`applied = false`).
- Review precision/recall on sampled conversations.

Phase 2 (Low-risk auto-apply):
- Auto-apply low-risk fields (preferences/routine context) with strict confidence thresholds.

Phase 3 (Guarded diagnostics):
- Introduce confirmation flow for sensitive diagnostic fields before overwrite.

Phase 4 (Behavioral loop):
- Add explicit UI feedback signals (like/dislike/click/useful) and blend with chat extraction.

## Open Decisions for Future Workstream

- Field-by-field overwrite policy (append vs replace).
- Confidence thresholds by field type.
- UX for user confirmation on sensitive profile changes.
- Retention and privacy policy for audit evidence.

