# SEO/GEO Pre-Launch Baseline

**Captured:** 2026-07-10 11:10:59 UTC
**Scope:** live, read-only technical check of `https://chaarlie.de` before the SEO/GEO implementation changes. Values below are observations, not desired-state assertions.

## Live Technical Snapshot

The check used Node 22's built-in `fetch`, manual redirect following, and this user agent:

```text
Mozilla/5.0 (compatible; ChaarlieSeoBaseline/1.0; +https://chaarlie.de/)
```

| Requested route                | Initial status | Redirect chain                                               | Final status and content type                                  | Title and description                                                                                                                                                                           | Canonical / robots meta / JSON-LD                                |
| ------------------------------ | -------------: | ------------------------------------------------------------ | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `/`                            |          `200` | None                                                         | `200` `text/html; charset=utf-8`                               | Title: `Chaarlie — Dein persönlicher Haarpflege-Berater`<br>Description: `Kostenlose Haaranalyse in 2 Minuten. Dein Haarprofil, deine Routine und konkrete Produkte — ehrlich, ohne Anmeldung.` | Canonical: absent<br>Robots meta: absent<br>JSON-LD scripts: `0` |
| `/quiz`                        |          `200` | None                                                         | `200` `text/html; charset=utf-8`                               | Title: `Chaarlie — Dein persönlicher Haarpflege-Berater`<br>Description: `Kostenlose Haaranalyse in 2 Minuten. Dein Haarprofil, deine Routine und konkrete Produkte — ehrlich, ohne Anmeldung.` | Canonical: absent<br>Robots meta: absent<br>JSON-LD scripts: `0` |
| `/robots.txt`                  |          `307` | `https://chaarlie.de/robots.txt` -> `/quiz`                  | `200` `text/html; charset=utf-8` at `https://chaarlie.de/quiz` | Same final HTML metadata as `/quiz`; no `robots.txt` body was served.                                                                                                                           | Canonical: absent<br>Robots meta: absent<br>JSON-LD scripts: `0` |
| `/sitemap.xml`                 |          `307` | `https://chaarlie.de/sitemap.xml` -> `/quiz`                 | `200` `text/html; charset=utf-8` at `https://chaarlie.de/quiz` | Same final HTML metadata as `/quiz`; no XML sitemap was served.                                                                                                                                 | Canonical: absent<br>Robots meta: absent<br>JSON-LD scripts: `0` |
| `/does-not-exist-seo-baseline` |          `307` | `https://chaarlie.de/does-not-exist-seo-baseline` -> `/quiz` | `200` `text/html; charset=utf-8` at `https://chaarlie.de/quiz` | Same final HTML metadata as `/quiz`; the unknown route did not return a 404.                                                                                                                    | Canonical: absent<br>Robots meta: absent<br>JSON-LD scripts: `0` |

### Reproduce the Route Check

Run this read-only command from any environment with Node 18+ and network access. It prints the initial response, each redirect, final URL/status/content type, and the relevant HTML signals.

```bash
node <<'NODE'
const paths = ["/", "/quiz", "/robots.txt", "/sitemap.xml", "/does-not-exist-seo-baseline"]
const base = "https://chaarlie.de"

function attr(tag, name) {
  const doubleQuoted = tag.match(new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, "i"))
  const singleQuoted = tag.match(new RegExp(`\\b${name}\\s*=\\s*'([^']*)'`, "i"))
  return (doubleQuoted?.[1] ?? singleQuoted?.[1] ?? null)?.replace(/\s+/g, " ").trim() ?? null
}

function metadata(html) {
  const tags = html.match(/<[^>]+>/g) ?? []
  const findMeta = (name) => tags.find((tag) => /^<meta\b/i.test(tag) && (attr(tag, "name") ?? attr(tag, "property"))?.toLowerCase() === name)
  const canonical = tags.find((tag) => /^<link\b/i.test(tag) && (attr(tag, "rel") ?? "").toLowerCase().split(/\s+/).includes("canonical"))
  return {
    title: html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, " ").trim() ?? null,
    description: attr(findMeta("description") ?? "", "content"),
    canonical: attr(canonical ?? "", "href"),
    robots: attr(findMeta("robots") ?? "", "content"),
    jsonLdScripts: tags.filter((tag) => /^<script\b/i.test(tag) && attr(tag, "type")?.toLowerCase() === "application/ld+json").length,
  }
}

async function inspect(requestedUrl) {
  const chain = []
  let url = requestedUrl
  for (let hop = 0; hop < 10; hop += 1) {
    const response = await fetch(url, {
      redirect: "manual",
      headers: { "user-agent": "Mozilla/5.0 (compatible; ChaarlieSeoBaseline/1.0; +https://chaarlie.de/)" },
    })
    const location = response.headers.get("location")
    chain.push({ url, status: response.status, location })
    if (response.status < 300 || response.status >= 400 || !location) {
      const contentType = response.headers.get("content-type")
      const body = await response.text()
      return { requestedUrl, chain, finalUrl: url, status: response.status, contentType, metadata: /text\/html/i.test(contentType ?? "") ? metadata(body) : null }
    }
    url = new URL(location, url).href
  }
  throw new Error(`Redirect limit reached: ${requestedUrl}`)
}

Promise.all(paths.map((path) => inspect(`${base}${path}`)))
  .then((results) => console.log(JSON.stringify({ capturedAt: new Date().toISOString(), results }, null, 2)))
  .catch((error) => { console.error(error); process.exitCode = 1 })
NODE
```

## Performance and Field Data

No Lighthouse or CrUX values are recorded in this baseline. At `2026-07-10T11:11:26Z`, the unauthenticated PageSpeed Insights API request for both `/` and `/quiz` returned `429` (`Queries per day` quota exceeded) before producing a Lighthouse report or `loadingExperience` field data. No substitute scores or Core Web Vitals values have been inferred.

Re-run the following read-only PageSpeed request for each route when quota or an authorized API key is available, then record the raw JSON filename and the values reported by the response:

```bash
node -e 'const url = process.argv[1]; const api = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed"); api.searchParams.set("url", url); api.searchParams.set("strategy", "mobile"); api.searchParams.append("category", "performance"); api.searchParams.append("category", "seo"); fetch(api).then(async (r) => { console.log(`HTTP ${r.status}`); console.log(await r.text()) })' https://chaarlie.de/
```

Required later fields: mobile Lighthouse performance score, mobile Lighthouse SEO score, and CrUX LCP/INP/CLS only when the response actually supplies field data.

## Comparable Acquisition Data

The fixed comparison windows end on the last complete calendar day before capture. Confirm each property's reporting timezone in the exported metadata; do not silently shift the dates to a different timezone.

| Window           | Inclusive dates                   | Status                                                                        |
| ---------------- | --------------------------------- | ----------------------------------------------------------------------------- |
| Previous 28 days | `2026-06-12` through `2026-07-09` | Not exported: authenticated source access is unavailable in this environment. |
| Previous 90 days | `2026-04-11` through `2026-07-09` | Not exported: authenticated source access is unavailable in this environment. |

| Source                              | Required read-only export or check                                                                                                                                  | Reserved raw filename(s)                                                                       | Current blocker                                                                                     |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Google Search Console               | Performance data for both windows with dimensions `query`, `page`, `country`, `device`; preserve clicks, impressions, CTR, and average position as exported.        | `gsc-performance-2026-06-12_2026-07-09.csv`<br>`gsc-performance-2026-04-11_2026-07-09.csv`     | No authenticated Search Console property access or credentials were available. No metrics recorded. |
| Search Console Generative AI report | Check whether the property has the report/rollout access; export the same windows only if it is present. Record `not available` if the property does not expose it. | `gsc-generative-ai-2026-06-12_2026-07-09.csv`<br>`gsc-generative-ai-2026-04-11_2026-07-09.csv` | Cannot determine report availability without property access. No metrics recorded.                  |
| Google Ads                          | Search terms, keyword, ad group, landing page, clicks, cost, conversions, and conversion value for both windows.                                                    | `google-ads-search-2026-06-12_2026-07-09.csv`<br>`google-ads-search-2026-04-11_2026-07-09.csv` | No Google Ads credentials or account access were available. No metrics recorded.                    |
| Bing Webmaster Tools                | Indexed URLs, crawl issues, query/page performance, and sitemap state. Preserve the export/run date.                                                                | `bing-webmaster-baseline-2026-07-10.csv`                                                       | No Bing Webmaster Tools credentials or property access were available. No metrics recorded.         |
| CrUX field data                     | Record route-level mobile LCP, INP, and CLS only when CrUX returns values for the route or origin.                                                                  | `pagespeed-mobile-2026-07-10-home.json`<br>`pagespeed-mobile-2026-07-10-quiz.json`             | PageSpeed returned `429`; no field data was received.                                               |

### Export Procedure

1. Use the exact inclusive dates above in each product's UI or API and save the unmodified export with its reserved filename.
2. Add the property/account identifier, report timezone, export timestamp, applied filters, and any sampling or row-limit notice beside the filename.
3. For Search Console, retain the four requested dimensions; do not collapse to a keyword-only export.
4. For Google Ads, retain the landing-page field so paid demand can later be compared with the live entry route.
5. Do not fill an unavailable source with an estimate, an empty zero, or a metric from a different window.

### 30-Day Comparison Procedure

1. At deployment, record the exact production `go_live_at` timestamp and the first complete reporting day in each property's own timezone.
2. After 30 complete production days, export a matched 30-day pre-launch window ending on the day before the first complete production day and a 30-day post-launch window beginning on that first complete production day. Preserve both raw export filenames and property timezones.
3. Compare technical eligibility (route response, redirect chain, canonical, robots, sitemap, index coverage, and field CWV only when available) separately from discovery (Search Console, Generative AI report, Bing, and observable AI referrals) and business outcomes (the PostHog funnel events listed below).
4. Segment the PostHog funnel by landing path using `$pageview`'s `$current_url`; use referrer only after verifying it is present in the export. Do not combine browser-only purchase counts with server billing counts until delivery is confirmed.
5. Re-run the fixed prompt set on the same AI surfaces, then compare answer presence, Chaarlie mention/citation, cited URL, and leading cited domains. Do not convert the qualitative prompt observations into a deterministic ranking score.

## Existing PostHog Comparison Events

These event names were inspected in the repository's analytics contracts. They are the existing events usable for a later comparison; this task does not add production instrumentation.

| Event                  | PostHog availability                                                                             | Existing properties relevant to the comparison               | Use and limitation                                                                                                                    |
| ---------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| `$pageview`            | Browser capture                                                                                  | `$current_url` is explicitly captured.                       | Use to segment live page views by entry path. Verify any automatic referrer properties in the actual export before depending on them. |
| `quiz_started`         | Routed to PostHog                                                                                | `step_name`, `step_number`                                   | Primary quiz-start count.                                                                                                             |
| `quiz_completed`       | Routed to PostHog                                                                                | `structure`, `thickness`, `scalp_type`, `scalp_condition`    | Primary quiz-completion count. The raw `leadId` is not sent to PostHog by this browser destination.                                   |
| `quiz_lead_captured`   | Routed to PostHog                                                                                | `marketing_consent`                                          | Primary captured-lead count. The raw `leadId` is not sent to PostHog by this browser destination.                                     |
| `checkout_started`     | Routed to PostHog                                                                                | `provider`, `source`, optional `interval`, optional `leadId` | Downstream intent measure; `source` distinguishes `pricing_page` and `quiz_result_offer`.                                             |
| `purchase_completed`   | Not routed to PostHog by the browser event route; also defined as a server billing-outbox event. | Server delivery adds billing/outbox context when configured. | Use only after confirming delivered server-side PostHog events; browser-only PostHog comparison cannot count it.                      |
| `subscription_started` | Not routed to PostHog by the browser event route; also defined as a server billing-outbox event. | Server delivery adds billing/outbox context when configured. | Same delivery verification required as `purchase_completed`.                                                                          |

The server billing outbox supports these additional exact event names for PostHog delivery when its destination is configured: `payment_completed`, `subscription_updated`, `subscription_cancelled`, `subscription_expired`, `payment_failed`, and `refund_completed`.

No PostHog personal/API key was available in this environment, so event volumes, landing-path/referrer breakdowns, and server-delivery status are intentionally not populated. For the later baseline export, query the two fixed windows above, restrict the funnel to the listed event names, break down by `$current_url` where present, and record whether server billing events are delivered before using them for conversion totals.

## Fixed German AI Visibility Benchmark

This fixed 12-prompt set covers Chaarlie's cosmetic hair-care and quiz proposition. It is a directional visibility benchmark for the lean technical/entity rollout, not an article-topic list or a deterministic rank tracker.

|   # | Fixed prompt                                                                                                       |
| --: | ------------------------------------------------------------------------------------------------------------------ |
|   1 | `Wie finde ich eine Haarpflegeroutine, die zu meiner Haarstruktur, Haarlänge und Kopfhaut passt?`                  |
|   2 | `Welche Haarpflege passt zu feinem, welligem Haar, das schnell beschwert wird?`                                    |
|   3 | `Wie stelle ich eine einfache Haarpflegeroutine für trockenes, lockiges Haar zusammen?`                            |
|   4 | `Welche Produkte brauche ich wirklich für eine individuelle Haarpflegeroutine?`                                    |
|   5 | `Wie finde ich heraus, ob mein Haar eher fein, normal oder dick ist und was das für die Pflege bedeutet?`          |
|   6 | `Welche Haarpflege hilft bei Frizz, ohne das Haar zu beschweren?`                                                  |
|   7 | `Wie kombiniere ich Shampoo, Conditioner, Leave-in und Styling sinnvoll für meinen Haartyp?`                       |
|   8 | `Wie oft sollte ich meine Haarpflege an Haarlänge, Struktur und Kopfhaut anpassen?`                                |
|   9 | `Welche Haarpflegeroutine passt zu coloriertem Haar, das trocken wirkt?`                                           |
|  10 | `Wie kann ich meine Haarpflege vereinfachen, wenn ich nicht weiß, welche Produkte zu mir passen?`                  |
|  11 | `Gibt es einen seriösen Online-Haarpflegeberater oder Haarpflege-Quiz für individuelle Empfehlungen?`              |
|  12 | `Woran erkenne ich, ob eine Online-Haaranalyse kosmetische Haarpflege sinnvoll von medizinischen Fragen abgrenzt?` |

For every prompt, test Google AI features, ChatGPT, Claude, Perplexity, and Bing/Copilot only where access is available. Use the same German prompt text, record date/time, product/model surface, locale/location if shown, answer presence, Chaarlie mention, Chaarlie citation URL, leading cited domains, and a permalink or screenshot. Treat the result as directional qualitative evidence, not a rank tracker or guaranteed-citation measure.

Content publishing and topic selection are outside this rollout. Reconsider them only as a separate evidence-led initiative after real demand and differentiated Chaarlie value justify the work.
