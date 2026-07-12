# SEO/GEO Operations Runbook

**Scope:** Lean technical SEO/GEO foundation for Chaarlie. This runbook covers crawlability, indexability, entity consistency, acquisition quality, quiz outcomes, and directional AI visibility. It does not create or manage a publishing cadence.

## Operating Principles

- Use the same property, account, timezone, filters, event definitions, and prompt set for comparable runs.
- Separate observed facts from interpretation.
- Record unavailable reports and attribution gaps instead of estimating them.
- Optimize for qualified quiz demand and trustworthy delivery of the product promise, not vanity traffic or citation counts.
- Do not add pages merely to satisfy a cadence or an SEO checklist.

## Fixed Export Windows

For cutoff date `C`, export both comparison pairs:

| Window           | Inclusive dates                      |
| ---------------- | ------------------------------------ |
| Current 28 days  | `C - 27 days` through `C`            |
| Previous 28 days | `C - 55 days` through `C - 28 days`  |
| Current 90 days  | `C - 89 days` through `C`            |
| Previous 90 days | `C - 179 days` through `C - 90 days` |

Preserve raw exports with source, window, cutoff, timezone, filters, and export timestamp. Keep personal data and credentials out of the repository.

| Source               | Required export                                                                                                                                                |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Search Console       | Query, page, country, device, clicks, impressions, CTR, and average position; record AI-feature reporting as unavailable when the property does not expose it. |
| Google Ads           | Search term, keyword/ad group, landing page, clicks, cost, conversions, and conversion value.                                                                  |
| Bing Webmaster Tools | Queries/pages, indexed URLs, crawl issues, and sitemap state.                                                                                                  |
| PostHog              | Landing sessions plus `quiz_started`, `quiz_completed`, `quiz_lead_captured`, and verified purchase events.                                                    |

## Monthly Technical Check

- [ ] Confirm `/robots.txt` returns `200 text/plain` without a redirect.
- [ ] Confirm `/sitemap.xml` returns `200 application/xml` without a redirect.
- [ ] Confirm a random unknown path and `/ratgeber` return 404.
- [ ] Check expected canonicals and robots directives on `/`, `/quiz`, `/methodik`, legal/contact pages, pricing, auth, and one private result route.
- [ ] Confirm Ratgeber, pricing, results, auth, app, admin, API, welcome, and labs are absent from the sitemap.
- [ ] Validate visible homepage structured data and confirm it matches the legal/contact surfaces.
- [ ] Confirm private and authenticated surfaces remain `noindex`.
- [ ] Review Search Console and Bing indexing, sitemap processing, crawl errors, and field Core Web Vitals.
- [ ] Run the established mobile Lighthouse checks on `/`, `/quiz`, and `/methodik`.

For every material failure, record the first observed date, affected URL set, evidence, owner, and next check.

## Fixed AI Visibility Check

Use the exact German prompt set in `docs/seo/seo-geo-baseline.md`. Run it only in accessible Google AI, ChatGPT, Claude, Perplexity, and Bing/Copilot surfaces.

For each prompt, record:

- date, product/model surface, and shown locale/location;
- whether an answer was present;
- whether Chaarlie was mentioned;
- whether Chaarlie was cited and which URL was cited;
- leading cited domains;
- screenshot or permalink when available.

Treat this as directional qualitative evidence. A mention is not a conversion, a citation is not proof of authority, and a small prompt set cannot establish causality.

## Acquisition and Conversion Comparison

Compare the current and previous 28-day and 90-day windows at the same grain:

- Landing page: sessions, query themes, quiz starts, completions, leads, and observable purchases.
- Search/Ads demand: impressions, clicks, CTR, position or cost, conversion outcomes, country, and device.
- Funnel: quiz-start rate per landing session, completion rate per start, lead rate per completion, and purchase rate only where attribution is verified.

Prioritize landing-page relevance and whether the homepage/quiz deliver what the ad or search result promised. Note campaign, tracking, algorithm, and product changes beside any interpretation.

## Verified Entity Facts

| Field                | Verified value                                                    |
| -------------------- | ----------------------------------------------------------------- |
| Brand                | Chaarlie                                                          |
| Legal operator       | Haarmony LLC                                                      |
| Canonical URL        | `https://chaarlie.de/`                                            |
| Public positioning   | Digital guidance for cosmetic hair care                           |
| Legal representative | Jonas Eidenschink, Geschäftsführer                                |
| Contact              | `info@chaarlie.de`                                                |
| Postal address       | Haarmony LLC, 1111B S Governors Ave # 84075, Dover, DE 19904, USA |

Compare these facts across the homepage, Methodik, legal/contact pages, approved external profiles, and `Organization` JSON-LD. Investigate mismatches before publishing structured-data changes.

### External Profiles

No exact owned external profile URL was verified during implementation. `sameAs` must remain empty until a human verifies ownership and consistency of the exact public URL. Never infer handles or use directories, retailer pages, or third-party mentions as `sameAs`.

## Selective Genuine Mentions

- [ ] Search for new public mentions of `Chaarlie`, `Haarmony LLC`, and `chaarlie.de`.
- [ ] Keep only genuine, relevant partner, creator, salon, editorial, or industry references.
- [ ] Record source, URL, publication/discovery date, context, destination, and relationship.
- [ ] Reject mass directories, paid links, reciprocal schemes, fake reviews, copied releases, and synthetic profiles.
- [ ] Do not start outreach or submit profiles as part of the monthly measurement pass.

## 30-Day Review

After 30 complete production days:

1. Repeat the frozen technical checks and export windows.
2. Compare qualified discovery and quiz outcomes against the baseline.
3. Re-run the fixed AI prompt set.
4. Separate facts, plausible inference, and unknowns.
5. Set the next 60-day targets only after seeing sample size and attribution quality.
6. Reconsider a content initiative only if real query/customer demand and differentiated Chaarlie value justify it.

End with one dated record containing technical/indexing status, export timestamps, acquisition/funnel changes, AI observations, entity changes, limitations, owners, and next review date.
