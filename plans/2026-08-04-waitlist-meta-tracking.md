# Waitlist Meta tracking recovery

## Outcome

Restore the paid waitlist campaign's browser conversion signal without reconnecting the
standalone waitlist to quiz funnel state or browser Customer.io.

This is an analytics-only change. It does not change visible copy, layout, navigation,
form timing, or recovery behavior, so no user-facing mockup is required.

## Approved behavior

1. The waitlist keeps PostHog behind analytics-cookie consent.
2. The Meta Pixel loads only after marketing-cookie consent and uses pixel
   `988892550357504` through the existing Meta runtime.
3. `PageView` fires for `/warteliste`, `/warteliste/umfrage`, and
   `/warteliste/danke` through the existing route-aware provider.
4. A standard Meta `Lead` fires only after `POST /api/waitlist` succeeds for a new
   signup. Duplicate successes remain PostHog-visible but do not emit another Meta
   conversion.
5. Typeform submission emits one separate `CompleteRegistration` quality event. It is
   not the campaign optimization event and technical skips do not emit it.
6. Funnel context, browser Customer.io, copy, redirects, persistence, and Customer.io
   outbox behavior remain unchanged.

## Deliberate deferral

Do not add or activate a waitlist CAPI sender in this patch. The repository documents an
existing CAPI Gateway plus default-off first-party Lead delivery and unresolved
advertising-consent/deduplication prerequisites. Browser Pixel delivery unblocks the
campaign without risking a third `Lead` copy.

## Verification

- focused Meta and waitlist analytics tests;
- full Node test suite and `ci:verify`;
- fresh browser context proving no Meta script before consent, a loaded pixel after
  marketing consent, and one PageView per waitlist step;
- intercepted success/duplicate form responses proving only the new success emits
  `Lead`;
- no production, Meta Events Manager, or campaign mutation in this implementation turn.

## Verification receipt

- Branch/base: `codex/waitlist-meta-tracking` from `origin/main` at
  `13f8cb5288c5b7ad32224d891092a1bbb2f1344b`.
- Focused tests: 19 passed.
- Full Node suite: 2,601 passed, 0 failed.
- `npm run ci:verify`: typecheck passed; lint passed with four unrelated existing
  warnings; production build passed with all three waitlist routes generated.
- Isolated browser run: no `fbq` or Facebook script before consent; after marketing
  consent, one script and one initial `PageView`; client navigation produced three total
  `PageView` events; a new API success produced one `Lead`; survey submit produced one
  `CompleteRegistration`; a later duplicate API success left `Lead` at one.
- Artifacts: source, tests, and this plan are intended for the task commit. Local server
  output and intercepted browser traffic are transient and discarded.
- Residual release check: after deployment, confirm the production Pixel and events in a
  fresh consented browser and Meta Events Manager. No production or Meta configuration was
  changed during implementation.
