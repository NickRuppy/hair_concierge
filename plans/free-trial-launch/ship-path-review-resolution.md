# Ship-path review and implementation disposition — 14 September

Nick canceled the isolated live PayPal experiment and asked to ship. The app form was closed without submission; no test app or agreement was created. The full approved contract remains controlling. The optional card-only/native-renewal alternative has not been accepted.

The read-only advisory pass used the repository Claude bridge with Opus 5 and high effort, no fallback. It assessed an intermediate, changing tree; it is not a whole-branch approval or release receipt. Temporary output: `/tmp/free-trial-ship-path-claude.md`. Retain only this parent disposition with the PR; discard the temporary review output after integration.

| Finding | Parent disposition |
| --- | --- |
| First payment can succeed after the source invoice period begins, leaving renewal dates misaligned | Verified. The ledger now fulfills the full paid period and separately persists continuation repair work. An actual provider repair consumer is still missing; this remains a release dependency. |
| Private reconciliation cases have no operator reader | Addressed with a service-role-only paged RPC and read-only CLI, omitting customer details, accepted offers and provider payloads. No provider repair is implied. |
| PayPal trial button reaches an unavailable response | Verified. Durable attempt creation and binding are being implemented, but initial authorization, activation and payment integration remain unwired. |
| Authenticated trial cancellation has no UI caller | Addressed through the profile membership component, exact accepted terms, durable declaration, provider-pending acknowledgement and download. An expired member now reaches management on `/reactivate`, without private routine reads or legacy checkout. |
| Required public declaration receipts lack a schedule | Addressed in `vercel.json`, every five minutes. Template configuration, verified delivery and the authenticated receipt lane remain incomplete. No email was sent. |
| One-time and waitlist retirement need another owner decision | Rejected: Nick already explicitly retired both. Keep historic fulfillment and stored records. |
| Automatic conversion and coupon behavior lack live proof | Remains an evidence limit. Do not reintroduce the canceled live experiment, manufacture a passing result, or use existing customers as fixtures. |
| Smaller card-only launch/native automatic billing dates | Optional product/scope alternative presented to Nick; no answer. Do not adopt it silently or treat no live testing as approval to change providers, timing, restoration or recovery. |
| Migrations and production configuration are unapplied | Verified. No production release is claimed. |

Independent of the smaller-launch choice, the parent connected the profile browser checks to both CI-invoked browser projects and added the required public receipt schedule. Existing manual/legacy subscriptions remain outside the new trial management path.

Outstanding full-scope work: initial PayPal checkout/authorization/activation/payment handling; provider continuation adjustment and first-payment recovery; restoration and interval changes; never-trial reactivation eligibility; required delivery and public declaration matching/action operations; current-base integration, schema rollout and final release verification/review. This list is implementation work, not a request to repeat the product interview.
