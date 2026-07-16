# Result tracking reliability — ready check

Date: 2026-07-16

## Scope and base

- Branch: `codex/result-tracking-reliability`
- Worktree: `/Users/nick/AI_work/hair_conscierge/.worktrees/result-tracking-reliability`
- Base and merge-base: `origin/main` at `d869f81f3689bcb6471c99137ce819f79dfbb2ee`
- Reviewed content fingerprint, excluding this receipt: `7119a07daed24518a9c52cb1281f0fe8ceeac41b23eefc1fd446b1dc7554659c`
- Publication state: uncommitted and unpushed by design

## Promises checked

- Customer.io unwraps the installed browser SDK's `[client, context]` load result before flushing queued calls.
- Customer.io records the canonical result route while removing credential-bearing and unrelated query values from both page properties and `context.page`, including queued page, identify, and track calls.
- PostHog sanitizes current, initial, referrer, and session-entry URL properties through the supported `before_send` hook, including nested `$set` and `$set_once` values.
- PostHog's unused `/flags` and remote-config request is disabled with `advanced_disable_flags: true`, closing the request path that bypasses event sanitization.
- Meta suppresses PageView only for credential-bearing queries/fragments, keeps normal campaign and anchor PageViews, and emits the checkout-return PageView only after `/welcome` has replaced the sensitive URL.
- The canonical offer records the full approved hierarchy: 12 ordered sections, the deduplicated FAQ open, and CTA source/interaction context.

## Automated verification

- Focused analytics and result-offer suite: 38/38 passed.
- `npm run ci:verify`: passed.
  - TypeScript: passed.
  - ESLint: 0 errors; 4 unrelated pre-existing warnings.
  - Next.js production build: passed; 81 routes generated.
- `git diff --check`: passed.

## Runtime verification

- Mobile browser walkthrough on the canonical result route emitted `offer_viewed` with `entryContext=quiz_completion`, `offerRevision=product_led_v2`, and `offerVariant=app-value-stack`.
- All 12 sections emitted once with stable indices 0–11: hero, analysis, routine preview, locked routine, unlock explanation, three product-story sections, testimonials, pricing, FAQ, and final CTA.
- Reopening the same FAQ emitted one open event; the final CTA emitted `sourceSection=final_cta` and `interactionIndex=1`.
- Meta emitted PageView for a normal campaign URL and did not emit PageView for a credential-bearing auth URL; harmless `#pricing` is covered as safe.
- With the installed PostHog browser SDK and a dummy local host, a credential-bearing auth load produced no `/flags` request after `advanced_disable_flags` was enabled. No real vendor events were sent during local QA.

## Independent review

- Local correctness/privacy/structure review: no blocking findings after the final corrections.
- Claude targeted delta review: no blocking findings after adding session-entry URL sanitization, moving to `before_send`, and disabling `/flags` with the correct SDK option.

## Residual production check

- Actual Customer.io, PostHog, and Meta receipt in their production dashboards can only be confirmed after deployment. After shipping, run one incognito quiz completion and verify the canonical result PageView, 12 section events, FAQ, CTA, and absence of credentials in vendor payloads.

## Bottom line

Ready for explicit publication authorization. Not yet committed, pushed, merged, or deployed.
