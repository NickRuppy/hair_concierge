# Welcome static-to-owner reassessment

{'R': 19, 'F': 18, 'C': 2, 'D': 2}; 41 sites, four conditional cuts, no repository writes/runners. All body/file hashes are in companion JSON.

## tests/welcome-email-display.test.tsx

SHA256 `cb522ce336266f04f7680e16921b02c19bc26ce75449feb439cea7594a54d54f`

| Line | Verdict | Exact declaration | Contract / fault / limit |
|---:|:---:|---|---|
| 18 | F | PayPal welcome passes Chaarlie and provider subscriber emails separately | Separate account/provider-email projection is meaningful, but exact activation identifier spelling is private. Active PayPal account rendering is absent from selected actual server keeper inputs; preserve for executable repair. |
| 23 | F | PayPal welcome uses a hashed analytics id instead of the activation token | Token must be SHA256-derived before analytics; do not delete. Existing actual server PayPal fixtures all use token literal token, so they cannot reject replacing update(token) with update("token"). Client fallback also needs actual capture. Helper identifier syntax should be replaced only once full varied-input proof exists. |
| 31 | F | PayPal pending polling depends on the stable token instead of the activationSource object | Stable-token effect dependency prevents polling restarts on parent object recreation. Existing browser fixture creates activationSource once; internal rerenders retain same prop object, so it does not detect object-dependency regression. Retain behavior for a proper parent-rerender test, not raw dependency-array spelling. |
| 44 | C | terminal PayPal activation polling reports a typed payment failure without the token | Existing browser timeout keeper drives the real WelcomeClient through15 pending PayPal responses and six extra seconds. Its existing exact inputs hit the one capturePaymentFailure site inspected by the donor. Record actual capture arguments and assert one exact literal13-field payload, excluding any extra token/identifier field. No new poll/input/call. |
| 58 | C | welcome labels the account email as Chaarlie-E-Mail | Existing email resend keeper renders the actual activation-choice branch for alex@example.com before interactions. The source has exactly one account-email label in that branch. Assert getByLabel(Chaarlie-E-Mail) value alex@example.com and no old rendered label, then preserve all existing failure/resend/password assertions. |
| 63 | F | welcome only shows PayPal-E-Mail when it differs from Chaarlie email | Provider email should be hidden for equal/blank case-normalized addresses. Current browser props omit providerSubscriberEmail, so they do not prove unequal/equal normalization. Private showProviderSubscriberEmail binding is not the contract. |
| 73 | F | one-time welcome recovery selects the order activator and neutral access copy | PayPal one-time route must invoke order recovery and retain neutral access copy; source names do not prove dispatch. Current native fixtures do not supply purchase=one_time. Retain for actual one-time owner repair. |
| 83 | F | one-time pending polls the provider-neutral activation status route | Provider-neutral one-time polling URL must carry provider plus exact token/session_id keys. Current browser fixture purchaseKind is absent; helper name/toString shape is fragile, and no existing input-complete delivered request keeper was found. |
| 94 | F | Stripe one-time welcome renders paid-pending instead of activation choices | Account.state nonactive should emit pending one-time client. Global source snippets can match other branches; selected actual server recovery keeper exercises verification failure, not ensureOneTimeCheckoutAccount returning inactive. |
| 100 | F | authenticated Stripe and PayPal one-time returns pass their derived Personal Plan destination to the shared redirect contract | Signed-in one-time Stripe/PayPal must use derived Personal Plan destination. Current route fixtures have no active one-time account or profile query. Keep contract; private wrapper/call syntax is not independently normative. |
| 122 | F | one-time activation errors render a safe support or revoked state instead of repricing | One-time activation exceptions must become revoked/support UI, not repurchase. Existing paid verification failure is an earlier branch and does not execute account activator catch or PayPal order catch; no whole cut. |
| 149 | F | paid Stripe checkout_one_time_invalid verification failures recover to pending support instead of pricing | Paid provider reread must distinguish mode payment AND status paid before terminal classification. Existing native keeper covers paid and non-payment but not payment+unpaid; dropping payment_status conjunct would evade it. Private branch slicing needs repair, not deletion. |
| 172 | D | a paid Stripe verification failure preserves the revoked return state | Existing real WelcomePage invocation throws CheckoutActivationError(checkout_one_time_charge_revoked), retrieves payment+paid and asserts returned oneTimeReturnState revoked. Donor only checks a private helper signature and the same code string anywhere; it adds no independent support_needed behavioral assertion. Existing keeper catches actual incorrect mapping and survives helper/type alias rename. |
| 180 | F | unpaid or non-payment Stripe verification failures expose safe recovery without repricing | Non-payment/unpaid recovery must remain safe; native non-payment and unpaid error-code cases do not supply recovered payment+unpaid. Keep conjunct requirement; source var names are replaceable. |
| 198 | F | PayPal one-time pending and revoked returns do not require an account | Nonactive PayPal order may lack account and must not read it before pending return; native PayPal fixtures exercise subscription adapter, not purchase=one_time. Source index order is weak real control-flow proof; retain for repair. |
| 218 | F | one-time pending accepts pending states, reloads active, and blocks permanent states | One-time pending/paid_pending/active/revoked/permanent outcome transitions have distinct retry/reload semantics. Browser harness is non-one-time and cannot own these despite similarly named PayPal pending cases. Presence of status strings and reload call alone is weak proof. |
| 231 | F | retryable support can poll again while revoked and terminal failure stay support-only | Retryable support may re-poll while revoked/permanent stays blocked. Dependency-array/private state names freeze implementation; no selected real browser input exercises purchaseKind one_time and these return states. |
| 251 | R | one-time pending timeout is support-safe and never offers repurchase | Exact timeout German copy and absence of repurchase/pricing affordance are user-facing bytes. No rendered one-time timeout input currently exists; removing the reassurance or adding Erneut kaufen fails this independent cheap guard. |
| 263 | R | one-time pending renders the approved calm copy and progress labels | Approved one-time pending headline/body and confirmation/opening labels are customer copy, not private symbols. Changing those strings fails. Selected browser fixtures do not enter this branch. |
| 274 | F | checkout return analytics does not emit completion events without server purchase truth | Browser conversion suppression and verified server purchase truth remain distinct contracts. Acquisition sibling executes suppression helper for trial/one-time/PayPal inputs, but does not execute server purchase payload gating; whole callback is not redundant. Private call/const/source ordering should be replaced by delivered event proof. |

## tests/welcome-plan-opening-bridge.test.ts

SHA256 `2770e2bbe87d60c3d0575e2d241552b20ce74c637d5074e49631fbddf49bd7d0`

| Line | Verdict | Exact declaration | Contract / fault / limit |
|---:|:---:|---|---|
| 18 | F | plan-bereit redirects paint the opening frame and stamp the beat marker | Plan-bereit redirect must render loading frame and stamp opening beat. Marker/component names can be aliased without behavior change; selected browser fixture stubs opening components and never supplies redirectTo, so no keeper. |
| 25 | F | activation-ready plan-start redirects share the choreography instead of the Weiterleitung flash | Activation-ready plan-start redirect must arm stage entrance and use destination opening shell. Exact local variable/component names are not contract; no actual redirectTo input in selected browser fixture. |
| 32 | F | other redirect targets keep the generic confirmation screen and no-JS keeps a real link | Generic redirect copy and no-JS destination link are meaningful. Source presence does not prove branch/link destination and href variable syntax is private; keep until actual redirect rendering covers it. |

## tests/welcome-activation-return.test.ts

SHA256 `b4714af57b0a0ddc7206d437e9efbdd0937d9a500daf6512138929b43ea2cd06`

| Line | Verdict | Exact declaration | Contract / fault / limit |
|---:|:---:|---|---|
| 188 | R | persisted Stripe trial denial renders before account writes or destination reads for signed-in and anonymous returns | Real WelcomePage must return persisted trial_unavailable panel before any account/destination work, for both signed-in and anonymous users. Removing preflight guard exposes wrong client/calls. Primary D2 keeper. |
| 197 | D | the preflight guard is sensitive to an in-memory bypass | Donor deliberately replaces the real preflight guard with if(false), then expects the wrong/bypassed behavior. Adjacent actual-source keeper already uses the same persisted denial and verifies exact recovery panel plus no account/destination calls, for both signed-in and anonymous returns. In-memory source mutation is calibration support, not a second product contract. Removing the guard makes that keeper fail; preserve that proof with parent-only mutation control. |
| 204 | R | Stripe verification failures keep paid one-time returns pending and classify terminal failures | Actual page handles paid revoked return as pending revoked email, typed structural/resource failures as exact panels and generic temporary exception without raw detail. Private helper/code mapping mutation loses literal returned state. Primary D1 keeper. |
| 248 | R | PayPal recovery duplicate uses a terminal panel while legacy duplicate retains its existing client mode | Same duplicate status with recoveryCode renders terminal panel; without code preserves legacy duplicate client. Ignoring recoveryCode or forcing all duplicates terminal changes returned component/mode. |
| 263 | R | invalid PayPal token and failures render safe terminal panels without raw provider errors | Missing PayPal token becomes invalid-link panel; generic provider error stays private; typed recovery code remains reconciliation. Leaking exception detail or swallowing specific recovery code fails. |
| 287 | R | incomplete and unpaid Stripe returns allow finishing the same checkout | Incomplete and unpaid verification error codes render checkout_incomplete and never call account activation. These are provider error-code recovery cases, not recovered payment_status coverage. |
| 302 | R | inactive PayPal returns offer support instead of retrying a terminal checkout | Inactive PayPal subscription maps to terminal reconciliation rather than retry loop. Removing persistent-provider classification returns temporary and fails. |

## tests/welcome-activation-outcomes.spec.ts

SHA256 `c3325ff91decf7de3246882e0b6be84fb6abc0a2d0480b675fdef7e2e60002f3`

| Line | Verdict | Exact declaration | Contract / fault / limit |
|---:|:---:|---|---|
| 71 | R | verified terminal denial replaces activation choices and links to real recovery destinations | Verified denial renders exact heading, support/login hrefs, focused alert and survives reload while removing activation. Existing terminal matrix lacks focus/reload proof; do not pack this behavior into it. |
| 95 | R | `${provider} post denial uses trusted code rather than server exception text` | Both provider POST paths consume trusted code and suppress private response text; error string rendering or code omission fails. |
| 113 | R | email send failure keeps password input and allows a successful resend | First send500 followed by successful resend preserves password and transitions to sent at request2. C2 transfers account-email label and old-label absence before existing actions; input stays identical. |
| 135 | R | used activation claim leads to normal login without offering another activation attempt | Used activation claim409 exposes normal login and removes magic-link resubmission; treating it as transient fails. |
| 147 | R | PayPal terminal polling outcome stops pending and exposes support | Initial PayPal pending receives duplicate/conflict and stops after one poll with terminal heading/no retry; generic pending behavior would continue or mislabel. |
| 159 | R | password saved but sign-in failed offers login with the new password | Password endpoint success with sign-in failure must offer login using saved password; swallowing sign-in error or generic form fallback fails. |
| 172 | R | `${code} retains both password fields and supports retry` | Temporary503 and rate-limited429 retain both password fields and allow retry request2. Each trusted code must remain recognized inline; no generated declaration inflation. |
| 190 | R | all terminal recovery states remove resubmission and private account details | Eight existing terminal codes remove inputs/email and retain one auth/support link each. Lost membership, wrong action destination or exposed account details fails; preserves already-existing loop cases. |
| 212 | R | PayPal pending POST continues status checking and handles a non-2xx terminal result | POST activation_pending transitions into polling; a non2xx reconciliation code must still become terminal. Handling only response.ok loses this boundary. |
| 227 | R | pending refresh preserves the same return reference | Manual status retry reloads without losing session_id cs_fixture; stripping canonical return proof fails. |
| 234 | R | PayPal poll timeout replaces the spinner with status-retry feedback | Real timer-driven15 polls then stops for another6s and displays delayed/retry feedback. C1 adds exact owner-produced payment-failure payload to this already-executed timeout. Stub only records arguments, does not synthesize the payload. |
