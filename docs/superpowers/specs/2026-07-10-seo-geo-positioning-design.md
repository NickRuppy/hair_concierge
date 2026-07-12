# Lean SEO + GEO Foundation Design

**Date:** 2026-07-10
**Status:** Approved scope amendment

## Objective

Give Chaarlie a correct, credible SEO/GEO foundation without creating content solely for rankings or launching an unfinished publication.

## Product Shape

The rollout has three user-visible or crawler-visible parts:

1. **Technical discovery:** valid robots and sitemap resources, real 404 behavior, deliberate canonicals and index directives.
2. **Entity clarity:** consistent brand/legal identity and conservative homepage structured data.
3. **Transparency:** one compact `/methodik` page that explains what Chaarlie does, what it does not claim, who operates it, and how commercial relationships are handled.

The homepage and quiz remain the primary commercial surfaces.

## Scope

### Crawl and index behavior

- `/robots.txt` returns `200 text/plain` and declares the canonical sitemap.
- `/sitemap.xml` returns `200 application/xml` and contains only stable indexable routes.
- Unknown routes return a genuine 404 instead of redirecting into the quiz.
- Public routes avoid unnecessary authentication lookup.
- Protected routes retain authentication, subscription, and admin-role checks.
- Private, authenticated, result, unstable pricing, admin, API, welcome, and lab surfaces remain out of the sitemap and explicitly `noindex`.

### Metadata and entity identity

- Root metadata defines the title template and shared defaults.
- Homepage, quiz, Methodik, and legal/contact pages have unique descriptions and self-canonicals.
- Homepage JSON-LD contains only visible, stable `Organization` and `WebSite` facts.
- No unsupported rating, review, credential, medical, FAQ, or social-profile claims are added.
- `sameAs` remains empty until exact owned URLs are verified.
- JSON-LD serialization escapes `<` to prevent script-closing injection.

### Methodik

The page visibly explains:

- which self-reported quiz inputs inform the assessment;
- that self-tests and self-assessments are imperfect;
- how rules and product attributes inform cosmetic recommendations;
- that product data, formulas, prices, and availability can change;
- how affiliate links or paid relationships are disclosed;
- the source and update standard;
- the boundary between cosmetic care and diagnosis or medical treatment;
- the legal operator, editorial responsibility, contact, and correction path.

It uses the existing landing header/footer and a clear quiz CTA. It is an explanatory product page, not a marketing hero or medical authority page.

### Measurement

- Preserve a dated pre-launch technical baseline.
- Keep fixed comparable export windows for Search Console, Ads, Bing, and PostHog.
- Use a fixed German AI prompt set only as directional qualitative evidence.
- Re-run the same technical and acquisition checks after 30 complete production days.
- Do not infer missing data or attribute changes causally without evidence.

## Deferred

- `/ratgeber` and article routes.
- Article CMS/API/admin changes.
- Anonymous article reads or Supabase RLS migrations.
- Initial articles, keyword clusters, or an editorial cadence.
- Direct affiliate articles or comparison pages.
- AI-only content, `llms.txt`, special AI schema, or crawler-specific mirrors.
- Broad copy rewrites, profile submissions, outreach, backlinks, or directory work.

These may return as a separate evidence-led initiative only after real search/customer demand and enough differentiated content justify the operational cost.

## Acceptance Criteria

- Homepage, quiz, Methodik, robots, sitemap, and unknown-route behavior match their declared status.
- Every current page and API route is covered by explicit route inventory tests.
- Sitemap contains no private, pricing, result, auth, app, admin, API, welcome, lab, or Ratgeber URL.
- `/ratgeber` returns 404 and is absent from footer navigation.
- Homepage structured data matches visible organization facts.
- Private surfaces emit `noindex` at metadata or response-header level.
- Methodik passes mobile/desktop visual and trust review.
- Focused tests, full Node tests, typecheck, lint, and production build pass.
- Lighthouse reports SEO plus existing performance thresholds for `/`, `/quiz`, and `/methodik`.
- No article CMS, RLS, migration, or publishing changes remain in the branch.
