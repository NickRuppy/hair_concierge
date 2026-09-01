# Nivea conditioner protocol ready-check receipt

- Branch: `codex/nivea-conditioner-protocol`
- Base: `a138c860` (Balea protocol plus oil V2 authority reconciliation)
- Functional content fingerprint: `6f835da511be5d95c5550cee4858052116043b3a70460a43817eafbe07eac49d`

The fingerprint covers the sorted path-and-content-hash manifest for the eight Nivea protocol, generated-artifact, evidence, test and review files. These final receipts are excluded from their own fingerprint.

## Outcomes checked

- The existing curated Nivea Volumen & Kraft conditioner row receives one exact `conditioner_rinse_out` protocol and one derived V2 product pointer.
- Exact package identity remains bound to GTIN `4005900918031`; the EAN page is represented honestly as identity evidence only.
- The persisted protocol source now points to an exact 200 ml EU retailer page that explicitly supports damp-hair application, lengths while avoiding roots, 2–3 minutes and thorough lukewarm rinsing. A second exact-product retailer independently corroborates the complete sequence.
- No cadence is inferred. The old frozen research row stays unchanged and the current disposition must still match exactly before resolution.
- The regenerated V2 artifact contains 309/309 composable rows, 42 conditioners and zero blockers. Its durable HTML review artifact and all count/fingerprint invariants were refreshed.

## Fresh verification

- `npm run test:personal-plan-stage5` — 282/282 passed.
- Focused protocol/disposition suites — 12/12 passed.
- `npm run personal-plan:application-audit` — 309/309 composable, zero blockers.
- `npm run typecheck` — passed.
- `npm run lint` — zero errors; five pre-existing repository warnings.
- `git diff --check a138c860` — passed.

## Release gate

This branch is prepared and locally verified, not applied. Production order remains: prerequisite PR #496, Nivea protocol batch, regenerated V2 artifact, exact disposition resolution, then scanner E17. Every production write remains behind its explicit reviewed-head, fingerprint and project confirmation gates.

