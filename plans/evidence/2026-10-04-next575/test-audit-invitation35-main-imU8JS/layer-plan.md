# Discovery invitation boundary — conditional renderer consolidation

At HEAD `21e0e41fa996ec6a725c258ab3766971f0edb94d`, repository read-only. No owner/test execution, environment-file access, browser, provider, SQL or remote operation occurred.

## Scope and completed reading

Requested five-file intake/claim/application cohort still counts 163 AST declarations (37/36/26/34/30). `/tmp/test-audit-discovery-intake-complete-ledger.md` already records full bodies and owners,163R. `/tmp/test-audit-discovery-intake-layer-ledger.md` and `/tmp/test-audit-discovery-cutover.md` record earlier removed redundant intake declarations. `/tmp/test-audit-discovery-ui-layer-next.md` also covered claim/application. These are reused evidence, not 163 newly completed reads.

Nearest coherent unclosed boundary chosen and announced: admin-invites API11, CLI9, enrollment-token4, invitation-card11. Every callback/helper/table in all four files read in full. Current verdict **32R/1F/2conditionalC/0D**. Nothing retired; proposed35→35transfer→33cut, all native Node. Machine ledger includes each exact body/title/line/hash and individual credible regression.

Full owner reading: admin invite route, scripts/discovery.ts (including reconciliation code, no extra test credit), enrollment service, token, invite-link, participant, flag, invitation client, continuation, both page entrypoints, require-admin, Button, utils, motion-loader/motion, Node server-only preload. Current callers searched for both projection adapters, shared URL owner and invitation/continuation components. Admin page caller found at :141; no claim of full admin page or full claim-route reread. Database drivers, crypto/React/dependency implementation internals were not re-audited; no new dependency guarantee is inferred. The exact proposed SSR assertion transfers do not alter dependencies, rendering calls or inputs.

Read runbook invitation/config sections (`docs/discovery-call-runbook.md:13-111,470-485`), motion-plan matching policy paragraphs, relevant git history plus full invitation-test patch in `feb9284c`; remaining runbook is navigation only. Current CLI is explicitly the supported alternative to admin, not a retired package registration: runbook33-98 gives create/list/rotate/revoke and all four production-write guards. `2a1f3add` introduced optional email/admin management; `c315601d` established toolkit; `feb9284c` introduced no-flash/minimum invitation loader. No usage telemetry/environment enabled-state claim. Page kill-switch and runbook establish support irrespective of current deployment flag.

CI `package.json:49` native glob includes all four files; `.github/workflows/ci.yml:158` invokes it. `package.json:39` binds supported CLI with server-only preload. Tests inject gateways and the CLI main guard prevents its dotenv/provider entry during import; commands below execute tests only.

## C1: CTA-only renderer declaration

Donor `tests/discovery-invitation-card.test.tsx:43`, `the invite CTA uses the coral funnel CTA, not plum`.
Keeper :62, `the invite always shows an editable e-mail field, prefilled when the admin entered one`.
Donor and keeper's existing `prefilled` render use exactly `email="lea@example.test" mode="ready" name="Lea Sommer"`, with identical omitted props. Carry both literal assertions, coral present and plum absent, to `prefilled` after its existing label assertion. Keep all input attributes/default/editability checks and the second empty render. No new fixture/input/call/table row. This is consolidation at the same actual renderer boundary, not claiming a more complete browser boundary.

Owner: DiscoveryInvitationCard ready branch→InvitationForm→actual Button variant funnelCta→cva/cn→SSR. Wrong variant or extra plum class must fail retained assertions. Controls: unique actual InvitationForm Button change funnelCta→unstyled (positive color); add before:bg-[var(--brand-plum)] while retaining coral (negative-color oracle independently). These intentionally target class output, not computed browser color.

## C2: ready fade renderer declaration

Donor :108, `the ready card fades its content in`.
Same keeper's existing `empty` render :71. Donor has empty email, ready mode, name Lea; keeper has empty email, ready mode, name Lea Sommer; all remaining props omitted. Actual readset: Card never branches on name; forwards it to InvitationForm; its only read is `name.trim().split(/\s+/)[0] || name`, both resolve to literal Lea. No name-based animation/style predicate. Outer CONTENT_FADE_IN is unconditional for the ready branch. Thus full observable rendered input relevant to donor's sole assertion is equivalent; this is not raw-name equality.

Carry exact original motion-safe animation-prefix regex onto `empty` after its existing Los geht assertion. Leave name/input/render unchanged. Actual-source control removes CONTENT_FADE_IN string; exact transferred match must fail. No new input/call/table row.

## Rejected expansion / retained risks

- Admin-vs-CLI URL equality is correlated through buildDiscoveryInviteUrl, but separate adapters read different input shapes. An adapter-only tokenVersion offset is a real cross-entry defect; CLI printed receipt does not independently decode ID/version. No complete input/assertion union presently justifies deleting this whole declaration. Retain; no arbitrary shared-helper-is-vacuous rule.
- Direct CLI gate matrix has wrong-confirmation and missing-URL branches absent from dispatcher refusal matrix. Copying those inputs into keeper would violate this task's no-new-input rule. Retain whole callback. Parser/status assertions likewise retain branches missing in facade outputs.
- Mocked rotate/revoke supply their service result. They still observe real HTTP dispatch, status/error mapping and projection. They do not independently prove CAS/version storage or stamp clearing; titles overstate that aspect, but neither is wholly fixture-only. No database/storage test deletions proposed.
- Other-refusal hint omission has truthy error and absent hint. Ready/noerror render bypasses the nested error branch, so it is not an equivalent negative input.
- HMAC determinism, malformed signed-token handling, foreign/short secrets and invalid projection payload remain independent security boundaries.
- No support/source seam becomes unused. Keep every import/helper/fixture. Only two complete renderer callbacks removed after transfer proof.

## F1 (hold; zero quota and excluded from snapshots)

Loader test at :176 executes actual useDelayedLoader/client through a small React hook dispatcher and fake timers; it observes 300ms delay and remaining500ms minimum. Its function.name==InvitationLoading detector fails an identifier-only rename. Repair could capture initial tree.type and compare stable element identity on held renders, retaining showText false/true,400/799ms hold and800ms final DiscoveryInvitationCard identity. Do not delete contract or claim SSR minimum timing. This repair is separately reviewable; current prospective transfer/cut leave callback byte-identical. Existing hook-dispatcher/private React API maintenance risk remains.

## Artifacts and validation gates

`...-ledger.{md,json}` full35; `...-candidates.json` full donor and keeper before/after bodies; `...-manifest.json` root/HEAD25readset hashes and phase hashes; `...-{before,transfer,cut}.tsx` complete prospective test snapshots; `...-transfer.diff` and `...-cut.diff`; `...-controls.json` three unique-source-anchor descriptors. Prefix `/tmp/test-audit-discovery-intake-claim` throughout. Generator only writes tmp, imports TypeScript parser, never product modules. All four original test strings and changed phase strings parsed.32unrelated callbacks byte-identical; aftercut33 includes one augmentedkeeper. Zero added declarations/render calls/inputs.

Main should review/guard current hashes before any write, baseline35, transfer35, apply3serial source faults selectedkeeper then restore exact bytes, cut33, rerun focused cohort and campaign coverage. No guarded repository-writing editor supplied/needed yet; these are reviewable snapshots and descriptors only.

From task root, before/transfer/cut focused native command (same files each phase):

```sh
node --import ./tests/server-only-register.cjs --import tsx --test tests/discovery-admin-invites-api.test.ts tests/discovery-cli.test.ts tests/discovery-enrollment-token.test.ts tests/discovery-invitation-card.test.tsx
```

Selected retained keeper for each intended source control:

```sh
node --import ./tests/server-only-register.cjs --import tsx --test --test-name-pattern='^the invite always shows an editable e-mail field, prefilled when the admin entered one$' tests/discovery-invitation-card.test.tsx
```

Require exact selected1pass→intended assertion red (not module/harness failure)→byte restore→1pass. Count skipped siblings separately; no runtime result claimed. Campaign coverage threshold remains main's independent <=2pp gate. No large obsolete invitation layer was found; supported conditional count is exactly2, not a target estimate.
