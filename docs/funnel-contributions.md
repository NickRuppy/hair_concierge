# Funnel Contributions

This workflow lets a contributor build a complete landing-and-offer package without production
access. The shared quiz, attribution, checkout, and payment provider configuration remain owned by
Nick.

## 1. Fork And Branch

Fork `NickRuppy/hair_concierge`, clone the fork, and create a branch named
`funnel/<package-key>`. Do not request write access to the upstream repository.

Use Node 22 and install the locked dependencies:

```bash
npm ci
```

## 2. Generate The Package

Use stable English identifiers. Package keys use `snake_case`; slugs and variant IDs use
`kebab-case`.

```bash
npm run funnel:new -- \
  --key scalp_offer_b \
  --slug scalp-offer-b \
  --landing default \
  --offer scalp-offer-b \
  --channel meta
```

The command reuses an existing variant when its file already exists. Otherwise it creates a safe
wrapper around the current production experience. Edit only:

- `src/funnels/packages.json`
- `src/funnels/landing/<variant>.tsx`
- `src/funnels/offers/<variant>.tsx`
- `public/images/funnels/**`
- `docs/funnel-briefs/**`

The files named `registry.generated.ts` are generated. Do not edit them manually.

Once a package exists upstream, its key, slug, channel, landing variant, offer variant, and component
files are owner-controlled. Create new variant files and a new package for every new combination;
only the package status may change in a fork PR. Historical variants stay available for at least the
90-day attribution window so returning leads remain in their original lane.

Landing tracking is mounted by `/lp/[slug]`, outside the variant. Offer variants receive the shared
pricing and checkout UI as `pricingSlot`; do not copy or replace Stripe, PayPal, analytics, cookie,
or attribution code.

## 3. Preview And Verify

Run:

```bash
npm run funnel:check
npm run test:node
npm run ci:verify
npm run dev:worktree
```

Check the generated `/lp/<slug>` route on desktop and mobile, finish the shared quiz, and confirm the
declared offer appears. Status is reporting and review metadata; it does not turn the URL on or off.
Campaign activation happens when Nick approves the package and points traffic at its URL.

## 4. Open A Draft PR

Open a draft PR from the fork into `NickRuppy/hair_concierge:main`, select the `funnel` PR template,
and allow maintainer edits. Fill in the template, attach desktop and mobile screenshots, and request
review from `@NickRuppy`.

Vercel requires an owner to authorize deployments from forks. Fork workflows do not receive
production secrets, so live Supabase, AI, and provider-backed review jobs may skip. This is expected
and must remain visible; never move fork code to `pull_request_target` or add production credentials.

Nick reviews the experience, tracking boundary, checkout integrity, and CI. Only Nick approves and
merges. If a funnel needs shared code, pricing, payment IDs, migrations, workflows, or environment
changes, Nick takes that work into an owner-controlled branch.
