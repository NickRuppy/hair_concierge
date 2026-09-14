# Trial admission persistence

14 September 2026. Local implementation under plan revision 1.3, with synthetic-data verification only. No production migration, real claim write, checkout caller or entitlement consumer is enabled by this slice.

## Stored facts and boundaries

- `trial_enrollments` holds the server-issued checkout attempt UUID, nullable profile link, provider, original accepted offer, admission state, immutable original authorization/end, and separate paid/grace/cancellation facts. Account creation can follow authorization through the existing flow. A row alone grants nothing.
- `trial_identity_claims` holds whitelisted identity HMAC, namespace, key version, nullable enrollment link and consumed timestamp. Profile deletion does not remove consumed claims; lawful rights handling remains a separate mandatory dependency. There is no automatic expiry or guessed retention period.
- `billing_subscriptions.trial_enrollment_id` is additive and initially null for all existing rows. Once set, a routine update cannot clear/reassign it; a linked enrollment cannot be deleted while that billing row remains. This prevents accidental reclassification into legacy access semantics. No existing subscription state is rewritten.
- All new tables have RLS and no anonymous/authenticated grants. RPCs are invoker functions with an empty search path and explicit service-only execution. These are internal persistence operations, not public authorization endpoints.

## Admission transitions

1. The trusted caller validates lead/account ownership, existing access, current offer/catalog and verified identity before persistence. The HMAC adapter accepts already-normalized identities; it does not infer verification or normalize provider fingerprints. It derives all supplied retained key versions. Rotation must preserve every still-lawful matching key.
2. Create an attempt using its stable UUID. Retrying the same UUID compares the original offer/provider/user instead of overwriting them. Reserve known identities before provider authorization starts.
3. The admission RPC locks the attempt, then the complete identity tuple set in canonical advisory-lock order. Unique claim keys and a post-insert ownership check provide a further guard. A conflict writes no partial new claims. Earlier reservations remain unconsumed until provider reconciliation permits release.
4. After authoritative provider reconciliation, activation supplies the same attempt, all reliable claims, provider agreement and authorization instant. One transaction consumes its claims and records exactly 604800 seconds of trial. Authorization is not recorded as revenue.
5. An exact activation replay returns the existing active state. A changed deadline/agreement or a new identity on an already-active replay cannot restart or extend it. Later identity/key reconciliation will need a separate controlled path; an activation replay is not that path.
6. A losing or previously released attempt cannot acquire access through a late callback. A late agreement is recorded with `neutralization_required` for provider reconciliation. That marker is a durable obligation, not proof that cancellation happened. Provider adapters/workers remain outstanding.
7. Release requires a trusted provider reconciliation reference and cannot release an active/consumed trial. There is no timeout-only release. A late callback after release may require another reconciliation, while the attempt stays released.

## Required integration, still outstanding

- Actual provider evidence and cancellation/neutralization execution, including lost responses and overlapping/late collection; immutable provider clock proof remains T0.
- Privacy clearance, effective disclosure, retention/end criteria and operational correction/restriction/erasure across every linked claim. Event replay must not reconstruct lawfully erased/restricted claims. This schema has no rights-disposition implementation yet and must not be connected to real writers before that dependency is completed.
- Full account ownership/eligibility admission against existing membership and manual/one-time access, including concurrent legacy writers. Internal RPC access is not a substitute for those checks.
- Safe account linking, paid-event persistence and application access projection. No production caller currently imports the new admission module. Existing legacy access logic has not changed.
- Real multiple-connection PostgreSQL race tests and full migration-chain/advisor preflight. PGlite runs actual SQL but has one connection; sequential conflict cases are not a concurrency proof.

The [independent launch checks](independent-launch-checks-2026-09-14.md) retain current tax/privacy/provider gates. Their completion as research is not activation clearance.
