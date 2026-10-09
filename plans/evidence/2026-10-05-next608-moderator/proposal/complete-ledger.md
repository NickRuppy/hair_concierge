# Moderator and field-test access: complete 183-site ledger

Read-only proposal: **169 R / 13 held F / 1 conditional C / 0 D** across exactly 27 files. F remains in every phase and earns no repair/removal credit. Native baseline, mutations, final proof and independent preservation are main-owned and pending.

Each source location refers to the before snapshot. Full callbacks and extracted assertion expressions/hashes are in judgments.json and ast-mapping.json. Row evidence names the actual observation, credible regression or specific unproved claim.

## tests/moderator-account-maintenance.test.ts

| Line | Mark | Existing declaration | Contract / credible regression / gap |
|---:|:---:|---|---|
| 107 | R | dry-run parsing has no network and apply needs all exact gates | Preview makes no calls; apply requires exact opt-in/project gates. Wrong-target production mutation remains independently guarded. |
| 131 | R | rejects manifest count, duplicate identifiers, and mismatched email before calls | Count, duplicate ID and email mismatches stop before any operation. Protects the exact-account batch boundary. |
| 161 | R | missing or invalid JWT proof stops before logout | Missing/invalid JWT proof prevents logout; catches accepting unverified token lifetime. |
| 185 | R | unbanned ban response is rejected and needs manual recovery | Unbanned readback requires recovery instead of accepting a successful transport response as restriction proof. |
| 212 | R | journal failure after confirmed ban preserves recovery state | Four journal-failure stages after restriction preserve recovery state; protects partial-operation recovery. |
| 230 | R | ban marker must round-trip while unrelated app metadata is preserved and never journaled | Round-trip marker, unrelated app metadata preservation and receipt redaction protect persistent authentication state. |
| 265 | R | ban marker must not replace pre-existing app metadata | Readback must preserve pre-existing metadata; marker-only replacement is rejected. |
| 296 | R | preflights every identity before a journal or mutation | All identities are verified before journal or mutation, preventing partial work on an invalid later account. |
| 325 | R | initial private journal failure prevents every mutation | Initial journal failure makes every mutation unreachable; protects pre-write recovery evidence. |
| 343 | F | global logout precedes 24h ban and journals no secrets | F: logout ordering uses indexOf without requiring logout presence; -1 can precede the ban. Deadline and secret-redaction assertions remain valuable. Retain unchanged; repair requires independent presence/order proof. |
| 366 | R | delayed restrictions extend the conservative reset deadline beyond minted token expiry | Delayed restrictions extend reset deadline beyond token expiry, guarding tokens minted during the restriction gap. |
| 400 | F | mid-batch failure stops remaining accounts and never auto-unbans | F: failure occurs on account two of a two-account batch, so no remaining third account proves stop. Partial recovery assertions remain; no auto-unban operation is supplied to exercise that claim. |
| 429 | R | maintenance link identity mismatch prevents global logout and ban | Magic-link identity mismatch prevents logout and ban; protects exact subject before disruptive operations. |

## tests/moderator-account-reset-execution.test.ts

| Line | Mark | Existing declaration | Contract / credible regression / gap |
|---:|:---:|---|---|
| 27 | R | uses manifest bytes as the sole plan input and refuses blocked bytes before writing | Manifest bytes are sole plan input and blocked proof produces no artifact; catches bypassing byte-validated plan. |
| 47 | R | refuses repository output paths without writing a private artifact | Repository output is refused without private artifact writes; distinct filesystem safety boundary. |
| 65 | R | refuses main-root, symlinked, and not-yet-created worktree descendants | Primary root, symlink paths and future worktree descendants are refused; normalization/realpath escape protection. |
| 91 | R | requires an existing output parent to already be private | Existing output parent must already be private; protects confidentiality without silently fixing permissions. |
| 112 | R | production preparation refuses a missing, mismatched, or shortened maintenance journal | Maintenance journal must match account, cutoff and lifetime proof; missing/mismatched/shortened proof rejected. |
| 165 | R | production preparation binds a valid maintenance journal into the SQL header and receipt | Actual SQL header and receipt bind the valid journal digest; execution-consumer test does not inspect this header. |
| 185 | R | production preparation waits out a JWT that could be minted before a delayed ban | Delayed ban still waits out a token minted before restriction; distinct clock-bound authorization case. |
| 215 | R | production preparation consumes the actual applyMaintenance journal contract | Actual applyMaintenance-produced journal is consumed by preparation, protecting cross-owner format compatibility. |
| 280 | R | writes private SQL and a redacted receipt without applying or making a network call | Private SQL/redacted receipt have correct mode and applied=false with zero network calls; output publication boundary. |

## tests/moderator-account-reset.test.ts

| Line | Mark | Existing declaration | Contract / credible regression / gap |
|---:|:---:|---|---|
| 24 | R | blocks incomplete private manifest proof instead of generating reset SQL | Incomplete private proof refuses SQL generation; unsafe manifests cannot become operational scripts. |
| 39 | R | blocks unclassified owner tables and billing-linked state | Unknown owner tables and billing-linked state block generation; fail-closed inventory completeness. |
| 56 | R | production reset refuses missing payment replay cutoff proof | Production requires payment replay cutoff proof; prevents old payments resurrecting reset access. |
| 66 | R | the operational payment cutoff cannot be removed as legacy app metadata | Cutoff cannot be selected for legacy metadata removal; durable replay defense survives reset. |
| 74 | R | drains requests that may start immediately before the last JWT expires | Drain includes requests beginning just before JWT expiry, not only token validity duration. |
| 84 | R | waits out tokens minted between global logout and the confirmed login restriction | Drain includes tokens minted in logout-to-ban interval; distinct delay input. |
| 97 | R | reset supports an exact fixture with no manual grants | Zero manual grants remains valid exact fixture; SQL handles empty ownership arrays. |
| 113 | R | production SQL rechecks maintenance and clock inside the reset transaction | Actual generated SQL rechecks ban, cutoff, sessions/refresh and database clock before transactional deletion. |
| 163 | R | generated guarded SQL resets app state and preserves login identity | Generated SQL deletes owned app state while preserving auth/profile identity and unrelated conversation; tests actual SQL against fixture schema. |
| 229 | R | generated SQL aborts on count mismatch before deleting data | Count drift aborts transaction before deletion, preserving all evidence. |
| 250 | R | generated SQL aborts on same-count runtime payload drift before deleting data | Same-count payload change aborts by runtime fingerprint; count-only guard would miss it. |
| 274 | R | cross-owner exact-email lead blocks reset and preserves both owners' state | Foreign owner with exact-email lead blocks reset and preserves both owners, protecting cross-owner ambiguity. |
| 305 | F | retain-zero billing and backup rows block reset without deleting evidence | F: billing and backup rows are seeded together, so earlier billing guard can mask missing backup guard. Retain refusal/evidence preservation; no deletion or repair credit. |
| 341 | R | foreign funnel session or prepared artifact linked to an owned lead blocks reset | Foreign funnel and prepared-artifact cases independently prevent cross-owner deletion through owned lead correlation. |
| 377 | R | child residual checks keep frozen conversation ownership after parent deletion | Residual child trigger after parent deletion is detected using frozen ownership; catches lost ownership closure. |

## tests/moderator-hosted-activation-probe.test.ts

| Line | Mark | Existing declaration | Contract / credible regression / gap |
|---:|:---:|---|---|
| 200 | R | dry run makes no hosted calls and reads no environment | Dry run makes zero hosted calls and avoids environment accessor; safe command preview. |
| 209 | R | rejects wrong project, unsafe args, and non-production URL before apply | Exact project, production URL and safe arguments gate apply before operations. |
| 244 | R | happy path uses independent parallel activation calls and exact guarded cleanup | Actual orchestrator schedules separate activation ports and guarded cleanup; fake receipts prove protocol handling, not real database concurrency. |
| 283 | R | cleanup refuses to delete when fixture identity marker mismatches | Fixture-marker mismatch forbids deletion; exact cleanup identity protection. |
| 300 | R | wrong email progress change fails the probe even when rejected | Wrong-email progress mutation fails even after denial; refusal must have no unauthorized state change. |
| 320 | R | unexpected 4xx denials are not accepted as proof | Unexpected 4xx is not accepted as authorization proof; exact denial contract. |
| 338 | R | partial parallel activation response is recovered for cleanup but does not report success | Partial parallel response recovers IDs for cleanup but never green proof; distinct incomplete-response path. |
| 384 | R | activation replay must have identical receipt fields and exact 2160 hour expiry | Replay receipt fields and exact 2160-hour expiry must match; catches unstable replay identity/timestamps. |
| 409 | R | final journal failure marks the probe unsuccessful after cleanup | Final journal failure after cleanup prevents success; durable evidence is part of probe outcome. |
| 429 | F | source keeps cleanup conservative around auth deletion and exact auth absence | F: private cleanup identifiers/source ordering are fragile; broad campaign/user regex can match another lookup. Keep the cleanup protection pending actual adapter-bound proof. |

## tests/moderator-hosted-auth-probe.test.ts

| Line | Mark | Existing declaration | Contract / credible regression / gap |
|---:|:---:|---|---|
| 132 | R | dry run makes no hosted calls | Dry run invokes no hosted operations; operational preview contract. |
| 140 | R | rejects wrong project, unsafe user arguments, and a non-hosted production URL before calls | Wrong project/user arguments/non-hosted production URL refuse before calls. |
| 161 | R | optional expiry observation checkpoints then proves only explicit PostgREST JWT-expired 401s | Optional expiry observation bounds polling and accepts only explicit JWT-expired PostgREST GET/PATCH denials; no real provider proof. |
| 211 | R | expired network failure cannot prove expiry and still cleans the fixture | Network failure cannot establish expiry, but fixture cleanup still happens. |
| 234 | R | uses a verified maintenance JWT before the second ban and writes sanitized receipts | Verified maintenance JWT precedes second restriction; sanitized receipt excludes secret/token fields. |
| 262 | R | failed residual read is not absence | Residual-read failure is not absence; cleanup proof remains fail-closed. |
| 284 | R | network failures cannot prove login restriction or refresh revocation | Network errors do not prove login restriction or refresh revocation; preserves distinct authentication observations. |
| 307 | R | failed initial journal stops the probe but still cleans the created fixture | Initial journal failure stops probe mutations but cleans already-created fixture. |
| 321 | R | maintenance subject mismatch stops before logout and still cleans the exact fixture | Maintenance subject mismatch prevents logout and cleans exact fixture. |
| 344 | R | a thrown mid-probe operation still cleans fixture and writes a final receipt | Thrown operation still cleans fixture and writes sanitized final unsuccessful receipt. |

## tests/moderator-organic-fresh-start.test.ts

| Line | Mark | Existing declaration | Contract / credible regression / gap |
|---:|:---:|---|---|
| 20 | R | new organic moderator start clears the legacy quiz draft once before restore | Fresh start clears legacy draft once and consumes boundary flag once; repeated entry does not destroy new work. |
| 36 | R | blocked browser storage fails closed | Blocked browser storage fails closed instead of accidentally restoring prior answers. |
| 55 | R | a failed first boundary can be safely initialized from the reused server session | Failed initial storage boundary can recover from reused server session with fresh-start semantics. |
| 79 | R | response parsing allows progress-routed and older active returns without quiz state | Active account routes and legacy active responses parse without quiz IDs; external/malformed destinations rejected. |
| 90 | R | server-confirmed resume does not clear a current quiz draft in a new tab | Explicit server resume preserves draft in a new tab; distinct false fresh-start input. |
| 112 | R | quiz response requires an explicit fresh-start flag | Quiz destination requires explicit fresh-start flag; omitted value cannot imply safe initialization. |

## tests/moderator-quiz-draft-scope.test.ts

| Line | Mark | Existing declaration | Contract / credible regression / gap |
|---:|:---:|---|---|
| 8 | R | fresh moderator draft scope cannot restore legacy or another start's answers | Legacy and other-start answers cannot load through fresh scoped storage; remove stays in exact scope. |
| 30 | R | authenticated moderator entry clears only known unscoped quiz data | Only known unscoped keys are cleared; unrelated and scoped data remain intact. |

## tests/personal-plan-field-test-activation-route.test.ts

| Line | Mark | Existing declaration | Contract / credible regression / gap |
|---:|:---:|---|---|
| 41 | R | activation refuses an existing customer browser before creating or granting access | Customer session returns 409 before guest creation or grant; browser identity boundary. |
| 68 | R | activation creates and signs in one scoped guest before the exact service transaction | Create, sign-in and activation order plus exact claim cookie/destination bind one recoverable guest. |
| 105 | R | activation failure preserves the new guest session cookie for an exact retry | Activation 503 retains new guest session cookie, enabling an exact retry rather than another account. |
| 132 | R | activation fails closed when the persistent rate limiter is unavailable | Persistent rate-limiter outage returns 503; fail-closed admission independent of service transaction. |

## tests/personal-plan-field-test-activation.test.ts

| Line | Mark | Existing declaration | Contract / credible regression / gap |
|---:|:---:|---|---|
| 9 | R | guest creation uses a non-deliverable synthetic identity and never returns persisted credentials | Actual guest adapter generates non-deliverable synthetic identity, exact metadata and secret strength; persisted credentials not returned. |
| 33 | R | activation calls the service-only RPC with exact campaign, session, lead, guest, and event | Service RPC name and five correlation arguments plus enrollment result are exact external adapter contract. |

## tests/personal-plan-field-test-analytics.test.ts

| Line | Mark | Existing declaration | Contract / credible regression / gap |
|---:|:---:|---|---|
| 22 | F | field-test offer analytics stay in PostHog with test_kind and are rejected by Meta | F: PostHog capture mapping/test_kind is real, but Meta uses unsupported offer_section_viewed and returns false even without non-commercial guard. Keep useful mapping and held negative. |
| 39 | F | all non-commercial journey kinds are rejected by Meta | F: both non-commercial kinds use unsupported offer_section_viewed; Meta default false masks removal of journey guard. No deletion credit or new supported-event input proposed. |
| 45 | R | Customer.io keeps established field-test routing and suppresses only partner events | Customer.io admission preserves field-test routing and suppresses partner; not a remote delivery receipt. |
| 64 | R | Customer.io traits mark a field test as ineligible for commercial automation | Field-test profile traits retain test identity and exclude commercial automation while preserving marketing consent. |
| 97 | R | Customer.io traits mark partner journeys as ineligible for commercial automation | Partner profile traits retain partner identity and exclude commercial automation; distinct test_kind input. |

## tests/personal-plan-field-test-campaign-command.test.ts

| Line | Mark | Existing declaration | Contract / credible regression / gap |
|---:|:---:|---|---|
| 11 | R | campaign command defaults to a non-writing create preview | No-writing create preview remains default; command safety contract. |
| 23 | R | campaign command supports an explicit regular-quiz flow while preserving Personal Plan defaults | Regular flow parses explicitly while Personal Plan default and unknown-flow refusal remain stable. |
| 44 | R | email-bound Personal Plan campaigns require a roster and use the 90-day duration | Email-bound campaigns require roster and 90 days; regular flow and wrong duration rejected. |
| 87 | R | campaign writes require explicit apply, write gate, project confirmation, and matching URL | Apply, write opt-in, project confirmation and URL agreement all required before write. |
| 110 | R | inspect and revoke require an exact campaign id argument | Inspect/revoke require exact campaign ID, avoiding broad operational targets. |
| 125 | R | regular-quiz creation writes its flow kind and emits only the regular quiz link | Regular creation writes flow kind and emits regular link only; actual command output/writer boundary. |
| 157 | R | email-bound creation atomically creates a pending exact-account roster through the dedicated RPC | Email-bound creation normalizes roster file and uses atomic roster RPC with exact duration. |
| 201 | R | regular-quiz revocation refuses a campaign from the Personal Plan flow | Regular revoke rejects Personal Plan campaign and makes zero revoke calls. |

## tests/personal-plan-field-test-entry-route.test.ts

| Line | Mark | Existing declaration | Contract / credible regression / gap |
|---:|:---:|---|---|
| 12 | R | valid bearer token is exchanged for signed HttpOnly cookies and a clean quiz URL | Valid bearer becomes signed HttpOnly cookies and clean URL with private/no-referrer robots headers. |
| 47 | R | unavailable token fails before issuing any campaign or funnel cookie | Unavailable token produces no campaign/funnel cookie; bad entry cannot mint credentials. |
| 62 | R | email-bound token only routes to account authentication without issuing guest credentials | Email-bound token redirects to account authentication without guest cookies; distinct identity mode. |
| 89 | R | activation reaches its signed route checks before any auth or subscription gate | Activation public route reaches signed route checks before subscription/auth middleware gate. |
| 103 | R | organic moderator activation reaches its account checks before the subscription gate | Exact organic moderator activation route passes middleware; nested paths are not public by prefix. |
| 140 | R | authenticated active moderator invite return opens the saved plan instead of a fresh quiz prompt | Active authenticated member invite returns saved plan instead of starting fresh quiz. |
| 175 | R | authenticated ready moderator invite still renders the fresh quiz start UI | Ready authenticated member renders fresh-start UI; distinct state from active return. |
| 208 | R | authenticated ended moderator invite returns the existing ended state | Ended authenticated invite uses existing ended route; does not reopen admission. |

## tests/personal-plan-field-test-routing-migration.test.ts

| Line | Mark | Existing declaration | Contract / credible regression / gap |
|---:|:---:|---|---|
| 10 | R | routing RPC exposes both exact field-test enrollment kinds without weakening paid provenance | Public routing SQL exposes exact enrollment kinds alongside paid provenance structure; retained migration architecture, not runtime auth proof. |
| 29 | R | routing RPC remains owner-scoped and exposes only its authenticated wrapper | Owner scope and authenticated wrapper privileges are SQL boundary contracts absent from superuser fixture execution. |

## tests/personal-plan-field-test-schema.test.ts

| Line | Mark | Existing declaration | Contract / credible regression / gap |
|---:|:---:|---|---|
| 16 | R | field-test schema is service-only and stores campaign credentials only as hashes | Table privileges and hash-only credentials protect migration storage/security architecture. |
| 46 | R | field-test enrollments bind the exact campaign, funnel, lead, guest, grant, and artifact | Enrollment foreign-key/correlation schema binds campaign, funnel, lead, guest, grant and artifact. |
| 90 | R | activation is a locked, private, service-role-only transaction with exact field-test correlations | Locked private activation with service-only wrapper and exact correlations is an independent SQL admission contract. |
| 165 | R | campaign revocation atomically ends enrollments and their tester grants | Revocation SQL ends enrollment and tester grant atomically; retains original migration definition guard. |

## tests/personal-plan-field-test-server.test.ts

| Line | Mark | Existing declaration | Contract / credible regression / gap |
|---:|:---:|---|---|
| 34 | R | campaign token lookup stores and compares only the SHA-256 hash | Token lookup compares SHA-256 only; expected hash uses helper and is not independent cryptographic verification. |
| 56 | R | an authenticated field guest may retry only the exact campaign, session, lead, and user | Authenticated guest retry requires same campaign, session, lead and user; wrong lead cannot reuse. |
| 82 | R | campaign cookie is revalidated against current database lifecycle and capacity | Signed cookie is rechecked against current lifecycle/capacity; stale cookie alone is insufficient. |
| 109 | R | offer authorization requires the exact signed campaign, session, and lead | Offer authorization requires exact signed campaign/session/lead; absent or mismatched lead denied. |
| 157 | R | persisted field-test offer intent survives campaign authorization loss | Persisted offer intent survives lost authorization but wrong session does not gain intent. |
| 182 | R | missing pre-migration field-test columns do not break ordinary paid results | Known pre-migration missing-column error falls back to ordinary paid flow only. |
| 200 | R | unexpected persisted-intent lookup failures remain non-commercial | Unexpected DB failure preserves non-commercial intent rather than silently selling. |
| 214 | R | lead binding uses only server-resolved campaign and funnel context | Lead binding RPC uses three exact server-resolved arguments, not client supplied context. |
| 259 | R | unknown campaign identity modes never fall back to guest | Unknown identity mode is unavailable, never guest fallback. |
| 267 | R | spent email-bound token can still reach account resolution without granting a new seat | Spent/expired-capacity email-bound token can reach roster account resolution without new seat. |
| 282 | R | guest offer authorization cannot consume an email-bound campaign | Guest authorization cannot consume email-bound campaign; independent identity-mode boundary. |
| 314 | R | organic moderator offer authorization requires the exact email-bound organic campaign, session, and lead | Organic moderator context requires email-bound organic campaign, exact session/lead and flag; negatives vary those fields. |

## tests/personal-plan-field-test-ui.test.tsx

| Line | Mark | Existing declaration | Contract / credible regression / gap |
|---:|:---:|---|---|
| 20 | R | field-test quiz presents the approved persistent German banner | Actual banner SSR protects German copy and surface data attribute. |
| 27 | R | field-test offer replaces all payment presentation with the free activation card | Actual field-test offer SSR replaces payment/refund copy with zero-cost activation and field-test marker. |
| 76 | R | lost field-test authorization renders a dedicated non-commercial end state | Keeper: actual ResultPageClient unavailable branch renders default PersonalPlanFieldTestEnded. Existing heading/team/no-commercial checks absorb C1 complete two-assertion union. |
| 95 | C | dedicated field-test end surface stays concise and payment-free | C1: same default ended component is already rendered by prior ResultPageClient keeper. Transfer complete paragraph regex and payment-free negative before deleting donor; no owner call or fixture added. |
| 101 | F | field-test lead binding must succeed before the quiz can open a result | F: private fieldTestAttached/onSaved source offsets and return grep do not execute blocked client navigation. Prior held F preserved. |
| 112 | F | result routing preserves persisted field-test intent after authorization loss | F: result-page local identifiers and tracking expression are fragile; leaf SSR does not execute server intent mapping. Prior held F preserved. |
| 121 | R | moderator offer promises account return and ninety days without guest-browser limits | Email-bound moderator SSR promises 90 days/account return and excludes guest-browser/payment/refund language; distinct props. |

## tests/personal-plan-moderator-activation-route.test.ts

| Line | Mark | Existing declaration | Contract / credible regression / gap |
|---:|:---:|---|---|
| 86 | R | moderator activation requires an authenticated verified intent before allowing email-bound offer activation | Verified ready intent reaches exact six activation arguments and event; route-to-adapter identity contract. |
| 120 | R | moderator activation never creates a guest and fails closed for wrong or missing accounts | Forbidden/wrong account gets 403 with zero activation; no guest creation path. |
| 136 | R | moderator activation replay for an active member does not depend on campaign admission capacity | Active replay bypasses admission capacity and still invokes exact activation once; state-prefix independence. |
| 177 | R | moderator activation rejects cross-origin posts before touching auth or activation | Cross-origin request is refused before authentication or activation counters; origin guard is reachable independently. |
| 198 | R | moderator activation returns controlled unavailable JSON when auth lookup fails | Auth lookup throw returns controlled 503 JSON; service outage is not anonymous access. |
| 215 | R | moderator activation distinguishes an absent session from an Auth outage | Absent session is 401, distinct from Auth outage. |
| 223 | R | organic moderator activation uses the owned legacy result and never the Meta package | Organic activation accepts owned legacy result and rejects wrong package; Personal Plan artifact path is distinct. |

## tests/personal-plan-moderator-contract.test.ts

| Line | Mark | Existing declaration | Contract / credible regression / gap |
|---:|:---:|---|---|
| 108 | R | moderator member resolver returns ready only for the exact confirmed roster email | Confirmed exact normalized roster email is necessary for ready state; actual resolver fake-query boundary. |
| 153 | R | moderator access resolves active, expired, and none without guest app metadata | Active/expired/none enrollment states resolve without guest app metadata. |
| 200 | R | moderator access treats pre-migration missing roster as none and mismatched enrollment as ended | Missing pre-migration roster is none; mismatched campaign/enrollment is ended rather than active. |
| 250 | F | moderator intent is signed to one user, funnel, and optional lead | F: wrong-user intent case uses invalid UUID wrong-user plus empty roster, so downstream invalid-member guard masks missing signed-user comparison. Positive signed funnel/lead assertions remain. |
| 303 | R | an expired invitation for a ready member is ended rather than the wrong account | Expired ready invitation is ended rather than wrong account; distinct temporal state. |
| 318 | R | moderator intent accepts the organic quiz for the same roster account but rejects other packages | Organic package is accepted for same roster account while other package rejected; package-binding boundary. |
| 344 | R | organic RPC adapters send confirmed ownership and accept artifact-free activation | Organic save/activate RPC adapters normalize confirmed ownership and accept null artifact; exact external argument and error contract. |

## tests/personal-plan-moderator-journey.test.ts

| Line | Mark | Existing declaration | Contract / credible regression / gap |
|---:|:---:|---|---|
| 51 | R | moderator journey authorizes only verified account and passes exact result ownership to intent verification | Verified account credentials and exact result ownership reach intent verifier; active journey composition. |
| 75 | R | missing credentials or account proof cannot downgrade a persisted moderator funnel to commercial | Seven missing credentials/account proofs cannot downgrade persisted moderator funnel into commercial flow. |
| 118 | R | moderator journey treats database and authentication failures as unavailable | DB/auth failures remain unavailable; throws do not become ordinary access. |
| 142 | R | ordinary visitors and legacy guest funnels do not require account proof | Ordinary and legacy guest visitors skip account proof; no unnecessary authentication dependency. |
| 162 | R | result ownership lookup does not treat database failure or disabled analytics as no moderator context | Analytics disabled/read failure does not erase persisted moderator ownership; fail-closed result classification. |
| 202 | R | result account classification survives missing funnel context and fails closed on read errors | Missing funnel still permits lead account classification; missing-column compatibility differs from other read error. |

## tests/personal-plan-moderator-schema.test.ts

| Line | Mark | Existing declaration | Contract / credible regression / gap |
|---:|:---:|---|---|
| 15 | R | moderator migration adds email-bound roster state without changing guest defaults | Email-bound roster schema preserves guest defaults; independent migration compatibility/security boundary. |
| 41 | R | moderator migration exposes service-only atomic roster and activation RPCs | Service-only atomic roster/activation public RPCs and private functions protect database privilege architecture. |
| 92 | R | moderator migration fences existing guest RPCs away from email-bound campaigns | Existing guest RPCs fence email-bound campaigns; schema text complements synthetic superuser runtime tests. |

## tests/personal-plan-moderator-sql-execution.test.ts

| Line | Mark | Existing declaration | Contract / credible regression / gap |
|---:|:---:|---|---|
| 32 | R | moderator campaign creation is atomic and rolls back duplicate roster inserts | Actual migration SQL rolls back duplicate roster creation atomically, then normalizes valid pending 90-day roster. |
| 124 | R | moderator save and activation are replay-safe with stable expiry | Actual save writes lead/artifact/outbox and activation replay retains IDs/expiry/grant count one; synthetic predecessor schema scope. |
| 215 | R | organic moderator save owns a legacy lead before any Customer.io outbox can dispatch | Organic save owns legacy lead before outbox and allows editable pre-activation replay; wrong email rejected. |
| 305 | R | organic moderator activation writes a legacy enrollment and routing source without an artifact | Organic activation writes artifact-null legacy enrollment/routing, exact 90-day expiry and stable replay IDs/timestamps; late lead unchanged. |
| 392 | R | personal-plan test enrollment source shape rejects mixed artifact contracts | Three mixed source/artifact shapes reject through actual database constraints, not copied validation. |
| 439 | R | guest RPCs reject moderator campaigns while guest wrapper remains non-recursive | Actual guest RPC rejects email-bound campaign while valid guest wrapper works without recursion; exact identity/event fields. |
| 891 | R | repreparing a moderator quiz must not leave the previous result without account context | Reprepare preserves previous lead campaign marker so old result remains non-commercial account context. |
| 922 | R | campaign revocation includes moderator membership and rolls back all rows on failure | Revocation-trigger failure rolls back memberships/enrollments/grants; successful chain shares timestamps and repeated revoke returns false. |

## tests/personal-plan-moderator-start-route.test.ts

| Line | Mark | Existing declaration | Contract / credible regression / gap |
|---:|:---:|---|---|
| 33 | R | authenticated exact roster member gets a signed moderator intent and organic quiz destination | Ready exact roster account creates signed intent and fresh organic quiz destination with exact identity. |
| 87 | R | a valid ready organic intent reuses its session without creating or clearing a new start | Valid ready intent reuses session with freshStart=false and zero creation; preserves draft recovery. |
| 138 | R | moderator start persists a schema-complete canonical organic funnel row | Actual createFunnel writes schema-complete canonical organic row, protecting persistence contract absent fake route callback. |
| 177 | F | wrong accounts and cross-origin requests never create a funnel or intent | F: cross-origin and wrong-account cases both resolveMember=forbidden; removing origin guard still yields 403/zero creation. Keep account refusal; origin needs isolated control. |
| 195 | R | missing signing configuration fails before creating a funnel row | Missing signing secret returns 503 before funnel creation; avoids unusable persisted session. |
| 215 | R | rollout-off stops new ready members before a funnel row is created | Rollout disabled refuses ready members before creation; new admission gate. |
| 232 | R | rollout-off preserves return routing for an already active moderator | Rollout disabled preserves active return routing; existing access is distinct from new admission. |

## tests/regular-quiz-field-test-activation-route.test.ts

| Line | Mark | Existing declaration | Contract / credible regression / gap |
|---:|:---:|---|---|
| 42 | R | regular activation fails closed while the global field-test switch is disabled | Flag disabled returns 404 before authorization, protecting global rollout boundary. |
| 58 | R | regular activation establishes a recoverable guest before atomic ownership and projection | Recoverable guest creation/sign-in precedes atomic ownership and exact profile projection. |
| 101 | R | regular activation rejects an existing customer before guest or access writes | Existing customer 409 prevents guest/access writes; browser identity protection. |
| 128 | R | regular activation preserves the guest session when profile projection fails | Projection 503 preserves established guest cookie/session for recovery; differs from activation-service failure. |

## tests/regular-quiz-field-test-activation.test.ts

| Line | Mark | Existing declaration | Contract / credible regression / gap |
|---:|:---:|---|---|
| 9 | R | regular quiz guest creation is synthetic and flow-scoped | Synthetic guest metadata is regular_quiz flow-scoped; sibling Personal Plan adapter is different owner. |
| 29 | R | regular quiz activation uses only its service RPC and exact correlation | Regular service RPC/correlation plus enrollment, expiry and reused return contract are exact. |

## tests/regular-quiz-field-test-runtime.test.ts

| Line | Mark | Existing declaration | Contract / credible regression / gap |
|---:|:---:|---|---|
| 44 | R | regular quiz field-test runtime is explicitly flag-gated and flow-scoped | Only literal accepted flag values enable regular flow; Personal Plan flow remains separate. |
| 80 | R | regular offer authorization needs the exact campaign, organic session, and legacy lead | Offer context/intent require exact organic session and legacy lead; no cross-flow reuse. |
| 112 | R | regular entry refuses authenticated browsers and only starts eligible regular campaigns | Authenticated entry returns 409; fresh eligible entry mints signed regular cookie/quiz URL. |
| 151 | R | regular ended route is public and expired regular guests stay out of the Personal Plan ended surface | Ended route is public and flow-specific; leave clears/releases only on actual success, handles missing Auth session distinctly from outage. |
| 210 | R | regular quiz rewrite never overrides authenticated routing and forces organic repackaging | Rewrite respects authenticated redirects/status while forcing organic package for regular campaign. |
| 254 | R | only a signed regular campaign cookie enters the server-validated quiz shell | Only valid unexpired signed regular cookie rewrites into validated shell; missing/flag-off differ. |
| 316 | R | an invalid regular cookie is cleared only when signature validation is configured | Invalid cookie clears only when signing configured; missing secret cannot falsely classify signature. |
| 338 | R | lead binding runs only for exact regular field-test intent and organic context | Lead binding requires exact flag, intent and organic package; wrong variants do not call RPC. |

## tests/regular-quiz-field-test-schema.test.ts

| Line | Mark | Existing declaration | Contract / credible regression / gap |
|---:|:---:|---|---|
| 14 | R | regular quiz campaigns are flow-scoped without changing Personal Plan defaults | Flow constraints preserve Personal Plan defaults in actual migration; cross-flow storage contract. |
| 22 | R | regular quiz enrollments are service-only and do not require a Personal Plan artifact | Regular enrollment is service-only and artifact-free; differs from Personal Plan schema. |
| 59 | R | regular quiz RPCs are service-only and enforce exact legacy/default-organic correlations | Regular RPC privileges and legacy/default-organic correlations are independent migration API guards. |
| 107 | R | campaign revocation branches by flow and revokes regular grants and enrollments | Revocation branches by flow and revokes regular enrollments/grants; historical migration definition remains contract. |

## tests/regular-quiz-field-test-ui.test.tsx

| Line | Mark | Existing declaration | Contract / credible regression / gap |
|---:|:---:|---|---|
| 34 | R | regular quiz field-test banner uses the reviewed persistent German copy | Actual regular banner SSR protects copy and regular surface marker, separate component owner. |
| 41 | F | regular quiz field-test activation card is payment-free and targets the activation API | F: actual SSR proves default guest copy and non-commercial markup, but never invokes click handler or observes activation API promised by title. Keep default-prop input; stronger offer explicitly supplies guest mode. |
| 57 | R | regular quiz field-test activation consumes the exact server destination contract | Destination parser accepts only exact server destination contract and rejects redirectTo/onboarding/pricing. |
| 71 | R | regular quiz field-test organic offer replaces all commercial conversion surfaces | Organic guest offer replaces all commercial surfaces with regular activation, using explicit guest props and pricing sentinel. |
| 99 | F | email-bound moderator organic offer remains free and uses its dedicated activation route | F: email-bound SSR proves 90-day/account copy and non-commercial output, but dedicated activationApiPath is inside uninvoked callback and unobserved. Keep distinct email-bound input unchanged. |
| 128 | R | partner organic offer keeps the ordinary journey and swaps only the payment position | Partner organic offer preserves ordinary hero/three CTA journey and swaps payment position; already-live separate access owner. |
| 154 | R | partner activation accepts only the canonical plan-ready destination | Partner destination parser accepts only canonical plan-ready result; malformed routes rejected. |
| 162 | R | partner activation shares one request and event across concurrent CTA clicks | Two concurrent CTA invocations share one request and one event with same destination; actual click-owner concurrency contract. |
| 196 | R | legacy result client fails closed when regular field-test intent lost authorization | Legacy result unavailable branch renders non-commercial end state; quizKind differs from C1 Personal Plan input. |
| 213 | F | result and quiz routing consume only server-derived regular field-test state | F: private source wiring identifiers/broad absence regex do not execute server-derived state propagation. Keep until actual composition observation exists. |

