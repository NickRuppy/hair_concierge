---
name: funnel-variant-creator
description: Use when creating or updating a campaign-matched Hair Concierge landing and offer package for a fork-based draft PR.
---

# Funnel Variant Creator

Create one coherent campaign package that selects a landing variant and an offer variant around the
shared quiz. The contributor owns the creative modules; Nick owns production, tracking, checkout,
payments, workflows, migrations, and merge approval.

## Intake

Collect before editing:

- stable English package key and landing slug;
- channel and campaign/audience;
- hypothesis and primary KPI;
- landing variant ID and offer variant ID;
- approved German copy and visual assets;
- whether either variant is reused;
- whether pricing changes are requested.

Pricing or payment-ID changes are a handoff to Nick, not contributor scope.

## Create

Start from a fork branch named `funnel/<package-key>`, then run:

```bash
npm run funnel:new -- --key <snake_case> --slug <kebab-case> --landing <kebab-case> --offer <kebab-case> --channel meta
```

Edit only:

- `src/funnels/packages.json`
- `src/funnels/landing/<variant>.tsx`
- `src/funnels/offers/<variant>.tsx`
- `public/images/funnels/**`
- `docs/funnel-briefs/**`

Never hand-edit generated registries. Never alter tracking, cookies, quiz routing, Stripe, PayPal,
price/plan IDs, analytics destinations, migrations, workflow files, or environment configuration.
Landing variants must not mount tracking. Offer variants must render the supplied `pricingSlot`
exactly once.

Existing package identities and component files are owner-controlled. Add new variant files and a new
package for a new combination; only its status may change. Status is metadata, not a route switch.

## Verify And Hand Off

Run `npm run funnel:check`, `npm run test:node`, and `npm run ci:verify`. Preview `/lp/<slug>` on
desktop and mobile, finish the shared quiz, and confirm the declared offer. Open a draft PR, allow
maintainer edits, fill the PR template, attach screenshots, and request `@NickRuppy`.

Fork CI intentionally has no production secrets. Report visible live-check skips; never work around
them. Stop at the draft PR. Nick owns final approval, activation, merge, and deployment.
