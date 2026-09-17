# Customer.io read-only reconciliation — 2026-09-10

Scope: EU workspace `219516`, account `153236`. Authentication restored in the separate task. All reads used `/Users/nick/.local/bin/cio --read-only`; no messages, campaign edits, contact edits or configuration writes. This is configuration evidence, not proof of individual delivery or current Supabase hook settings.

## Verified current configuration

| Item | Current observation | iOS implication |
|---|---|---|
| Sender identity 1 | Chaarlie, `info@chaarlie.de`, verified | Existing verified sender available; no new mailbox required by this integration. |
| Transactional 2 / template 30 | Active `magic_link`, subject `Chaarlie – Dein Login-Link`; only variable `trigger.confirmation_url`; link tracking false | Current template does not display the code. The local hook already passes `token`; native login needs source-aware code+link presentation and routing, preserving web consumers and verifying the deployed payload. |
| Transactional 7 / template 40 | Active `quiz_result_artifact`; subject promises Haaranalyse; includes `trigger.result_url`; link tracking true | Must bypass/replace this dispatch for the approved app-acquisition source, without modifying other quiz funnels' result emails. |
| Transactional 8 / template 41 | Draft copy of quiz artifact | Do not assume this draft is the active message. |
| Transactionals 4, 5, 6 | Active email confirmation and current/new email-change messages | Existing templates exist; actual Supabase hook payload and confirmation behavior still need end-to-end verification. |
| Campaign 5 | `Chaarlie Welcome Flow v3`, stopped | Not the active quiz sequence. |
| Campaign 9 | `Chaarlie Haarplan-Strecke v4 (Launch Tom)`, running, version 20 | Trigger: segment 15 OR 21, excluding segment 33. Includes ten-minute Haarplan reminder and subsequent plan emails. |
| Campaign 10 | `Chaarlie Haarplan-Strecke v5 (Personalisiert, 20 % Test)`, running, version 28 | Trigger: segment 15 OR 21, including segment 33. Includes result recap, scanner content and later plan/discount messages. |

Both running sequences have `send_to_unsubscribed=false`, no campaign attribute filters in the inspected configuration, no automatic exit when trigger/filter ceases to match, and a global exit for segment 16 (purchasers / `has_ever_paid`). This does **not** establish that the custom `marketing_consent` attribute is mapped to Customer.io subscription state. No contact records or delivery history were inspected to infer that behavior.

## Why renaming the quiz event is insufficient

- Segment 15, `Quiz Completed`, observes the first `quiz_completed_at` attribute transition from absent to present.
- Segment 21 observes entry into `quiz_kind=personal_plan` plus its existing test-account conditions.
- Segment 33 supplies the existing roughly 20% lead-ID test-group split; its exact existing conditions are not an iOS design choice.
- Current `src/lib/customerio/quiz-traits.ts:100-107` identifies `funnel_package_key`, `marketing_consent` and `quiz_completed_at`. `:140-149` also emits `quiz_profile_submitted`. Changing only the event leaves the attribute-driven trigger in place.

## Required integration treatment before launch

1. Freeze source classification for native and organic app acquisition on the server; inspect both identify traits and event dispatch.
2. **Confirmed by Nick:** new scanner sign-ups enter the existing shared marketing flow under the same consent and eligibility rules as other quiz sign-ups. Preserve campaigns 9/10 and their current split; no scanner-specific exclusion, separate marketing sequence or marketing-copy redesign in this build. Nick will revisit shared email content and retargeting once free-scanner usage develops. This supersedes the earlier proposed scanner exclusion. Functional login/download and requested result notifications remain separate transactional messages.
3. Preserve existing legacy/paid/partner funnels and current campaign participants. App login, profile edits and retries must not restart a marketing sequence, change its current assignment, override an unsubscribe or terminate it. Shared enrollment applies to eligible new quiz sign-ups, not to every sign-in as a fresh lead.
4. Enforce optional marketing consent for shared marketing enrollment; verify actual subscription mapping rather than assuming the custom boolean controls delivery. Auth and requested research-result delivery must remain independent of marketing opt-in.
5. The local hook `supabase/functions/send-email/message-builder.ts:60-87,151-165` already supplies `token` and the confirmation URL with retention disabled. Configure and test native auth code+link presentation/routing without tracked authentication links; keep existing web callbacks intact. Provider email configuration alone does not prove the Supabase hook transport.
6. Quiz synchronization currently keys Customer.io identify calls by normalized email (`quiz-traits.ts:134`, `quiz-sync.ts:41-47`). Verified account email changes must reconcile the existing provider identity and consent/subscription state; they must not silently create a fresh marketing identity or leave the old address receiving account notifications. Deletion must cover the account-owned legacy provider identifiers as well as its current address, without merging unrelated people.
7. Re-read these configuration versions before production activation. Reconcile concurrent marketing edits; do not overwrite them from this snapshot.

## Reproducible read paths

`cio --read-only transactional list --environment-id 219516` (filter output to message/template metadata); `cio --read-only domains --env-id 219516 from_addresses list`; `cio --read-only api /v1/environments/219516/campaigns`; campaign GET for 9 and 10; segment GET for 15, 16, 21 and 33. Raw customer records and credentials are intentionally absent from this planning evidence.
