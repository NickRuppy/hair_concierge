# Tracker pattern reassessment — 93 complete native declarations

Classification: {'R': 84, 'F': 5, 'C': 2, 'D': 2}. Four proposed removals, 93 → 93 assertion-transfer → 89. No repository changes or test/owner execution. Full bodies and SHA-256 in companion JSON.

## tests/tracker-agent-context.test.ts

File SHA-256: `a2ab0169be1ffaf2299f7bd0cea607bf1a8c0ddd72f47b1193b8765b82c4da8d`

| Line | Verdict | Exact declaration | Independent fault / decision |
|---:|:---:|---|---|
| 25 | R | returns null with no logged days | Empty recent diary must produce null; manufacturing an observation context for no evidence fails. |
| 29 | R | emits the raw diary: every logged day with its products | Actual projector must emit mode/count/last-wash offset and exact first-day product projection without usage IDs. Dropping a date or exposing the raw product shape fails. |
| 48 | R | keeps custom entries as user-authored, non-standardized diary context | Custom Sauna label must remain user-authored context and carry the nonstandard-activity note; treating it as a canonical activity loses the asserted note. |
| 60 | R | raw diary context includes only the latest 14 days from the shared evidence window | June20 is outside the 14-day raw window but remains valid last-wash evidence (17 days); clipping the input before computing last wash fails. |
| 76 | R | serializes a bounded diary while retaining each day and category | 560 named products must fit the bounded serializer while preserving all dates, category sets and custom label; truncating whole days or assigning names oldest-first fails. Budget is producer constant, but date/name ordering and sentinels independently constrain real serialization. |
| 151 | R | structured insights stay locked when recent diary coverage is sparse | Four covered days do not unlock insights; bypassing the elapsed/log-count/observed-week gate exposes a mask insight. |
| 162 | R | structured insights compare sufficiently covered observations with CareBalance | Ten logs/two observed weeks yield literal mask 0.5 vs target2 and explanation-only authority. Incorrect day cadence, direction mapping, or authorizing profile/routine/ranking writes fails. |
| 189 | R | structured insights honor an active tracker dismissal | An active mask:increase dismissal suppresses the otherwise eligible insight; failure to pass active dismissals into computeNudges fails. |

## tests/tracker-agent-loader.test.ts

File SHA-256: `7f12c9e19a52957b01488297e8ceddef00b8fd2f7289cc181ad6d4ff426cc97c`

| Line | Verdict | Exact declaration | Independent fault / decision |
|---:|:---:|---|---|
| 30 | R | loader distinguishes an empty diary from a failed load | Independent injected read outcomes distinguish empty/no_entries from unavailable/query_failed; conflating empty data and read failure fails. |
| 54 | R | loader returns recent diary facts and only active dismissals | Actual row mapper returns Shampoo A; actual reappear_at filter retains July20 mask and drops July1 oil. Fake does not prove SQL query scoping, but these projection/expiry assertions are owner-produced. |
| 93 | R | loader includes a local-next-day entry while UTC is still on the prior day | At July6 22:30Z, latest Europe/Berlin row July7 must be available and choose referenceDate July7. UTC-only reference filtering loses the row; fake no-op query means this does not prove widened DB query bounds. |

## tests/tracker-aggregation.test.ts

File SHA-256: `546043fc6150db59f8501f8ab7d174e7f19de86814987a73e1f9038d6a2e72ea`

| Line | Verdict | Exact declaration | Independent fault / decision |
|---:|:---:|---|---|
| 102 | D | observed wash cadence: 4 washes over 2 observed weeks -> 2/week | Exact same DENSE_WEEKS object. computeObservedCadences calls estimateObservedWashCadencePerWeek unconditionally, then publishes its scalar as shampoo.weeklyCadence. Existing keeper asserts presence, wash_rhythm and literal 2 despite self-report 5. Direct donor adds no intermediate that the consumer hides. |
| 106 | D | observed wash cadence: null with fewer than 2 observed weeks | Donor one wash June10 and keeper two washes June10/14 are the same operative early-return state: zero observed weeks because each ISO week has fewer than four logged days. Both reach weeks.size < 2 before any wash arithmetic. Keeper additionally has self-report 2 and must emit no shampoo, so a zero/undefined/NaN observed result or a fallback-as-shampoo error is exposed. One vs two raw rows adds no other observed branch. |
| 110 | R | shampoo cadence is the measured wash rhythm, not the self-report | Actual facade publishes observed2 despite self-report5; replacing observed cadence with the questionnaire estimate fails. |
| 118 | R | shampoo emits no cadence when wash rhythm is unobserved (sparse logging) | Sparse two-row week must not create shampoo output even with self-report2; fallback must only support match-shampoo categories. |
| 127 | C | need-based policy: mask uses observed-week cadence instead of wash share | Both use DENSE_WEEKS, null self-report, CADENCE_POLICIES. Keeper adds two custom mask days and one unconfirmed shampoo/mask wash. isCadenceEligible and isWashLike exclude all three before observed-week, usage-day, wash-event and anchor computation. For mask the exact operative input remains two usage days across two observed weeks. Keeper additionally guards exclusion of those non-canonical records. |
| 136 | R | match-shampoo policy falls back to self-reported anchor for sparse loggers | Four sparse wash events/two conditioner uses and self-report2 produce anchor self_reported and cadence1. Dropping questionnaire fallback fails. |
| 150 | R | match-shampoo policy without any anchor emits no cadence | One conditioner event without observed or self-report anchor yields no output; inventing anchor or unconditional wash_share output fails. |
| 159 | R | match-shampoo cadence excludes product use from partially observed weeks | With two observed weeks plus a partial third week, conditioner usage2/washEvents4/cadence1 excludes partial-week use; including the partial row in either numerator/denominator fails. |
| 180 | R | duplicate category rows on one day count once | Two same-category product rows on the same date count once; iterating products rather than distinct category/day usage inflates usageDays. |
| 191 | R | day-level: dry shampoo 4 days across 2 observed weeks -> 2/week | Bridge-use dry shampoo counts four styling days over two observed weeks as day_level2; requiring wash events or defaulting all categories to wash-share fails. |
| 225 | R | heat-exposure policy uses observed-day cadence instead of wash share | Heat-exposure policy is a separate enum branch and must also produce day_level1/null anchor; excluding that policy kind fails while bridge/need-based tests stay green. |
| 257 | R | not-applicable policy suppresses cadence output | not_applicable serum must never emit cadence despite adequate logs; treating every non-null policy as applicable fails. |
| 279 | R | day-level: weeks with fewer than 4 logged days are not observed | A week with only three eligible log days does not support day-level hairspray; lowering observed-week density to three fails. |
| 295 | R | daysSinceLastWash: counts from most recent wash-like day | Latest July3 wash yields four days despite later none day, while empty input yields null; taking last log or fabricating zero on no washes fails. |
| 304 | R | custom and unconfirmed days do not affect cadence denominators or category usage | Custom mask days and unconfirmed wash must not enter week coverage, category usage or wash estimates. Including either changes usage/denominator proof. Primary C1 keeper gains basis/anchor assertions. |

## tests/tracker-api.test.ts

File SHA-256: `5824f4dd9d615f3d5d204d81de3d8d1fe32b3561faeeaee84569bee3b780ea35`

| Line | Verdict | Exact declaration | Independent fault / decision |
|---:|:---:|---|---|
| 276 | R | getTracker: 401 without user | Unauthenticated GET returns401; removing requireUser permits data access. |
| 285 | R | `getTracker: permits current ${access} access` | One AST loop covers paid/manual/legacy dependency outcomes. Each returns200 with one authenticated read and one admin acquisition; bypassing auth/admin or excluding one admitted state fails. |
| 297 | R | tracker handlers fail closed for expired or unavailable access | Expired access403 and dependency failure503 remain distinct; allowing false or swallowing unavailable as success fails. |
| 314 | R | tracker handlers deny paid pending access without subscription-required copy | Paid activation-pending returns409/code activation_pending; misrouting recoverable purchase to ordinary403 fails. |
| 323 | R | getTracker: rejects an invalid IANA timezone with 400 | Invalid GET IANA timezone returns400 German error; uncaught Intl failure or defaulting invalid zone fails. |
| 333 | R | getTracker: returns shelf image URLs from artifact usage rows with null fallbacks | Artifact usage relation image lookup handles object/array/null relationships and shelf order. Dropping URL projection or using wrong usage ID fails. |
| 364 | R | getTracker: returns 500 instead of empty diary when log read fails | Log read error becomes500 rather than an empty successful diary; ignoring read error fails. |
| 372 | R | getTracker: excludes deleted and custom rows from trust and rhythm history | Custom and deleted persisted rows cannot unlock trust or populate rhythm history. Omitting deleted filter/custom filter makes returned history nonempty. |
| 397 | R | getTracker: returns the full shampoo target and only 63 calendar days of rhythm history | Inclusive May6 boundary and exclusive May5 boundary expose exact63-day history; full shampoo target carries all four literal fields. |
| 430 | F | putLog: valid wash day upserts log and replaces products | F: fake returns p_products with snake_case fields and expected body copies that fabricated shape; actual latest SQL returns productName/userProductUsageId. Repair fake success envelope to actual protocol and assert exact emitted RPC args separately. Keep handler200/pass-through proof; no cut. |
| 462 | R | putLog: rejects future date and stale backfill | Future July8 and stale June29 exceed current July7/7-day backfill interval; removing either date bound turns the respective response successful. |
| 484 | R | putLog: rejects unknown day type | party is not a supported day type; expanding validation to arbitrary strings returns200 under permissive fake. |
| 497 | R | putLog: rejects unknown product category with 400 | toothpaste is not in real category labels; dropping application category admission reaches the permissive fake and returns200. |
| 510 | F | putLog: rejects a userProductUsageId owned by another user | F: fake owns user ownership lookup. Actual callback proves foreign_product→HTTP400, not SQL access enforcement. Preserve meaningful security scenario for owner repair; real SQL owner must be exercised locally with same existing linked-foreign fixture and explicit user context. No cut. |
| 537 | F | putLog: rejects a linked product whose category does not match | F: fake owns category linkage lookup and emits same foreign_product. HTTP mapping overlaps foreign-user test, but category SQL predicate is independently security relevant and lacks credible executable keeper; retain for repair, not quota deletion. |
| 556 | R | putLog: an RPC error is never reported as a successful save | Real rpcResult converts an injected transport error to500 and no ok. Empty fake state is not transaction rollback proof; retain meaningful HTTP assertions and remove/rename only the unsupported persistence claim if touched. |
| 572 | R | putLog: rejects an invalid IANA timezone with 400 | Invalid PUT timezone is independently handled before date/RPC; accepting malformed timezone would proceed to failing Intl or wrong response. |
| 585 | R | putLog: validates custom names and rejects products for none | Whitespace-only custom name and none+products hit two distinct Zod refinements. Removing either refinement gives success under fake; preserve both existing calls. |
| 608 | F | tracker RPC contract: stale save after delete cannot resurrect; another session remains last-write-wins | F: fake implements row state, same-session ordering, tombstones and LWW. Current test only genuinely checks handler RPC dispatch names and success pass-through. Repair at local actual SQL owner while preserving exact PUT2→DELETE3→PUT2→other-session PUT1 sequence; keep HTTP dispatch proof. Do not use stale browser live callback as keeper. |
| 646 | R | dismissNudge: upserts dismissal with 30-day cooldown | Real dismissNudge computes Aug6 30-day cooldown from July7 and issues an admin upsert. Fake persistence is not asserted, call payload is owner-produced. |
| 662 | R | tracker admin reads remain scoped to the authenticated user | Fake query actually applies emitted eq(user_id); own/foreign same-date rows expose missing server scoping in loadDays by returned duplicate dates. |
| 682 | R | getTracker: unlocked gate computes nudges from logs | Actual GET combines trust gate, aggregation and runtime mask target into an increase nudge. Passing the wrong target/log input or keeping gate locked loses the nudge. |

## tests/tracker-migration-security.test.ts

File SHA-256: `fb1ea2d8ee2bf930cb8d4aace9fe9c0e83f690092b125ae739fcdca141ea5143`

| Line | Verdict | Exact declaration | Independent fault / decision |
|---:|:---:|---|---|
| 26 | R | fresh tracker schema allows authenticated reads but no direct log mutations | Initial migration must restrict authenticated log writes while granting reads. These are historical migration bytes, not final deployed permissions; dropping initial revoke/policies changes upgrade-stage security. |
| 39 | R | tracker mutation RPCs run through a fixed-search-path definer boundary | Original migration public RPC signatures, SECURITY DEFINER and fixed search_path are SQL contract bytes. Losing definer/search-path/grants fails; this does not execute or validate latest RPC body. |
| 52 | R | forward hardening removes grants and mutation policies from existing databases | Forward hardening must revoke all log mutation grants and drop six permissive policies in already-existing DBs; fresh-schema checks cannot catch missed old-policy removal. |
| 65 | R | replace_routine_log rejects malformed, oversized, and duplicate direct-RPC payloads | Historical payload-hardening migration explicitly includes 40 cap, item types, name200, UUID format and duplicate grouping. Each protects its migration artifact; current entitlement replacement needs separate executable SQL proof and is not certified by this grep. |
| 86 | R | delete_routine_log writes an absent-row tombstone before applying revision ordering | Historical hardening inserts absent-row tombstone before revision guard and orders replace guard before resurrection. Exact SQL identifiers identify storage contract here; current replacement-body ordering remains separately unexecuted. |
| 115 | R | entitlement boundary revokes direct tracker access and replaces RPC signatures | Final boundary revokes direct table access, drops old signatures, uses explicit p_user_id and service-role-only EXECUTE. Reintroducing auth.uid or authenticated grant violates independent deployed access boundary. |

## tests/tracker-nudges.test.ts

File SHA-256: `b2d918171c06640d9e035b056ebb9f8a7e451bb7186fe135e4afb66b1cdc8c76`

| Line | Verdict | Exact declaration | Independent fault / decision |
|---:|:---:|---|---|
| 28 | R | observed clearly below band -> increase nudge with German copy | Below-band mask1 emits one increase with German category/recommendation copy. Missing direction/category label/subject construction fails. |
| 41 | R | observed inside band -> no nudge | Inside band2.5 emits none; this explicitly preserves absence of advice for in-range behavior rather than only near-boundary noise. |
| 50 | R | boundary wobble guard: less than 0.5/week outside band -> no nudge | Below-band1.6 is outside target but within0.5 margin; removing margin yields spurious advice. |
| 59 | R | exactly 0.5/week outside the band fires (spec: >= margin) | Exactly1.5/4.5 must both emit at inclusive0.5 boundary. Strict inequalities lose either endpoint; preserve both calls. |
| 78 | R | wash_rhythm nudge speaks about washing, not the shampoo product | wash_rhythm subject is washing, not shampoo usage; changing basis-specific copy loses wäschst or inserts Shampoo. |
| 108 | C | observed clearly above band -> decrease nudge | Both invoke computeNudges on cadence(mask,5) and MASK_TARGET min2/max4; direction is decrease. Keeper only adds dismissal key mask:increase, which cannot suppress mask:decrease. Production creates direction before the set lookup and returns the same result. No provider, persistence or metadata difference. |
| 118 | R | dismissed direction stays hidden; other direction still fires | Dismissed increase is hidden while mask5 decrease remains. Ignoring direction in dismissal key or skipping dismissals fails. Primary C2 keeper gains exact returned decrease direction. |
| 138 | R | no target for category -> no nudge | No target category cannot manufacture nudge from high observation; fallback target or emitting without target fails. |

## tests/tracker-presentation.test.ts

File SHA-256: `c8bde91f440457ac958cdd903377e59b949ab6a89d956b3e1a2683501ce78172`

| Line | Verdict | Exact declaration | Independent fault / decision |
|---:|:---:|---|---|
| 12 | R | activity presentation defines all six German labels and descriptions | Six exact customer-facing activity labels/descriptions are independently meaningful German product copy; no complete six-description rendered keeper was found in this bounded read. |
| 23 | R | shelf order is category, normalized product name, then stable usage id | Category order, German diacritic normalization and usage-ID tie break are exposed by a/c/b/2 literal order; skipping any comparator dimension changes it. |
| 36 | R | activity ordering surfaces likely categories without hiding the stable remaining shelf | Wash likely shampoo/conditioner and remaining mask preserve all shelf items; custom has empty likely. Hiding remaining items or preselecting custom causes failure. |
| 54 | R | presentation copy names prefill source and profile ownership without retired progress language | Public prefill/source and profile-ownership copy plus absence of retired progress language protect user attribution, not private binding names. |

## tests/tracker-rhythm.test.ts

File SHA-256: `96764b815ce54f2641fae4441c2a3a3ffab49c94cc034a24d868b910c7073ed7`

| Line | Verdict | Exact declaration | Independent fault / decision |
|---:|:---:|---|---|
| 22 | R | weekly rhythm uses the ISO week across year boundaries and shows target bands | Cross-year ISO Monday Dec29, weekly target3–4, below status and singular encouragement; calendar-year reset/Sunday start or wrong count fails. |
| 34 | R | rhythm pluralizes below-target encouragement and caps preferred-target progress | Empty week needs plural3; five washes must be above with capped progress1 and above copy. Removing clamp or plural distinction fails. |
| 53 | R | biweekly and monthly periods use the fixed Monday 1970-01-05 anchor | Biweekly and monthly epoch periods have different Dec22/Jan5 starts and2/4 lengths; anchoring to calendar month or current week fails. |
| 68 | R | only completed eligible weekly periods form a consecutive rhythm | Streak counts only completed eligible prior weeks; including ongoing week yields3, stopping one week early yields1/null. |
| 77 | R | custom and unconfirmed drafts do not affect current rhythm | Custom/unconfirmed entries cannot inflate current count1; ignoring confirmed flag yields2/in_range. |
| 91 | R | no target and less-than-monthly targets stay neutral | Null target and less-than-monthly target are separate neutral outputs; real SSR null-target headline must remain neutral. |
| 111 | R | tracker renders the in-range headline from confirmed washes | Real buildRhythmSummary+RhythmBand SSR with three confirmed washes yields in-range headline and status; presentational status mapping error fails. |
| 122 | R | tracker day strip labels activities and keeps future days disabled | Real WeekStrip SSR produces German exact day/activity aria, selected tab and future disabled. Empty onSelect is unused; this is not a callback-behavior test. |

## tests/tracker-route-wiring.test.ts

File SHA-256: `794b3597073258d317347307bc43d15ac86c3d4266e840dea06237f337955f6b`

| Line | Verdict | Exact declaration | Independent fault / decision |
|---:|:---:|---|---|
| 11 | F | every production tracker route wires the canonical one-time access resolver | F: canonical resolver dependency is meaningful purchase recovery wiring, but regexes also freeze imported identifier and private arrow/destructure spelling; a behavior-preserving local alias fails. Keep until actual route dependency delivery keeper proves resolver receives authenticated user/client; identifier renaming alone must survive repaired test. No deletion. |

## tests/tracker-save-coordinator.test.ts

File SHA-256: `01771d645f4ec3600c4a1e878d48beec62ee867442269d1462937b1ecd6c1051`

| Line | Verdict | Exact declaration | Independent fault / decision |
|---:|:---:|---|---|
| 26 | R | recognizes a same-origin followed pricing redirect | Same-origin followed pricing redirect maps to internal path; foreign origin and not-followed response stay null. Open redirect or unconditioned navigation fails. |
| 53 | R | coalesces rapid updates and never runs more than one save | Actual coordinator serializes deferred saves and coalesces middle update; assert max concurrency1, latest value and revisions1/3. Callback only records effects and delays, does not implement ordering. |
| 91 | R | retains updates for two dates and saves them serially | Two different pending date keys both survive and drain in insertion order; using one global pending slot loses first date. |
| 111 | R | an older success cannot mark a newer revision saved | Resolving old in-flight revision while newer queued must emit only saved revision2; removing isCurrent guard emits revision1 too. |
| 138 | R | retries retryable failures once before surfacing an error | Retryable error gets exactly two attempts then error; infinite/no retry or swallowed final failure fails. |
| 160 | R | does not retry a non-retryable validation failure | Nonretryable validation error gets one attempt and error state; retrying all failures fails. |
| 179 | R | manual retry reuses the failed revision and can recover | Manual retry reuses revision1 and transitions error→saved; incrementing revision or leaving failed state fails. |
| 203 | R | flush bypasses the trailing debounce and idle fires once | flush bypasses60s debounce and emits one onIdle; honoring old timer or duplicate idle callbacks fails. |
| 224 | R | dismissing an invalid custom draft restores the latest valid snapshot after an in-flight save | Supersede after dispatched wash then restoring same valid value must send revision3 after1 and finish saved. Equality-based payload suppression loses restoration. |
| 253 | R | a dispatched date can receive a higher-revision tombstone when no valid snapshot remains | Dispatched transient then delete must retain hasDispatched and dispatch revision3 tombstone. Actual coordinator output is observed; callback does not implement tombstones/SQL. |
| 279 | R | superseding during retry backoff prevents the obsolete retry | Superseding during retry backoff cancels obsolete second attempt and returns idle. Checking isCurrent only before delay fails. |

## tests/tracker-trust-gate.test.ts

File SHA-256: `55121eec6a7342c251183f83816ba15213b4faeb15084a9548a0a7fea566b043`

| Line | Verdict | Exact declaration | Independent fault / decision |
|---:|:---:|---|---|
| 12 | R | no logs: locked, no first-log date | Empty dates return locked/null first date/14 remaining; sorting empty then computing date would return invalid values. |
| 19 | R | first log today: locked with 14 days remaining (unlock lands on day 14) | First log today locks and gives zero elapsed/14 remaining; inclusive-day off-by-one fails. |
| 27 | R | 14 days elapsed but only 9 logged days: still locked | 14 elapsed with9 logged must remain locked despite time criterion; dropping count criterion fails. |
| 45 | R | 14 days elapsed and 10 logged days: unlocked | 14 elapsed with10 logged unlocks and zero remaining; strict greater-than thresholds fail. |
| 63 | R | duplicate dates count once | Duplicate dates count once; using raw array length inflates logged-day total. |
| 68 | R | custom activity names trim whitespace and reject blank values | Whitespace trim and blank null/false ensure meaningful custom names; nontrimmed string-length acceptance fails. |
| 75 | R | custom and unconfirmed days do not count toward the ten qualifying trust-gate days | Custom/unconfirmed records excluded before ten-day gate; admitting them unlocks11 instead of9. June31 string is a fixture caveat, not calendar-validity coverage. |
