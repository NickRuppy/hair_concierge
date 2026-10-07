# Billing trial210 declaration ledger

Root: `/Users/nick/AI_work/hair_conscierge/.worktrees/test-audit-pruning`. HEAD `21e0e41fa996ec6a725c258ab3766971f0edb94d`, branch `codex/test-audit-pruning`.

**210 AST declarations in 31 current test files: 205 R, 2 F, 3 conditional C, 0 D.** Every callback, table row, helper and fixture in these 31 tests was fully read. All 210 full callback bodies and original hashes are in `test-audit-billing-trial210-ledger.json`. R means retain: no complete safe replacement was established; it does not certify every transitive SQL/SDK implementation as audited.

A second-layer comparison challenged direct policy versus projection versus stored projection; mocked admission readback versus actual SQL readback; notice builders versus dispatch/templates; management/recovery DTOs versus SQL operations; provider history versus CLI; and lifecycle event generation versus delivery. It yielded exactly the three candidates below. No assertion-free or fixture-only whole declaration was established. The detailed source-read limits are in `test-audit-billing-trial210-read-scope.json` and the layer plan.

Counts are AST sites, not expanded test executions. In particular the existing lifecycle provider loop has one declaration and two provider executions. No table regrouping is proposed.

| File | R | F | C | Total | SHA256 |
|---|---:|---:|---:|---:|---|
| tests/billing-trial-required-notices.test.ts | 14 | 1 | 1 | 16 | `25aecfc553d2da2644647cfd84c59191315f315199fface654076532d07d13c8` |
| tests/billing-trial-admission-postgres.test.ts | 13 | 0 | 1 | 14 | `8d93d7fd495017bf38594450300a4a4483ca4bbeb932781c12409614c329a5f1` |
| tests/billing-trial-payment-events.test.ts | 14 | 0 | 0 | 14 | `b921857dbe62edcd1c13d2c0654fec7341d4e86b99100f1bb98407756f07acae` |
| tests/billing-trial-identity-rights.test.ts | 12 | 0 | 0 | 12 | `78b4b162ab52aaf1572d50efa9b523e72f14c4fc64582f78fb1bd95f396856ed` |
| tests/billing-trial-policy.test.ts | 10 | 0 | 1 | 11 | `93d6967667e8348c3643e720a235455d3ef27b11d43da3fe8ad79dd8fdeefabb` |
| tests/billing-trial-lifecycle-analytics-postgres.test.ts | 10 | 0 | 0 | 10 | `907a695e40b2e1c1ecebecce3b44a484460f3d3aecdfd645eca69f5434d26d33` |
| tests/billing-trial-management-postgres.test.ts | 10 | 0 | 0 | 10 | `1821b56e6585914d50dcce8f558fdcd1c0fa68495d4b30cddafcf33166722eba` |
| tests/billing-trial-access-postgres.test.ts | 8 | 0 | 0 | 8 | `903dc6506821e3794867d3539fd41dfd2d8f001dd951267efba6ef281f10c130` |
| tests/billing-trial-cancellation-reconcile.test.ts | 8 | 0 | 0 | 8 | `d22fa6014c3804485185b15cc06f9b9be8a8358ff538a8d62edd99a03727c8ed` |
| tests/billing-trial-offer.test.tsx | 8 | 0 | 0 | 8 | `4e0f44a1821d12517f85a00198c0dc0d3252b5a2b5ba3bb482db9c9c955d42f4` |
| tests/billing-trial-paid-recovery-postgres.test.ts | 8 | 0 | 0 | 8 | `e4015a5afb5ebc958cc664c05aafa6d9b3674e7f32aad3d4c43d44feb73f8be7` |
| tests/billing-trial-management-route.test.ts | 7 | 0 | 0 | 7 | `c05a7ba3a478a2d031192a201881a6928b8995e54b0a6e0c6467c500f3fe9549` |
| tests/billing-trial-membership.test.ts | 7 | 0 | 0 | 7 | `597200ce003698d1faecc346ab83bedca950fb875c8fe5207af8512bef9ab81e` |
| tests/billing-trial-access-projection.test.ts | 6 | 0 | 0 | 6 | `28dd9a4b37dae54d8c7e7c69120b22b5735329e5ff83499e0394113eb80e27de` |
| tests/billing-trial-history-backfill.test.ts | 5 | 1 | 0 | 6 | `599f7805df0b5c8786d7383448bc5424e4d05b9b17d1d78c5fbc0efe74df15d7` |
| tests/billing-trial-identity-claims.test.ts | 6 | 0 | 0 | 6 | `b871f27a410d1e4a97344547d577a5c4be3d594c7051ffb0783c5937fd3a839a` |
| tests/billing-trial-paid-cancellation.test.ts | 6 | 0 | 0 | 6 | `e29cc24580dca1c9ec4a967b712d5d93310343086aed3b95611158e61deff549` |
| tests/billing-trial-subscription-access.test.ts | 6 | 0 | 0 | 6 | `506de1abfee4a6ed711b2cb40e3e642bb35b3eaa110c271b6fa3fa4a8db56644` |
| tests/billing-trial-cancellation-route.test.ts | 5 | 0 | 0 | 5 | `4d7a5df43e4b6dfeed31f9714615007c960402e6ad348ff428385ac414d15072` |
| tests/billing-trial-required-notices-postgres.test.ts | 5 | 0 | 0 | 5 | `9e172d6237a58873d149d84ed8b891ee48bbd3c59557eb0dae197a9f3d764e6d` |
| tests/billing-trial-analytics-delivery.test.ts | 4 | 0 | 0 | 4 | `6e0c496acb84acea7e723936cc3b8b241dfb5ba55c292d6bde21e230446c8905` |
| tests/billing-trial-cancellation-declarations.test.ts | 4 | 0 | 0 | 4 | `9bf629b81df0c4f8099a7443df129e7d200132e9bf0d3bc3e9eb3faf2063be4b` |
| tests/billing-trial-cancellation-provider-operations.test.ts | 4 | 0 | 0 | 4 | `d1f674c6422e2f6cec8cf3717091dd0e58b84e256a60d29b7520163d3ee8f7b2` |
| tests/billing-trial-checkout-attempt.test.ts | 4 | 0 | 0 | 4 | `c9cb9905f8d4006575afc4d60dbec8a8a4dd588d190485731e70f3ff506443cb` |
| tests/billing-trial-paid-continuations-postgres.test.ts | 4 | 0 | 0 | 4 | `d093c6ca336b35dda0965cd1731f99d580130d6a13da88231ad32d9de80de027` |
| tests/billing-trial-paid-migration-authority.test.ts | 4 | 0 | 0 | 4 | `4dee59983cec6e7882bc63e3cfeba1677a526b77fb90fe7d79c6d943c3cbb09d` |
| tests/billing-trial-paid-recovery-route.test.ts | 4 | 0 | 0 | 4 | `023bdac0906989c9d81711f9841f6766bb642d8582676ef816d052cc023ff5d0` |
| tests/billing-trial-prior-paid-history.test.ts | 4 | 0 | 0 | 4 | `c4d3fd7b26495b752f1e8a4b275c98fba5a16518c49f043827ee3414ddc63341` |
| tests/billing-trial-effective-payment-contract.test.ts | 2 | 0 | 0 | 2 | `1476e83892f86bfa1f4c6abf5253814b5a2412013b92a47887d97b23ac342305` |
| tests/billing-trial-payment-reconciliation.test.ts | 2 | 0 | 0 | 2 | `2fee8faec59833a1a13629b49298b4150284c013a92fea98cdabae8f8d9d2928` |
| tests/billing-trial-analytics-postgres.test.ts | 1 | 0 | 0 | 1 | `b84bae5b7f915b07b72b9d8d4fd74b569d3fcaa96942f99139b5a0d73f0ec9bc` |

## tests/billing-trial-required-notices.test.ts

| Line | Verdict | Exact declaration title | Credible regression / limiting evidence | Callback hash |
|---:|---|---|---|---|
| 38 | R | "PayPal confirmation notices retain and validate the winning authorization provenance" | Accepting contradictory PayPal proof clock or emitting provider time for API confirmation corrupts durable authorization provenance. | `aa1b6a5faa5a08707c3def92857bc510f16459f5e4fae824477e9c76f6f920a7` |
| 80 | R | "contract confirms actual accepted progression, Berlin deadline, cancellation and full withdrawal instruction" | Dropping annual introductory/renewal prices, Berlin deadline, statutory cancellation or withdrawal wording misstates accepted contract; changed first price and invalid end also exercised. | `bf1c5fe95eb1e693b47053ab200478b01c2871f4ea53970bd3539921f7ea0520` |
| 108 | R | "cancel receipt acknowledges declaration even when provider operation is pending; never needs provider success" | Waiting for provider success would suppress a legally durable cancellation acknowledgment; exact unpaid facts and pending status are independent. | `f974104fb760202b2726dc196ed458e449ec0a5d14eb8ef537e5dddfcb9979d1` |
| 127 | R | "paid receipt rejects zero/mismatched amounts and uses late-success time; annual is never a monthly reminder" | Wrong first/renewal prices or dates corrupt payment DTO; zero payment and monthly annual-notice rejection are separate constraints. | `6766c49b1dd16018337c4ee6b10b226b0103bd065b24e809c9d57eccd8d8dff0` |
| 186 | R | "missing configuration claims nothing; verified owner alone chooses recipient; queue ACK is not delivered" | Missing-config claims work or using unverified recipient breaks dispatch ownership/config; queued ACK must stay queued. | `8d9ad8dd4a9fbff0f98cc1851959813881d829a77c1105443e2335683d370b47` |
| 223 | R | "ambiguous/HTTP/error sends park once; settlement failure never retries provider" | Ambiguous, HTTP and generic errors need different support codes; settlement rejection must not repeat provider send. | `94e893f268aa70904bbe6d2a0f04d79171200d6d5096ed21ccfd8bd970071cc1` |
| 271 | F | "missing verified recipient and malformed snapshot send nothing" | F: malformed snapshot and missing recipient both result in supportRequired/zero sends, so bypassing snapshot preparation could still pass due null recipient. Preserve recipient proof; strengthen settled error-code observation on existing calls without new inputs. | `76122404c1bb9871f9c64b89e696a40142c1587db7e21832ed522aac91437d0d` |
| 291 | R | "cron refuses unauthenticated requests and exposes only aggregate failure/config status" | Cron secret bypass or mapping blocked to success is observable independently of dispatch helper. | `a204b50c3c45ea42e39b6997b8afe64d5072e0f3f7f90cca3d48efa1adcd5d2a` |
| 318 | R | "inline required notice keeps arbitrary declaration content as escaped data, with no open or click tracking" | HTML injection/Liquid interpolation/tracking changes are observable through actual rendered template; exact wrappers/privacy formatting have no same-input stronger keeper established. | `04a6f999e1a2d8592984458c93169c599b939005881c621ae9848eddc6736d51` |
| 360 | R | "committed change confirmation names original deadline and does not restore a canceled switch" | Switch while canceled must retain cancellation and zero future charge; restore must clear only with valid snapshot, including invalid canceled restore rejection. | `6457ee86838bf224068068da8fef9ef4a587d0b6f5217550dc91f033457dc058` |
| 406 | R | "paid cancellation receipt preserves paid access and pending provider work without trial-only promises" | Paid cancellation must retain paid-through date and pending provider status without free-trial promises; invalid effective-end rejection independent. | `029bbc88f634b6a8830e55dde0984e0e4216a118061eb515ac28f8ae24dcc719` |
| 441 | R | "annual notice leads with amount, date and post-year cancellation terms" | Annual renewal amount/date/statutory terms and cancel action are unique presentation output. | `235ca46f4a8ae810e1f2a7011b634cc671e58b8f0d3aa84151580c3a747fe9ed` |
| 460 | R | "PayPal contract confirmation states the day-after first-charge date instead of the trial-end moment" | Non-midnight PayPal end must disclose next-day charge while original end stays distinct. | `8953d10173d8a6cd991e6a267842f14c517f039905cf51068727ae9dd49478b3` |
| 471 | C | "Stripe contract confirmation keeps the exact-moment first-charge statement" | One existing rendered-message result owns all same-snapshot output clauses. No added call or input; explicit literal regex remains independent from source. | `aa97cafda10958e82e75acf096bc7ae6855298b4f9398113ae432d3d1cdc80c9` |
| 476 | R | "PayPal contract confirmation with a frozen midnight trial end names one date for trial end and first charge" | Frozen midnight PayPal end must disclose same charge/end date and reject >10 days; differs from previous non-midnight input. | `05273f46f4efeebd9dbad5202830771b08c641e8001876d6e3227229cf384b98` |
| 500 | R | "PDF encoding failure is definitively unsent and classified as preparation failure" | Real PDF preparation error must make zero fetches and settle notice_preparation_failed, unlike generic send errors. | `4aaba0386e10e1fcf74cb96fb7daa4b4a140676e82838c3ef17c16addb3e37f2` |

## tests/billing-trial-admission-postgres.test.ts

| Line | Verdict | Exact declaration title | Credible regression / limiting evidence | Callback hash |
|---:|---|---|---|---|
| 89 | R | "admission recovery reason accepts only the verified existing-access marker" | Recovery marker database check admits existing_access only and release must retain reason while clearing neutralization. | `933d2f5977546aa0d3d6f716b196f8428c7e08ae2625eadc6c4238d6a8c55920` |
| 162 | R | "a confirmed abandoned attempt releases claims and replays the same evidence idempotently" | Exact release evidence replay is idempotent and changed evidence rejected; other abandonment callback does not repeat release twice before changed evidence. | `6903bd0779ffa05a6ec1bba921f8bc0c756892608be3d1d877a16b5dd62dfc6f` |
| 259 | R | "trial admission adapter creates one immutable enrollment attempt through its real SQL shape" | Retain real SQL immutable-attempt keeper; owns C3 annual accepted-offer mismatch plus existing retry, user/provider mismatch, upsert/select/eq and persisted-row assertions. Creator retirement is held separately. | `ed14ede93d17272db4fd4a51dc6a6d8ba2392d9b5387e9ea3bcd39dfb0f6e8d1` |
| 299 | R | "trial admission adapter composes reserve, activation, replay, and active-release refusal" | Mixed live reserve/activate/replay/release contract cannot be deleted with unused creator setup. | `d6a11014393401ca44ed9311ac91473cf9e16fadf1c8b2bf667f38812a339e9f` |
| 334 | R | "trial admission adapter fails closed before provider calls and on unknown RPC output" | Mixed invalid live activation/unknown RPC result must survive any creator retirement; no whole declaration credit. | `7c1eb3d53ebf3f32b29246a84ce6c80231695840e2a85466bcea9f55304ce723` |
| 385 | C | "trial enrollment adapter rejects a successful upsert whose readback has different accepted terms" | Existing storage-backed owner call subsumes mocked transport readback; no cloned implementation or new input. The keeper rejection comes from actual createTrialEnrollment, not mock-built status. | `25a3331a18081feaa603c5bed6a9682e3b14ae62a4e55717877164de07511c74` |
| 417 | R | "trial admission reserves, activates atomically, and replays only the exact provider receipt" | Exact authorization replay rejects changed time and added identity after activation; seven-day persisted duration must stay fixed. | `31ee90caebdd6a16b6bc7ab5ca2622a5becf79a1e26bfef619aa66e08e164326` |
| 457 | R | "trial admission rejects malformed claims and invalid authorization before any write" | SQL—not TS—rejects malformed claim shapes and infinite/future authorization before any claim write. | `9b5bce237b0e8c103b23b1a153791ad1d90af75ed9413eca2092a133c29b3c60` |
| 480 | R | "a claimed identity blocks the loser without partially writing its other identities" | Conflicting reserved and consumed identities atomically block loser without partial identity writes; preserve neutralization evidence. | `1d18058a1a09e8e4bda41a5f423c8b4f8fedca94ee73dd21c4a1f75668ecbdb1` |
| 535 | R | "an abandoned reservation can be released only with evidence, then its identities can be retried" | Abandonment requires evidence, late authorization remains released+neutralization, another enrollment can retry; active release refused. | `5ddf925c72d306886c46340f102eafb4b6e45bd2ba249423f5b6dfbbdd2505a8` |
| 571 | R | "identity namespace and key version separate claims, while consumed claims survive nullable FK deletion" | Consumed identities survive deleted nullable owner links; key+namespace permit independently scoped new claim. | `925d11cee77e2df203f77da9fe5a1dedd41808911728d8293503f5352f4efde3` |
| 597 | R | "accepted terms and original trial timestamps are immutable, and legacy subscriptions remain unlinked" | Table trigger preserves accepted terms/end; legacy defaults null and linked deletion/unlinking refused. | `51eff1bd46a35cb41db071da3e8b40f2c885db1cd582607e4b32525f51e2b9d9` |
| 634 | R | "retained HMAC keys block a second trial after key rotation without writing new claims" | Actual HMAC rotation reaches actual SQL admission: old retained key must prevent a second trial without leaking new reservation. | `6504afca8fd0896b53b5467cc7f4e06ff7b5aa05f0166b292b027339b6371f8e` |
| 657 | R | "admission tables stay private and only service_role can execute the RPC" | Function/table grants independently protect roles; actual permitted service call controls against all-denied false green. | `3b8239eefdf9fbdda19e1b0eabf3e89cc08ce7190cb42d6104859d06d3acef2e` |

## tests/billing-trial-payment-events.test.ts

| Line | Verdict | Exact declaration title | Credible regression / limiting evidence | Callback hash |
|---:|---|---|---|---|
| 97 | R | "records exact first monthly payment, including UTC EOM, and replays without access mutation" | UTC end-of-month first paid period plus duplicate replay immutability and zero repair debt. | `6390e5cf4be5473ebfee219d7e4434b02ea0c993a75aaafceccc374b4696ad64` |
| 108 | R | "fulfills the first full UTC calendar period and records continuation debt when provider boundaries are seconds late" | Second-short provider period owes full calendar period and exactly one durable repair debt on replay. | `6f2b16df25bb1c942f9c231da08923de05e803f5b01f02212c1c5f3145be3f2b` |
| 123 | R | "days-late first collection fulfills from verified success and keeps the source period as repair evidence" | Days-late success starts full period at payment rather than historical provider start and retains source evidence. | `a1467b2ec6b414fc168f8f7529ff87358a711f33ec23308452b40cf21de10692` |
| 145 | R | "unknown enrollment and failed first collection cannot create paid access or grace" | Unknown enrollment returns reconcile; failed first collection must not create payment/grace state. | `68454d33973ae37d6ad41c9f79098644063d60562dce181412ac7b6f9dd78da9` |
| 159 | R | "repeated failure deliveries with a new provider time are duplicate facts and never extend grace" | Same invoice failed at newer delivery time must deduplicate without extending grace. | `3f7796374f964b754d3da4c23b1941944f5c1f4555a54278a8a9da8876c1c860` |
| 180 | R | "rejects early first charges and malformed or incomplete event shapes before mutation" | Early successful charge and underpayment fail without access/debt; string amount and extra property SQL validation independent. | `3fa03c73ffaa9114b1cb7f4159d1c977e49ab2ad18da78d1f3268f1b61758496` |
| 224 | R | "accepts annual EOM only after a full year and rejects price or malformed immutable terms" | Annual leap-day fulfillment normalizes full next-year period and records debt; malformed frozen offer remains reconciliable. | `9b5656c6a2d8cc553690445645d682d7215e63bb5673a2354e0fa3540a390dbc` |
| 251 | R | "renewal advances monotonically; due-period failure gets exactly seven days and old failures cannot relock" | Renewal follows period, grace exactly seven days from due date, later stale failure cannot relock paid recovery. | `15e746823d337d9d5285f368abac626484709c20c17d46ac47478b4ce9d64cfa` |
| 293 | R | "delayed renewal follows the provider period boundary and a late annual first-payment failure stays stale" | Delayed renewal does not shift period to event time; late annual first-payment failure remains stale. | `cbb21312ea4ea56e63c90ec7e5cd29fec0e7389f53bb7ff51051d00cf16d2f83` |
| 332 | R | "out-of-order future renewal remains reconcilable after its missing period is applied" | A future missing-period event must remain replayable after intermediate renewal applied. | `aec00af1aca680f0f19e56efc5e483804d82652f7b6f4c3183e658c0c60450cd` |
| 360 | R | "invalid source boundaries remain reconcilable; canceled and revoked rows fail closed" | Equal source boundaries remain fixable; canceled and revoked first payments remain unreconciled. | `ce24bfbc294d00fdab571e14e0f3adf40d3bdb88f40e254adb1a858e502416e2` |
| 382 | R | "same invoice aliases preserve phase while ambiguous event or source collisions fail closed" | Event and invoice identity aliases preserve phase; changed source/amount collisions require reconciliation. | `e1196322aa16e7a803c14b27d8b4e90dcd7179a04247c3da4330fc8127d075ab` |
| 403 | R | "a previously recorded failure event can be corrected to provider-confirmed success for that invoice" | A stored failed event corrected to success must apply then deduplicate later alias. | `88c762cc86341c071b388718e75e7fa9b2ffcdbcc8b9b9ab5d2fab5397b71f66` |
| 422 | R | "RPC and private ledger are service-role-only, and adapter accepts object or singleton array RPC data" | Actual role denial/allow controls plus TS RPC object/singleton/ambiguous-array decoding. | `c45467aaaf4b912e806905c23d70681d220219b8aebe28813c600415b7649cf3` |

## tests/billing-trial-identity-rights.test.ts

| Line | Verdict | Exact declaration title | Credible regression / limiting evidence | Callback hash |
|---:|---|---|---|---|
| 74 | R | "restriction stops matching and all-version recreation; release restores original used claims" | Restriction removes all associations, prevents old/new source recreation across overlapping keys, and release cannot revoke admitted trial. | `845d3eb2b30620487f8ee7fce05124177c32f7394bfc67645410cd83c043e77b` |
| 102 | R | "erasure removes hashes without personal denial tombstones; old source replay and rotated backfills cannot recreate them" | Erasure removes matching associations and tombstones, suppresses old source across rotation, permits genuinely new source, refuses restore. | `777037d6fb6f1e1dbc79f7454b52552176ddf7beada5ef3feee9a77197058140` |
| 121 | R | "enrollment erasure also suppresses its provider agreement and preserves canonical activation replay" | Erasing active enrollment must fence original provider agreement while canonical activation replay remains active. | `e53eebe654b6aed1e761f321c02e7890c1ccb6175ca0a3c776850d4ca7134a71` |
| 130 | R | "shared-card correction retains unrelated account history and prevents every known old source from recreating the card" | Correcting shared card preserves account history and suppresses every known old source while new account can enter. | `59681d7512c77b23d967fc643525ca4b96791a358bda1084dec3ef497c4c4d0c` |
| 140 | R | "service-only key/source controls reject raw/direct claim writes and unregistered key loss" | Direct service writes require source provenance; live claims block disjoint key registry; authenticated rights/private reads denied. | `38ed726c4631a7de0b4ebc4926dd7bb5419d7dd2c83e181da2a74250e63a9fb1` |
| 162 | R | "operator tooling defaults to inspection; apply is explicit and never needs raw personal identities" | CLI defaults dry-run inspection and apply alone routes rights/key mutation; no raw identity required. | `a4800d7f942627ebc4695e85c30f0de06dd46cc361d28f916598d20d62103cd0` |
| 179 | R | "released unused reservations purge private matching associations as well as public claims" | Released unconsumed reservations must purge private source associations as well as public claims. | `12d6438b46fc0d9d60cde89cb883cc83305896a57e4fdb34686b57e277b4625e` |
| 188 | R | "pending enrollment erasure also fences its later authorized agreement" | Pending erased enrollment must fence its later authorized agreement, a lifecycle different from active erasure. | `92269963f418c202ccf40f01cbcf656f161d7f4207c119fbb2288dd1e19a119a` |
| 196 | R | "authorization consumes all reserved identity kinds even when final proof contains only card/account" | Activation must consume previously reserved email even final claim list omits it. | `584ce611a4b720417a54ab0feedd6eeccfd09b8a83458eefd4c52f521597fff0` |
| 214 | R | "erased enrollment also suppresses a selected provider revision first observed by the later backfill" | Later observed selected revision must inherit enrollment erasure fence. | `b669e5613610a830cd542de37b6422cc5e851f5566a14dc24134676a060fb66f` |
| 226 | R | "key registry updates are scoped, idempotent and retain claimed versions" | Registry idempotency/add/remove and rollback preserve claimed key version; source regex is redundant assertion-only shape, zero quota. | `0b35d59bdd8d2a42b46a473bcea51160aa94c769514bb26452efacd629f28823` |
| 261 | R | "admission stores a verified provider trial end of at least seven and at most ten days" | Provider verified end 7..10 days inclusive, frozen replay exact, omitted-end default7 and table bounds; different storage authority from TS policy. | `f46eb36c45bf533f3f5b5830062f70d827771e1ebf6e636c4598a95faa0b0069` |

## tests/billing-trial-policy.test.ts

| Line | Verdict | Exact declaration title | Credible regression / limiting evidence | Callback hash |
|---:|---|---|---|---|
| 21 | C | "grants trial access from authorization inclusively until the immutable end exclusively" | Existing actual projection boundary delegates to the actual policy with the same operative facts; no new call, fixture or input is required. | `531b7e99c607c0bab8222804bae8e3c1c16380f552f5298d6101b6c80a06056e` |
| 30 | R | "accepts valid ISO offsets and fractional seconds" | ISO fractional seconds and timezone offset acceptance is independent parser contract. | `ca4d3e0143a601963bf095f505704c66ea1eddced3df32e07039fc6194bec71c` |
| 43 | R | "does not grant access before authorization, including a future verified authorization" | Future authorization and entirely absent authorization cannot grant access. | `7a952efab9061a650ec65f6258ec8b76984a8f852ec21dce53210ad10e7e2dad` |
| 62 | R | "a canceled trial retains access through its original end but has no expiry grace" | Canceled trial active before original end and locked exactly at end; no collection bridge. | `7080dcd19a2658863550ce522971588f5c215eaf97c0b5198ad38b6e48de920f` |
| 75 | R | "bridges the first-collection window after trial end, then locks without renewal grace" | Unpaid bridge closes independently of malformed renewal bookkeeping and future first payment; future-paid status differs. | `9e011e4a769871985600b0995cb2daad3ca327ca87f94e07d2962f9892645d8d` |
| 109 | R | "grants a finite paid period even when the membership did not use a trial" | Paid entitlement without any prior trial is a separate null authorization branch. | `5f8414dc8ab1d87cce023a0ce77443e328f6bae1161d4c39c79778651eb93e13` |
| 124 | R | "grants verified paid access even when payment succeeds before the recorded trial end" | Early paid success takes precedence over still-open trial. | `fb009e8d534e7f46e1ed242d916276a785a5a49ece47778a37e442ae2af26a89` |
| 137 | R | "keeps verified paid access when stale renewal-grace bookkeeping is unusable" | Paid period remains accessible despite stale false/true failure and malformed grace bookkeeping. | `5885b21b4739a6bc3ff451ae4162aadffc4bf8a83ef2864bfffe218e5b7cbab4` |
| 165 | R | "permits only a previously paid, non-canceled membership to use its persisted renewal-grace deadline" | Only previous paid noncanceled membership gets valid persisted grace; equality/invalid grace denied. | `4981d49f7a847cb8a1d778fa2711efdf81df95c4211e86069c89be27f8918db5` |
| 201 | R | "fails closed for malformed or contradictory persisted snapshots" | Calendar-invalid, contradictory pairs/order, malformed now and timestamps fail closed. | `6acbc34d143d44ac3e79a0dde6a3fb4da3c41df1d1700ed2aa3abffb2f6fa8c3` |
| 237 | R | "revocation always wins and repeated resolution does not extend a persisted grace deadline" | Revocation overrides paid; persisted grace near boundary expires without recomputation. | `b8c8978c4a2e2737ae19da5b259ed21e236900babd14f12b940e7d2892554bc7` |

## tests/billing-trial-lifecycle-analytics-postgres.test.ts

| Line | Verdict | Exact declaration title | Credible regression / limiting evidence | Callback hash |
|---:|---|---|---|---|
| 105 | R | "activation freezes original attribution and queues one consented zero-value StartTrial atomically" | Activation atomically freezes session and consent; repeat activation emits one zero-value stable event and no private Meta attributes. | `0cad986fda9399f650ac5e6cd15c23518f014d790bfd8fa1ed85830ef17b9140` |
| 127 | R | "first failed charge and recovery use the latest canonical ledger, preserve phase and deduplicate aliases" | Failed-first aliases and eventual success produce exactly three distinct events, recovered marker and first_paid attempt phase; no unconsented Meta. | `c9e279e554c284e3b50b3169e590426cd8bd4e43f67a8a1e7b733ab6ba3a76d8` |
| 181 | R | "day-3 cancellation request, provider confirmation and committed restore remain separate replay-safe facts" | Cancellation request, provider confirmation and restore remain separate once-only facts with day3 and unpaid flags. | `b9c8a0b597d583452850cecf73b61c7f89aeb2bcfbb16d34e72bcb7987e3d842` |
| 259 | R | "guarded provider observation is distinct from submission and rejects an outdated cancellation fence" | Provider observation fence rejects old version and cannot masquerade as customer cancellation request. | `83f3a8cbf1efb61a131cb70f674b4f5005bbc8a57c45837bf9eb6a53c66fb6bc` |
| 300 | R | "reconciliation transition captures once; a failed atomic outbox insert rolls back authoritative activation" | Delivery trigger failure rolls back authoritative activation/outbox; reconciliable payment later captures once. | `959b7cd19bff3432ef11ba944105d87c195b21c4d6c834ee18cdd00d65ae3630` |
| 351 | R | "existing frozen checkouts recover exact original acquisition without inventing historical marketing consent" | Already-frozen checkout recovers original acquisition without inventing consent; immutable context and private grants protect it. | `12833472b9911037378e1e6eafd1850c7d17cbbae06666e308b3acc6dc1e29e1` |
| 380 | R | "PayPal freezes attribution before provider creation and preserves its canonical first-purchase agreement key" | PayPal intent attribution before creation plus canonical agreement event key/sale Meta ID differ from Stripe. | `c85e674132cfc5a5d0bcf15c6968a69668ecc14c194f9b8ab5efa65d76040e5a` |
| 431 | R | "service-role trigger capture works and field-test context cannot queue a marketing conversion" | Service-role real trigger and field-test classification prohibit Meta conversion. | `e76a878dcf7f20ff6106f8995c3162bee132b838300f97777eefdfccc104fc15` |
| 449 | R | "mixed old webhook destination inserts cannot bypass new trial consent or route diagnostics to commercial tools" | Old webhook direct destination inserts must remain blocked by new consent/diagnostic policy in SQL. | `eb9ad87b1ef6423bbc77ea3924314917389d3904eb9240745628c389d74e97af` |
| 510 | R | `OpenAI delivery follows actual ${provider} trial and first-paid SQL producers without changing Meta` | One AST site, two existing providers: actual trial/paid producers queue OpenAI exactly once without granting Meta consent. | `7509fd2ffa609e4965d5f801f333db39a6b13921f29461f5ad6061866e6a3ef7` |

## tests/billing-trial-management-postgres.test.ts

| Line | Verdict | Exact declaration title | Credible regression / limiting evidence | Callback hash |
|---:|---|---|---|---|
| 111 | R | "switch/reversal append selected terms without rewriting accepted offer, deadline or identity claims" | Switch then reverse retains full original enrollment and identity count while appending revisions; selected contract transitions independent. | `23d6945af0fd2f7d2c1b7bf8cac4a66d31a3b4633e8447aace8ecd4a6950249c` |
| 157 | R | "one pending operation, owner binding, expected revision, immutable catalog and revisions" | Pending operation uniqueness, owner/revision binding, frozen catalog mismatch, evidence price/customer and immutable history gates. | `1a82c4131161535c9e6475f3d89bc7aa2991fd868024a7f5bf19583bfc79e7b4` |
| 219 | R | "cancellation and first payment between provider request and commit invalidate CAS" | Cancellation toggled back cannot defeat version CAS; first payment arriving before second commit invalidates it. | `facb32dd9001fb41d9e06628478d6d6e06b2f748f8442e1aa9e477e834ed083f` |
| 265 | R | "restore keeps cancellation until verified commit; replacement retains original agreement; replay cannot clear new cancellation" | Restore needs verified neutralization for replacement; preserve original agreement and later cancellation on replay. | `357bc16d1ddd996d779d90686d397cf2cbcdec1223ae55d7f4dbbd4e42a633cc` |
| 319 | R | "a repeated cancellation declaration while canceled blocks pending restore, abandoned action leaves old state" | Repeated customer declaration increments cancellation fence even when already canceled; abandonment preserves old revision. | `9ec3434c9e0694f1027c522c80fcc1328f85e92fa80d626ecc5f21f4d3eb0124` |
| 358 | R | "service-only RPCs and immutable history deny anonymous/authenticated callers" | Actual roles deny operation/history then service succeeds; raw service deletion denied. | `32af6238633059df7fc116558be3348aefe392c1d32348b57d4e1a3fc15346ce` |
| 382 | R | "original deadline is strict and provider evidence cannot extend it or collect immediately" | Deadline equality, changed provider deadline and immediate-payment evidence each invalidate trial management. | `2264698ddf5773afc8ac8bde029ea68a42fc77618467851dfbad76b309d99c3a` |
| 407 | R | "effective contract refuses a missing selected revision instead of reverting to original" | Missing selected revision must error instead of silently reverting original accepted offer. | `33c6df7b1c364392cd839b6e31434f51a83d92208c6db9e9cfcc56d72bf46323` |
| 419 | R | "replacement agreement and original admission share one binding namespace" | Replacement and original agreement share global ownership namespace; duplicate assignment fails. | `2ecc91f29ea7e09619c5ed487c6e3baabd046df743440968e0980f7c492af23f` |
| 458 | R | "public management snapshot atomically reflects committed revision and preserves canceled state" | Actual public SQL snapshot has public prices, pending state, atomic restored revision, subsequent selected agreement, revoked/foreign rejection. | `e1bffcdd8004caccd470e35fbb5dcd9c01b0a7b55db96e69e85b67c41733c1ef` |

## tests/billing-trial-access-postgres.test.ts

| Line | Verdict | Exact declaration title | Credible regression / limiting evidence | Callback hash |
|---:|---|---|---|---|
| 152 | R | "payment RPC updates the billing projection consumed by SQL and application access guards" | Payment RPC updates trigger projection and both independent SQL/TS readers across failed first, success, renewal grace and exact close. | `3e78dc5ec69ba69d1c06efc77d7710ffb79f81ee2cd339214bbfccadc53ae391` |
| 223 | R | "trial projection appends stable classified-view columns and derives a safe immutable billing projection" | Stable classified-view column order is existing SQL interface; exact safe projection key list excludes provider/identity/offer secrets. | `3ac2afaf08450fe24dee2ae74f9b5ed02fb1bb19949669d2f021c2ef93a32d9c` |
| 280 | R | "SQL and TypeScript agree on strict trial expiry, paid access, grace, cancellation, and revocation" | Actual stored projection +SQL/TS access parity at boundaries, paid state, cancellation and revocation; does not subsume all direct parser-malformed tests. | `c763456eab30c879b54628ddb1b32ebab8b119bde1f5500dfb16f66499f24b13` |
| 358 | R | "linked trials fail closed in views while unlinked legacy rows retain their one-day grace" | Linked expired rows and marker-without-link must not inherit unlinked legacy one-day grace. | `f7273b15e3a45b321ea1b2b432e57b187fbefa84135ca2d017c2d366990fa71a` |
| 391 | R | "SQL and application readers reject unknown or empty trial markers consistently" | SQL and TS must agree across absent/null/valid/empty/unknown/number/bool/object markers; empty unlinked marker denied. | `220a3c27871af6c02082668fd7ca626ee689ab4db5d6490ade3a35df75361724` |
| 428 | R | "link ownership, account deletion, and role boundaries preserve safe projection access" | Cross-owner link constraint, authenticated own projection, private table/function grants, account-delete null/cascade semantics. | `870ebf4d032a64685433aa228c41c22becfc0e3144e96b0cdec8bb8f22e8b32f` |
| 469 | R | "a second-exact legacy trial end keeps its next-midnight collection window in SQL and TypeScript" | Non-midnight legacy end keeps next-midnight bridge; exact timestamp projection required. | `f7f351405de14cf603d41925c08d3846e000b96f1ad972c7034d8d4ff8fab904` |
| 490 | R | "a frozen midnight PayPal trial end is its own collection start and closes two days later in SQL and TypeScript" | Frozen >7-day midnight end uses own midnight and closes2days later; distinct contract from exact7days. | `483960f20a3dada60004dbdf5c30d8c51c5d7fae6b16ab4a3352366900940945` |

## tests/billing-trial-cancellation-reconcile.test.ts

| Line | Verdict | Exact declaration title | Credible regression / limiting evidence | Callback hash |
|---:|---|---|---|---|
| 72 | R | "claims stable operations and completes a Stripe reconciliation with its lease" | Worker must call actual completion RPC after Stripe confirmation with exact owned lease/empty error, aggregate counts. | `3663a5254bae4364bcf2c2356443e10bfa8c3bc5c7ae9278a683844e724604c8` |
| 105 | R | "a Stripe timeout remains pending and releases only the owned leased operation" | Stripe pending result completes owned attempt with stripe_reconciliation_pending, unlike in-progress lease preservation. | `6970185af809bb3c7fa4b67989b92c3b601a5be2bb413da7ddc1b666e37a5077` |
| 123 | R | "PayPal runs its adapter under the owned lease and remains pending only when reconciliation says so" | PayPal provider dispatch must call PayPal once and Stripe zero with owned IDs, then confirmed settlement. | `5220fca0bc02b4f60c3e2a3c4e1619a62808b2075495998041d4a3007f863e08` |
| 153 | R | "malformed leased rows fail closed without a provider or completion RPC" | Malformed lease must reject before any provider/completion; completion counter catches swallowed provider sentinel. | `4ab395a45b82f765cce78fe4ef8cc6549a4d362fe15258bf28be8b84173e6040` |
| 174 | R | "a lost completion acknowledgement fails the invocation and leaves its lease for retry" | False completion ACK must reject rather than falsely claiming invocation complete. | `5ec0ba6bbf889d0828a7ea0a4ed05c4d674b86d150466ac3b08f33edbd9b26fe` |
| 188 | R | "a still-running provider call retains its lease instead of starting an immediate duplicate" | In-progress provider must retain lease and issue no completion RPC. | `30c0e82376407664f930410ed560c58cb86e38f13323af3fa9189b9eaead1798` |
| 203 | R | "the retry migration denies stale lease completion, defers timeout replay, and preserves its declaration" | Actual SQL stale lease denial, delay until next_attempt_at, fresh lease token and authenticated denial protect retry concurrency. | `cc46652facd373d0742212ae958d31fb9c40dd3f83ead2c68ecd6d7dad2d920d` |
| 267 | R | "the retry endpoint is cron-secret guarded and reports only aggregate worker state" | Cron-secret rejection and aggregate-only response at actual endpoint; fake worker response is expected transport dependency. | `1925205e1aee5e8f287608f930df99ca3a900c4ef5c55a68eb4f8bbaab37d399` |

## tests/billing-trial-offer.test.tsx

| Line | Verdict | Exact declaration title | Credible regression / limiting evidence | Callback hash |
|---:|---|---|---|---|
| 46 | R | "the composed sticky summary uses trial terms and rejects an unavailable quarterly trial" | Sticky summary composed trial/legacy and unsupportedquarter contract distinct from TrialOffer renderer. | `1452c63dcec7fb824f0bb7fe4d14694e28f12a070d7768bd4ab288fd46cba380` |
| 59 | R | "the selected interval controls the plan state and emits the requested selection" | Controlled selected year/month aria states and actual callbacks emit opposite selection. | `6ce45999646ef50d05bea8aa5589ba4ca52f92794cc4e345a4e2496b0ed5bbc1` |
| 95 | R | "continue remains controlled and is unavailable while pending or disabled" | Pending and disabled independently suppress continue and selection callbacks; active one still works. | `8be890e1e49f7d775da535eeac167df510c3c07260d8fa010b1fc4db02a28c18` |
| 131 | R | "the displayed terms derive every selected price from the public pricing projection" | Introductory public numbers and annual/monthly rendered disclosures include exactmonthly equivalent/renewal. | `8dd2f211dd21e7af130dd2454569886cd3abc88e2827147dad051d495bcfbece` |
| 165 | R | "a no-coupon annual offer never retains the introductory annual display" | Equal annual first/renewal price removes intro copy, recomputesmonthly/savings and preserves footnote. | `b0af6612a1542f6cfa7a2ca44b8a37dafa510a19f7135975f521c81aa1aa4c81` |
| 196 | R | "invalid public pricing fails closed instead of rendering misleading terms" | Actual renderer must reject zero monthly price rather than rendering misleading terms. | `9bd4ab80862f5466f05914e69dd5d4994aebbadcc00fc3cfb3d7a285a6f75d51` |
| 213 | R | "a server-sanitized trial projection replaces legacy result pricing only when supplied" | Result composition suppliedtrial vs omittedtrial must replace legacyguarantee only ontrial. | `004b14127e219bdcecd0ea897b4220b633a6ec466d604285c667be8e871cd150` |
| 231 | R | "trial checkout serialization is explicit and cannot inherit a paid attempt" | Exact checkout serialized payload includes stable attempt/session/event, explicittrial and falsemarketingconsent. | `02aa173a77f3d7692720904ad4c2c54bf51643315f05448cad76a91771d5d9d6` |

## tests/billing-trial-paid-recovery-postgres.test.ts

| Line | Verdict | Exact declaration title | Credible regression / limiting evidence | Callback hash |
|---:|---|---|---|---|
| 130 | R | "paid recovery requires expired unpaid state or exact outstanding paid-boundary debt" | Recovery kind must distinguish active trial, expired unpaid, and actual paid repair debt; source object/effective binding required. | `2038bb19c07d78a3470124c8037b31cac5b60c37a5b5ff5d2ed08e601cbfe4ef` |
| 144 | R | "one durable pending paid action, original owner and revision remain immutable" | Pending operation idempotency, ownership/revision, immutable source, cancellation CAS and abandonment preserving cancellation. | `77ef0a4485baa8e9ee561a276fcab20a066ff35fcd8f36abf4be3537bc4530ad` |
| 187 | R | "competing old first payment wins before candidate commit" | Old successful payment arriving before candidatecommit wins; no successor link allowed. | `23a15d563f709f36c48c7e400c659edd25ff672b8a94e010529fb5acc403a1d5` |
| 206 | R | "repair binds a no-charge successor at the owed deadline without changing cash facts or original terms" | Repair noadditionalcharge and exactpaidboundary validation; successful replay preserves all enrollment/paymentcashfacts and resolvesdebt. | `f00daee6ad94c64e9c0468dd2b227809df7e0d287ab71dabafb8b2e6f31c294a` |
| 262 | R | "a missing ledger successor allowance rolls back candidate link, cancellation clear and provider checkpoint" | Without ledger successor support, exception must roll back link, cancellation clear, payment and providerverified checkpoint. | `e922ff98a5d6d7b0afbb91d5421fef0a11e5cbdbac539315cf0bbe566578eab7` |
| 312 | R | "paid recovery RPCs are service-only and raw operation writes are denied" | Actual unauthorized role denials then service begin succeeds; raw state update forbidden. | `1513c4f4344e05013a73eea7d11f3d322af52298239a8de90f46d671558ad87e` |
| 330 | R | "verified paid consent commits candidate, first payment and full period atomically through the real ledger" | Actual payment and candidate commit is atomic, rejects foreignpayer/underpay, grantsfullperiod, immutableoriginals, singleledger, repairdebt. | `b1a4f6e0f11c29414b83abafb0000ba40d37bf83867069c66b19004545a6c44d` |
| 431 | R | "public paid recovery snapshot distinguishes expired consent and existing paid repair without leaking provider IDs" | Public view distinguishes none/recover/repair, pending operation, foreignowner and canceledrepair while hidingproviderIDs. | `b7c6af2c47a7a7b44838d857cb1e947c60c6b29a7ea89183cc870f2cb2ec7bd4` |

## tests/billing-trial-management-route.test.ts

| Line | Verdict | Exact declaration title | Credible regression / limiting evidence | Callback hash |
|---:|---|---|---|---|
| 118 | R | "authentication, exact JSON and same-origin guard precede any trial mutation" | Actual HTTP must reject auth/body/origin/contenttype beforebegin/load/provider. | `9127d5e49571454b48e9d2aeef37bc01e54869a1bb4d5284175e9166f3874ce5` |
| 145 | R | "begin reserves once; reconcile only loads the authenticated durable operation" | Begin vs reconcile dispatch, authenticatedoperationowner and callback order belong to HTTP layer. | `53b6eb9d609613e61d2c583634bd4aed3930d58cea841310f0f80582141acf28` |
| 162 | R | "provider failure retains accepted operation for reconciliation without claiming success" | Providerfailure202pending differs from beginfailure409; acceptedaction retained. | `bfbfc36fddcc31290467bded0f713644b8d6ecc66bfc4672b15196a8fc412236` |
| 177 | R | "PayPal receives server constructed returns and only exact HTTPS approval destinations are forwarded" | Server-owned return URLs and strict HTTPS host/port/userinfo protect approvalredirect. | `ed2e4f67880b3a4f7ac59a5bcb70d8407db3d24d6ab4bb0bfce36715e532fe41` |
| 218 | R | "GET discloses only public frozen prices and the owned pending operation" | Public GET strips internal price/provider fields, exposes pending and publicprice snapshot, no-store, unavailable409. | `c12c0015a5455df2bc1afd4045dba3872996cc4e2eaa6ead295304d34dcdf2f5` |
| 251 | R | "public snapshot eligibility is preserved and malformed snapshots fail closed" | canManagefalse retained and negativerevision fails503. | `3bc8273ca843595b3b9453cba3d5b68e0281bab6f8b3ff47d41988bc21e3fa3b` |
| 262 | R | "a fully canceled Stripe restore starts fresh hosted authorization on the same durable operation" | FullycanceledStripe restore must use hostedapproval onexistingoperation withserverURLs. | `01028f76e3213140a95763a36318c0c3372e98e7c591187cf8d6e5b62aa8ff30` |

## tests/billing-trial-membership.test.ts

| Line | Verdict | Exact declaration title | Credible regression / limiting evidence | Callback hash |
|---:|---|---|---|---|
| 50 | R | "membership reads accepted prices and original deadline without exposing provider identifiers" | Exact public membership DTO excludes provider identifiers and uses acceptedannualprices/deadline. | `e3d05644dfdaf39cd79e98e5518ef923f13ae74d2a77aa6b49c1535e900cbf5e` |
| 67 | R | "saved cancellation keeps access until the exact original deadline and disables another declaration" | Canceledtrial one-secondbefore/end changesphaseand disablesduplicatecancellation. | `2b5a135ad48b9762613bb1156fd96c7ceebdb83bbea76b3b930c84b464e8cdeb` |
| 85 | R | "paid new-cohort membership cannot enter the free-trial cancellation flow" | Paidtrialcohort cannot usefree-trialcancel evenafterfirstpayment. | `655b2cde89dda5d825693ea728cb420c1c8a1b4feedd29c40fd96ed7fbc22b3c` |
| 101 | R | "mismatched owners, corrupt accepted offers and incomplete facts fail closed" | Wronguser, malformedoffer, missingend, stringcancel, blockedadmission each failuncertain. | `30fe55ad95d560e7d9667bf73d3b7e1d1513a5ee08389aa4a268280d5fb1d383` |
| 114 | R | "read scopes an enrollment to the authenticated owner and preserves expired status" | Explicit enrollment query scopes both userandID; effectivecontract overlay retainslockedphase. | `4509b2bf427cba01c61b0f120c5b473d7c37650ff6d2efd14579db56c7cd4f61` |
| 145 | R | "composed membership read prefers expired trial facts to a stale active compatibility profile" | Composed HTTP lookup must prefer expiredtrial beforestalel egacyprofile and planchangefallback. | `4f83e66cce825e4565bca13213edb0fc703e2924ad30d1a0621fc5ce082455e2` |
| 184 | R | "legacy and manual membership responses remain unchanged without a trial" | No-trial legacy and independentmanual grants remain distinctpublicstates. | `18fcc9ce480f4a0e1ecd29c77111f981f372131f4caa506088e785a3cdd1f417` |

## tests/billing-trial-access-projection.test.ts

| Line | Verdict | Exact declaration title | Credible regression / limiting evidence | Callback hash |
|---:|---|---|---|---|
| 39 | R | "leaves only a completely unmarked legacy billing row to legacy access handling" | Only entirelyunmarked legacy returnsnull; marked malformed must not fallback. | `7d24c3337a8c0b73adf3cace14787fcd382d160a9f510bfc50f482826ffd25ec` |
| 47 | R | "bridges the first-collection window at the seven-day boundary and locks when it closes" | Exactvalid projection includes actualpolicy start/end/windowclose outcomes; primarykeeperforC1. | `b67b5f28c2ea0c35362a14c5328c779f3e644a47d1426b5bf83060e57bf89d26` |
| 66 | R | "fails closed for cohort rows whose projection is missing, malformed, or linked to another enrollment" | Strictprojection shape/version/id/types/requiredfields prevent injectedgrants. | `ad11300afc22b1c80a3fbde1e1e646afefde27491edf4d7b3a9f1876bfc95f4d` |
| 87 | R | "never grants access before admission becomes active, even with injected paid facts" | Reserved activepaidfacts remainawaiting; blocked/released invalid beforepolicy. | `13916b5904bc555ce4d94794db011a9f7c9ebe9d5878342acb85f67d8e672926` |
| 108 | R | "delegates paid and renewal-grace decisions to the existing policy" | Validprojection forwards paidactive/stalegrace and validexpiredpaidgrace, separatefromdirectpolicy parser. | `2f6a6e7d3cec0421b4dd041d2a4421aad9166a73cdc3d160ffa74be8bc69003f` |
| 140 | R | "treats user-editable cohort markers and boolean strings as invalid rather than legacy or truth" | Usereditable unknown/false cohort and stringaccessRevoked failinvalid. | `b76eb23ad8818caa54ed6ddce2a2cd7dafb6bcc8143e075032240d59565c53e9` |

## tests/billing-trial-history-backfill.test.ts

| Line | Verdict | Exact declaration title | Credible regression / limiting evidence | Callback hash |
|---:|---|---|---|---|
| 37 | R | "Stripe CLI defaults to read-only bounded provider page and returns resume cursor, not identities" | CLI defaultsapplyfalse, limit/cursorproviderquery and nextcursor; outputnotrawidentities. | `1fc0a10535c8e83e0d3710f4d2828739b2aea70468d5399af207c15ce27fa06a` |
| 59 | R | "explicit apply is routed; ambiguous verification prevents completion while provider errors issue no checkpoint" | Explicitapply routes verifier; expectedreview preventscheckpointcomplete, unexpectedprovidererror propagates; malformedCLI rejected. | `024b1b7bf1c64f47b6c463716b86e0b1d2392c647bcfe41abc98ecf5d815a1db` |
| 137 | F | "PayPal proof uses complete bounded actual transactions and rejects payer/app/window/duplicate/payment errors" | F: payer-mismatch fixture omits create_time aswell; same OR guard rejects evenif payercomparisonremoved. Preserve other app/window/duplicate/payment checks; repair fixture separately, no cutcredit. | `763c3a8dfaa833250711bcd2c61b71eb04524d9e4e16d47b3333c701f358282a` |
| 159 | R | "PayPal backfill binds canonical verified owner, dry runs then applies same HMAC namespace without emitting raw identities" | CanonicalPayPal billingowner verifiedemail and payernamespace preserved; dryrunzero writes, applyone, resultprivacy. | `578f4cf78d96380bea09597414142926c2aa887f3f726dcbd102edddbee4aa1f` |
| 201 | R | "backfill counts explicit Stripe test exclusions separately from skipped invoices" | excluded_test result must count separately from verified/skipped while pagecomplete remains true. | `db37a12d047b0d5a9f50110fb6e0f1ed987822e1e9bccaac9c13a7a0e4a2e28b` |
| 211 | R | "PayPal CLI excludes canonical QA before provider/owner processing but processes real profile backfill" | CanonicalQA excluded before verification/writes; backfilled-real metadata remainsprocessed. | `911c46f37f52f9f3ea203110eeecc7387ba83ff1137d586ea362434e648647b3` |

## tests/billing-trial-identity-claims.test.ts

| Line | Verdict | Exact declaration title | Credible regression / limiting evidence | Callback hash |
|---:|---|---|---|---|
| 8 | R | "projects a canonical identity tuple as a versioned SHA-256 HMAC claim" | Independent fixedHMACdigest pins tupleencoding/keyversion/SHA256. | `8e4b8a68ceef6a5811086005bc0290c826548cf79ba3a08b1d738a726354e6c4` |
| 25 | R | "separates kind, namespace, and key material" | Kind/namespace/keymaterial separate claims to preventidentitycollisions. | `bfd59b292f29ca557e12cac253c406b824a7eeb7ad855488c456166752ab7445` |
| 42 | R | "derives every retained key version and deduplicates identical projections" | Retainedkey order and dedup preserve exactlytwo uniqueversionedclaims. | `9a2312ec0bcbbb1a573362a4f5799fe4bc8e6701b8044fec531a42efaad733cc` |
| 58 | R | "does not normalize the trusted adapter input or mutate inputs" | Trusted normalizedIdentity opaque bytecontract: no lowercase normalization, no inputmutation. | `579213f76e8717a57e41ea0ecbf18353f84bccca3b46f8b81fb3943eb7b127b8` |
| 80 | R | "rejects malformed identity and key inputs without exposing their contents" | Malformedidentity/key cases mustreject without rawidentity/secret inerror. | `b45f3d49503b239699cb7e960923780c95d2dc114e519e81bc722277ae485d3e` |
| 121 | R | "rejects projections exceeding the SQL RPC claim cap" | Projection count cap64 mustreject9x8rows rather than truncatingSQLclaims. | `37b3f70b4da94405fd311af6b4b131066c0855a3cffb37d1e1b9acebc7143d98` |

## tests/billing-trial-paid-cancellation.test.ts

| Line | Verdict | Exact declaration title | Credible regression / limiting evidence | Callback hash |
|---:|---|---|---|---|
| 96 | R | "paid declaration is durable before provider effects, preserves full entitlement and queues one required receipt" | Actual durable cancellation accepted before providerrequest, repeatdifferentrequest same receipt, paidtermsunchanged, onenotice. | `867376e8ac190becae347a9e0be99bd881a73512139ab241a05af48c6e02245e` |
| 137 | R | "PayPal cancellation uses verified current successor while keeping immutable original ownership" | ActualPayPal verifiedsuccessor gets canceledonce and same receipt replay staysconfirmed. | `09b9b473fd57947ca65b6ab4f85d36cabc0ac63b653bb1bddbec40f14fe632da` |
| 161 | R | "foreign provider payer cannot trigger mutation but the owned customer declaration stays accepted" | Foreignpayer preventsprovidercancel whileowned declarationstayspending; wrongauthenticatedownerrejected. | `c03a9adf58d53909d529d7bb75527b71c152f6e03a658965ff711296fde5c9d6` |
| 178 | R | "Stripe cancellation delegates only after generic durable acceptance" | Stripe adapter calledonlyafteractualgenericdeclaration persists withrequest/user/effectiveend. | `396790910dae7258c346b40346d62efda7be41f328ca83690b71550b57567f1f` |
| 197 | R | "year two routes to statutory flow; direct writes and unauthorized roles cannot manufacture a receipt" | Secondannualperiod requiresstatutoryflow; no receipt fabricated byroles/directdelete. | `1b2a1a3f169d5518db6acf887579e59fbbcc2ae88f0923756e69624a8194af4a` |
| 229 | R | "paid cancellation HTTP requires auth, exact JSON and same origin without accepting client provider claims" | HTTP auth/exactJSON/origin rejectedbeforeoperation; no clientconfirmedflag. | `a3bdd0fcf21a21ec44e6ed17ab0097699d5bf2df989df4c4293ec7f60512691a` |

## tests/billing-trial-subscription-access.test.ts

| Line | Verdict | Exact declaration title | Credible regression / limiting evidence | Callback hash |
|---:|---|---|---|---|
| 135 | R | "subscription upsert omits an additive trial column for legacy rows and preserves linked retries" | Legacyupsert omits trialcolumns; linkedretry preservesenrollmentwithout inventingaccessfacts. | `a13b4e1b4c858c14b1c37badaedf3cd196b86f60f0c0147c1ec996839c0731d3` |
| 154 | R | "active verified trial access overrides provider fields and grants full app access" | Actualsubscription+app+paidapp guards consumeactiveprojection whenproviderperiodnull. | `16fd7f0babc6bc19541ae695b6301f3b067289364124f8acb8b41bd2651a1207` |
| 170 | R | "expired trial does not inherit stale active/null-end profile access at the exact expiry" | Expiredtrial mustnotfallthroughstaleactive/nullprofile; checkoutbecomesavailable. | `d0dea585320062e8ba34d886096c2eaac513892ab3e1c2b0f239de1f974e1da7` |
| 189 | R | "trial access remains strict after a failed first payment but admits later paid renewal grace" | Firstpaymentfailure locksafterwindow; priorpaidrenewalgracestillgrants. | `d37a91a3a86775aa3ee797cb2eedaff0c972f1de8c6b7d2814788fb0a8a83705` |
| 211 | R | "malformed trial projections fail closed while independent access and legacy billing remain valid" | Malformedmarkedtrial remainsknownhistory whileindependentmanual/oneTime andunmarkedlegacyremainvalid. | `e6aa51c1d2316c6afa2c91c2d18356b53ad4325b401f0ed5171b5c7cbb21befb` |
| 237 | R | "legacy profile access still blocks checkout when no trial marker exists" | Unmarkedactivelegacyprofile stillblocksnewcheckout. | `8b7bce88eb910552f01d943b7d9df8abbca441da29517a9086b1ca454cf1035f` |

## tests/billing-trial-cancellation-route.test.ts

| Line | Verdict | Exact declaration title | Credible regression / limiting evidence | Callback hash |
|---:|---|---|---|---|
| 26 | R | "route rejects unsigned targeting and requires authentication" | Unauthenticated or unsigned capability cannot target enrollment. | `9fa437e32aacd49805c7a188461403638fd41db0a918ab77ce15ccb37577acd2` |
| 53 | R | "capability issuance uses the confirmed owner RPC" | CapabilityGETmust consultownerRPC beforeissuing signedtoken; exactRPC exists independentPayPal body. | `2a0b1a2c1085bbb42a2c8eabe1a240601a4486f96b0712c4c471290c42cffb90` |
| 73 | R | "saved declaration is acknowledged when provider configuration is unavailable" | Saveddeclaration mustacknowledgepending even whenproviderconfigdisabled andStripefactorythrows if eager. | `fc82c7c81a94beb1813d54f5c1a2ebe24628d9e270616033322b315671096d67` |
| 104 | R | "PayPal capability and saved declaration immediately cancel only the exact owned trial" | ActualPayPal chain validatesownerandcancelswhileStripefactorymuststaylazy. | `895231a77fd84f4a5f6f379bd6860ee08900b2623bf2aa8ce3a4f09bc1ebe252` |
| 174 | R | "PayPal mismatched payer stays saved and pending without provider mutation" | WrongPayPalpayer keepssavedpending andzero cancel. | `82a3755c3d775d372bcd6aa8735c58069e5b74eae96d0260d5e681f8391847a6` |

## tests/billing-trial-required-notices-postgres.test.ts

| Line | Verdict | Exact declaration title | Credible regression / limiting evidence | Callback hash |
|---:|---|---|---|---|
| 78 | R | "authorization and payment ledger enqueue only confirmed events, once, with accepted facts" | Onlyauthoritativeauthorization/appliedpositivepayment enqueue once; termsfrozen, zero/syntheticextensionexcluded, actualrolesdeny. | `26f33b432c9ef91bd82631867cbd720d8c7dae868b49c7f916414add14e7d440` |
| 118 | R | "claim fence, immutable snapshot, crash parking, and queue acknowledgement are durable" | Leasedclaimdedup, immutable snapshot, queueACKterminal andcrashed leasepark protect againstduplicates. | `6c47ca62afb92380a49682d71c50bf659b606f01400973993c73d79ea6458433` |
| 182 | R | "annual due selection excludes unpaid/canceled and parks too-late notices" | Annualselector requirespayment and canceled-beforeclaim supersedes pendingnotice. | `619e3f92b5e4f31a076437727097fc9c8d0ca1f2d3d210f1b5f8b0fb8a34a80d` |
| 199 | R | "annual notices missed within seven days park, and months never get an annual notice" | Missed<=7dayannual parks forsupport; monthneverannual. | `38678e05c5608da5b53bbad48adaea320cbf4ddcae4185020eaf4dcf08d4d584` |
| 220 | R | "committed switch/restore confirmations use selected revision and preserve original deadline, while pending sends nothing" | Committedswitch/restore notice follows selectedrevision butoriginalconfirmationimmutable; pendingnothing, selectedpaymentreceiptandmonthannualexclusion. | `0456c95d287a9eaac81d04c660291a03fc62df7317ce8ab3669b3406feaa189c` |

## tests/billing-trial-analytics-delivery.test.ts

| Line | Verdict | Exact declaration title | Credible regression / limiting evidence | Callback hash |
|---:|---|---|---|---|
| 31 | R | "browser context requires explicit marketing consent and excludes IP, URLs, tokens and arbitrary fields" | Consentfalse excludes browsermatching; consenttrue permitsonlycookies/useragent, excludesIP/URL/token. | `fabf812c5217e4f7b91cdc5714204ab1f0c45781837ec3ecc8bed6a13bc62053` |
| 56 | R | "Meta verified activation maps to StartTrial with consented private matching and stable identity; diagnostics never leave PostHog" | ActualMeta JSON stableStartTrial zero+privacy; paidsystemgeneratedPurchase bothproviders, revokedconsent anddiagnosticdeliverydenied. | `93f0ccc57d4b6486cb10db8b0dd62ba5ce6e32969ce153a66719e829de648b73` |
| 149 | R | "PostHog keeps original versioned trial attribution and stable insert ID without private Meta fields" | ActualPostHog immutableattribution andinsertID withprivateMeta values stripped; mustnotrejoinnewsession. | `7056556261fd99e498a35a4e4156a42e3b9f071189fd7ffea0b16287b8efd516` |
| 192 | R | "versioned trial funnel delivery respects both rollout flags" | Eachdisabledflag combination skipswithoutRPC despiteversionedpurchase. | `6f8bf586fdf8282439db1b4be068df65ff9153994f75dbab270f4d5a9f86fc01` |

## tests/billing-trial-cancellation-declarations.test.ts

| Line | Verdict | Exact declaration title | Credible regression / limiting evidence | Callback hash |
|---:|---|---|---|---|
| 128 | R | "accepts an initial owner declaration before provider work and preserves trial access through the immutable deadline" | ActualSQLdeclaration+receipt/providerqueue setcancelbeforeprovider; accesspreserveduntildeadline. | `2805d795621837fdf92badf35fbbec69ee6fbf9ce1f06a00c4eb204024d0f32c` |
| 179 | R | "returns the original declaration facts on same-owner retry and rejects altered request ownership" | Same-ownerreplay stayssame throughpaid/revokedlifecycle; requestidentitycannotmoveenrollment/owner. | `2766bf4805b0e3b643bbdb90cf6a81404352b64589351b3c6f131031bdd5be25` |
| 225 | R | "rejects paid, revoked, and malformed cancellation declarations without persisting receipt work" | Paid/revoked andbadUUID rejectwithoutreceiptpersisted. | `feb817ce46876c372138771dfd7bfcd3a65f4d05d37e8b5b9b54da84cfa8f3b1` |
| 256 | R | "keeps cancellation declaration RPC execution service-role-only" | Actualanon/authdenied/serviceaccepted plusimmutabilitytrigger. | `96a65ff2e84f53d2e31c9634685d81d0dc092a69f75cbb122b9f22c36b3f2f31` |

## tests/billing-trial-cancellation-provider-operations.test.ts

| Line | Verdict | Exact declaration title | Credible regression / limiting evidence | Callback hash |
|---:|---|---|---|---|
| 43 | R | "provider operation RPC exposes only the exact owned billing link and confirms idempotently" | ExactSQLownedbillingprojection andsameevidenceconfirmationreplay keepsfirsttimestamp; foreignowner no rows. | `a6fc6a0ee03d5140d8f43efea1afedec9cf8997e539a12cd8ebdca3b2e63cfd0` |
| 109 | R | "provider operation RPC cannot confirm after a restore or ownership-link race and remains service-only" | Restoredcancel=false mustblockconfirmation andauthenticatedloaddenied. | `0e77f4176d675bf7273c432d1b492dc0677daf30551ee8818caee97e84daeea9` |
| 138 | R | "confirmation compares the exact provider evidence, including a concurrently replaced billing customer" | Wrongagreement/customer/end andconcurrentbillingcustomerreplacement blockconfirmation andkeeppending. | `4229bf70d65aeec6efe86833aa11629333d2ababc6d8dc9eb7277677cc98e1c9` |
| 165 | R | "PayPal confirmation requires the owned payer, trial cohort, and plan pin" | PayPalplan/cohort/payerprojection andactuallease mustpinconfirmation; wrongplan/wronglease rejected. | `844099003f27417466dbe216c57ea70adad43acfac8c6ed08e4c6703cb79d42e` |

## tests/billing-trial-checkout-attempt.test.ts

| Line | Verdict | Exact declaration title | Credible regression / limiting evidence | Callback hash |
|---:|---|---|---|---|
| 39 | R | "atomically creates immutable server enrollment rather than reusing the client attempt ID" | SQLcreatesdistinctserverenrollment, sameclientretry retainsfrozenoffer, intervalconflict andforeignprofile denied. | `66f70b2211e359e876494d3e8216e012f3feaaa892efa1015daecba5d265b457` |
| 65 | R | "freezes once, binds the same provider reference idempotently, and requires reconciliation after horizon" | Freeze/bindidempotency pinsproviderreference; staleunbound needsreconcile butlateknownreference canbind. | `e8b05a1d39c680a8d998bbd083880cea498d1af5c7b6b2e6976801627ef9f744` |
| 123 | R | "adapter accepts PostgREST singleton composite rows and rejects ambiguous shapes" | Adapter acceptsobjectandonesingleton only; multipleRPCrows rejected. | `5968774223dd2e50f90a25046f80f2ab252c9f36ae4c967a51d51d4991be0f4d` |
| 163 | R | "private table and RPCs reject unprivileged access" | Actualprivate table/function grants denyunprivilegedroles. | `e55ec98b91d3e01d1bb9aa93dc95844b6a684daecf60a5871282b791e945ff90` |

## tests/billing-trial-paid-continuations-postgres.test.ts

| Line | Verdict | Exact declaration title | Credible regression / limiting evidence | Callback hash |
|---:|---|---|---|---|
| 101 | R | "a paid successor requires verified neutralization, matching customer, operation and unchanged entitlement" | Neutralization/customer/candidate/cancel/revocation checks neededbeforebinding; exactreplay andoriginalagreementpreserved. | `47ab07af3979d19ec2ea7306192ad0cab146073b0a4ebdab117db78c6e1c1793` |
| 125 | R | "only the bound successor can renew; an old-source invoice replay stays duplicate" | Onlyverifiedsuccessor renews; oldfirstinvoice replayduplicate andforged/oldnewinvoice rejected. | `e67f5e439e3c1499220d57539d3a049234e86f07cd459d47cd92a723f80b1903` |
| 148 | R | "successor lookup and binding are private and cannot clear a later cancellation on replay" | Roleprivacyandservicedelete restrictions; successor replay cannot clear latercancel. | `041697134355e9df391eab79b1c2007d511fa29c993264ef579ea483fd2f8fc0` |
| 178 | R | "only a committed recovery candidate can transition to its verified final paid agreement" | Onlycommittedrecovery source transitions verifiedfinalagreement once; history/effectivebinding updated andoldcandidatepaymentblocked. | `0b2a7e01170ee19522d76062977cb52b696d6f5cc372421bf0b865546d3c63fb` |

## tests/billing-trial-paid-migration-authority.test.ts

| Line | Verdict | Exact declaration title | Credible regression / limiting evidence | Callback hash |
|---:|---|---|---|---|
| 102 | R | "does not treat an active free trial or stale active profile as historical paid migration authority" | Free/unpaidtrial+stal eprofile andmarkernolink cannot authorizepaidmigration. | `f87861fe0f3573e131e0495892eaf6c76c06d9d3490c426bae825289f21a992b` |
| 120 | R | "admits only a linked trial with a successful first payment and verified paid access" | Paid andgrace admitted, expired/unknownmarker denied; correctsourceID retained. | `e6b2f56d5123cf045251870c95ae3a6e8db479d3159d9ec3056c32f81ac32cc5` |
| 157 | R | "keeps independently eligible legacy billing and one-time purchase candidates" | Independentlegacybilling anddeliveredoneTime admission surviveexpiredtrial. | `25a9f0a9620f493476ba5ec18c9147588ce5c60a75341e87baa25cb94d78df6d` |
| 208 | R | "keeps the authority function service-role only" | Privatepaidmigrationauthority function authenticateddenied. | `ade987cf8bb17d116bf7aa0801d6f2e420e92c40c28ae57d6a39571e6cbca999` |

## tests/billing-trial-paid-recovery-route.test.ts

| Line | Verdict | Exact declaration title | Credible regression / limiting evidence | Callback hash |
|---:|---|---|---|---|
| 93 | R | "paid recovery requires server authentication, exact consent fields and same origin before mutation" | Recovery HTTP exactconsentkind/revision/origin/authbeforewrites. | `e3cee0451d69cf1c29670e9ba185bf26f84d8a1a23e4dd4770f17420f84d681c` |
| 114 | R | "provider approval follows accepted durable action and retries load the same owned operation" | AcceptedbeginthenPayPal vsretryloadthenStripe; foreignowner409 beforeprovider. | `1b094e0bc6bf8a4a54cdcbbe885fb2afba27c77e56722c8cc9c4a1011c38852f` |
| 134 | R | "ambiguous provider results preserve pending action; forged return destinations never reach client" | Throw/evilhost/nondefaultport/userinfo allpending withoutredirectleak. | `0a533c5c6f6023027b95f00d8637a24a952a15ec1b3879efc54ecc8309554759` |
| 155 | R | "public recovery view omits provider internals and preserves frozen first/renewal terms" | PublicGET removesprovider IDs, keepsfrozenfirst/renewal andpendingrepair, invalidrevision503. | `8caf497bb3d204776403cc8fab1a138fd811cf471e8018f4367d0aa2b4b0e6a1` |

## tests/billing-trial-prior-paid-history.test.ts

| Line | Verdict | Exact declaration title | Credible regression / limiting evidence | Callback hash |
|---:|---|---|---|---|
| 58 | R | "historical NULL-enrollment claims block a new trial and replay keeps earliest use" | Historicalnullownerclaims blocknewtrial, earliestconsumptionimmutable, authenticateddenied. | `bd83b00a8b94da68b15081b35ffe9146871fe8d8d71f91a22b1c2dc9563884e5` |
| 70 | R | "prior payment winning before authorization consumes a reservation and denial retains neutralization" | Priorpaidwinsbeforereservedauthorization: claimownershipnull and blockedneutralization persists. | `c9dd6f71dfab5924dcc8a3ce6555ca2d2fa2f2f6f4ddcefcfba92f9e5c753086` |
| 89 | R | "authorization winning first preserves consumed enrollment ownership and replay" | Authorizationwinsfirst: consumedownerstaysenrollment; replay andrawEmailmalformedclaim refusal. | `f493ab21b476f3e04eed4471097177f40a0a81f5da213a2087a7370300b7f3c4` |
| 102 | R | "history helper writes only normalized versioned HMAC claims, never raw identity or provider proof" | Helper serializes6HMACclaims under2keys without rawIDs; zeroamount stopswrite. | `681d55f35448ff0754890429b3ad7c6c6eef4dc58b2dcb2f3ef39588708a5c85` |

## tests/billing-trial-effective-payment-contract.test.ts

| Line | Verdict | Exact declaration title | Credible regression / limiting evidence | Callback hash |
|---:|---|---|---|---|
| 114 | R | "a committed monthly-to-annual revision controls the actual first charge and paid period" | Committedselectedannualcontract controls6999 actualledgercharge+fullyear whileoriginalacceptedmonthimmutable. | `038581cd313c5ec8050406da2abc68b3737e7c90a4aaba67a498a452f6b66270` |
| 155 | R | "after a confirmed replacement, old agreements cannot charge through a new effective contract" | Replacementbinding rejectsoldagreementpayment thenacceptsexactnewagreement viaeffectivecontract. | `348f947f6b7a931f6a9f7b8db0d63c0d64db7af448d43ca0744b3e280f02ad76` |

## tests/billing-trial-payment-reconciliation.test.ts

| Line | Verdict | Exact declaration title | Credible regression / limiting evidence | Callback hash |
|---:|---|---|---|---|
| 59 | R | "service-only paged operator projection exposes reconciliation facts without user or offer data" | ActualoperatorSQL exposespayment+continuationreconcile withoutuser/offer/providerpayload anddeniesanon/auth. | `fa83bd01af3b9dab3e87236f7fda8c3fda4208b22aefcd78fa230bf593e1b872` |
| 101 | R | "read-only CLI pages through the dedicated RPC and rejects mutation-shaped arguments without RPC calls" | CLI list paginationRPC exactlimit/offset andapplyrefusal beforeextracall. | `9b69d21eb0a5dbf5333bad604aad55642869d58637c453f12da03e1583e4c30d` |

## tests/billing-trial-analytics-postgres.test.ts

| Line | Verdict | Exact declaration title | Credible regression / limiting evidence | Callback hash |
|---:|---|---|---|---|
| 6 | R | "actual outbox schema accepts trial_started after additive migration and preserves legacy names" | Actualpredecessorconstraint rejectsnewname thenadditiveDDL admitsnineold/newnames; unknown andduplicatekey stillrejected. | `d376ad9622e9403f97bc2966aac3372e88d855d4dd6b274ac3a378cdc83b0bec` |
