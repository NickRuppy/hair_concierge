# Stripe trial projection cleanup

The unused retrieveVerifiedStripeTrialAuthorization wrapper projected the live retrieveStripeTrialAuthorizationEvidence result to authorization/null. Source deletion is supported by exact caller closure, the actual account-admission use of the canonical evidence object, and history 318cf157/90021157. The canonical provider retrieval and verifier stay.

All four affected existing declarations are retained and retargeted to the real canonical owner. Positive authorization assertions now inspect evidence.authorization; provider read order/expansions, cross-customer and unresolved setup denial, and provider outage propagation remain intact. The existing read-order keeper additionally verifies the returned session/subscription identities. No validation or fake authorization helper was added. This earns zero declaration credit.

Native authorization file: before 11/11, after 11/11. The first after invocation supplied a nonexistent sibling filename and executed only that file; no sibling proof is inferred from it. Corrected actual four-file authorization/account-activation/continuation/reconciliation run passes 53/53. No Stripe/network/provider operation occurred. Full aggregate checks follow the integrated layer.

Main rejects the proposed creation-wrapper transfer that copies validation/readback into a new test helper: it would prove test code. Enrollment/storage adapters remain untouched pending a real-owner transfer.
