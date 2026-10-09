# Independent preflight — Product Intake 5-C proposal

**Scope:** only the five staged C candidates in `/tmp/test-audit-pi-submission96-candidates.json`, their two current Product Intake owners, and the unaffected F controls called out in the 96-site ledger. Read-only review; no repository changes or execution.

## Integrity and read limits

The manifest's before bytes still match current files:

- `tests/product-intake-submissions.test.ts` — `9cefef1acf53d245150182a014329ad615070822fd4e6c295626d3f0bc071095`
- `tests/product-intake-matching.test.ts` — `370e564518dfc81901d6b34659bffb47a3343a463d5d8df4da5c599591e4ca03`
- `tests/product-intake-lookup.test.ts` — `61603d8b306a21b5e56c978134e9a73e0773554d6a9295c7adb49339809527af`
- `src/lib/product-intake/submissions.ts` — `3098f48d86d40549f982a2a96c465e34f4278c59b593da4ef182f81d0df6fcf3`
- `src/lib/product-intake/route-handlers.ts` — `0310e374ef568684dd6589b1bc86ab567f5c18967f9b89b223d73a10cc556f8c`
- `src/lib/product-intake/schemas.ts` — `4677e315cf32dbcdc4af1b7b0e55ea601979d1cfb7e9cf6a80177fbc1fe43eba`

I read all five donor and keeper callbacks from the candidates artifact, the relevant schema, direct submit/scan submission branches, upload ownership predicate, route error mapper, and the candidate fixture descriptions. This is a candidate preflight, not a fresh 96-declaration audit or test proof.

## Verdicts

| candidate | verdict | exact preserved union and owner evidence |
|---|---|---|
| C1, donor `submissions.test.ts:1845` to keeper `:543` | **conditional support** | These are byte-equivalent `submitProductIntake` calls: onboarding/manual input, same fake, timestamp, source, and expected matched product. The keeper already has donor `status`, product, usage and `replace_usage_matched` call observations; adding `result.source === "onboarding"` completes the donor union. |
| C2, donor `:823` to keeper `:2047` | **conditional support** | Both send `tmp/someone-else/front.jpg` for the same authenticated user/photo category. `assertTemporaryUploadPathBelongsToUser` rejects it before repository work (`upload-paths.ts:3-22`); the route invokes the actual parsed submit owner (`route-handlers.ts:88-111`) and maps the same `ProductIntakeUserInputError` to 400/code (`:149-153`). The keeper already includes the donor German message. No assertion transfer is needed. |
| C3, donor `:868` to keeper `:2081` | **conditional support** | The names `guessed.jpg` and `missing.jpg` are not an owner predicate: both have the required `tmp/<user>/` prefix and are absent from the same empty uploaded-path fixture. `verifySubmissionImages` runs before persistence, so the staged keeper trace of the actual `verify_image:.../missing.jpg`, zero submissions, and null usage preserves every donor observation while the route additionally proves 410/`product_intake_upload_expired` (`errors.ts:28-35`; route mapping above). |
| C4, donor `:666` to keeper `:779` | **conditional support** | Both exercise photo input with the same user, category/frequency, two temporary paths and timestamp. The stricter keeper supplies forged client validation fields, while production persist derives `uncertain` and `{}` server-side; the schema defaults support the donor form (`schemas.ts:63-78`). The staged keeper retains every donor projection: pending/photo result, submission method, both committed paths, both uncertain statuses, usage path and pending-review match, plus its existing forged-value assertions. The optional barcode validation field's history presence differs, but the donor makes no history assertion; it is not a lost observation. |
| C5, donor `:531` to keeper `:1794` | **conditional support** | The keeper already owns raw `"  AB-12  "`; staging simply names its existing parsed input and asserts the schema result `"AB-12"` before the unchanged submit call. Both strings traverse `trimmedString` (`schemas.ts:6-9`, `:190-195`) and no additional schema branch. `submitScanProductIntake` then performs its single normalization at `submissions.ts:1024-1033`, which the existing keeper already verifies through the persisted `ab-12` result. The no-match eligibility stub is an active guard: any accidental matched path calls it and fails, so fallback matching cannot hide the pending-persistence assertion. |

## Retained controls and limits

- No proposed C relies on the two silent `findUserProductUsage` fakes identified in the ledger (`submissions.test.ts:1458`, `:1539`): those zero-read claims remain **F**, because the fake does not record the read. The overlapping lookup fallback finding also remains F/retained. None of their callbacks is in the transfer or cut diff.
- The existing C3 fake call trace is observable, so the proposed zero-row/zero-usage assertions are not a synthetic no-usage claim.
- C2's HTTP mapping is stronger than the direct exception observation; C3 specifically preserves both the original dependency trace and the storage non-effects at that stronger boundary.
- I found no route-auth, error-basename, forged-value, schema-passthrough, or fallback-matching gap that blocks these five transfers. I did not execute the staged diff, a mutation control, or coverage; application still needs the manifest/hash guard and focused owner/route controls supplied by the author.

**Preflight conclusion:** conditionally safe to apply the staged 5-C union (`96 -> 91` AST declarations), provided the staged manifest preserves the listed current hashes and the F callbacks remain unchanged. No source cleanup is implied.
