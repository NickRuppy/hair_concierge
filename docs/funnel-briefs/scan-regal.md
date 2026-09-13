# Scan Regal offer

## Purpose

`scan_v1` (`/lp/scan`) is a third, parallel funnel package that puts the product scanner — not
the personal plan — at the center of the story for cold Meta traffic. It reuses the existing
10-question legacy quiz (`/quiz`) unchanged and layers three answer-aware inserts on top of it,
then leads to a scanner-first offer (`scan-regal-v1`) and a scanner-first landing after purchase.

| Field            | Value                                                                      |
| ---------------- | --------------------------------------------------------------------------- |
| Package key      | `scan_v1`                                                                    |
| Slug             | `scan` (`/lp/scan`)                                                          |
| Channel          | `meta`                                                                       |
| Landing variant  | `scan-regal` (`src/funnels/landing/scan-regal.tsx`)                         |
| Quiz variant     | `legacy-quiz-v1` (unchanged 10-question quiz, plus three inserts)           |
| Offer variant    | `scan-regal-v1` (`src/funnels/offers/scan-regal-v1.tsx`)                    |
| Status (current) | `placeholder` in `src/funnels/packages.json` — see Activation below         |

`default_organic` and `meta_personal_plan_v1` stay byte-identical. This is a new, parallel
package, not a variant of an existing one — see `docs/funnel-attribution.md` for the package
identity model.

## Hypothesis

Cold Meta traffic responds better to a scanner-first framing ("stop guessing in front of the
shelf") than to a plan-first framing, because the barrier to entry (a phone scan) is more
concrete and less abstract than a personalized routine. The legacy quiz doubles as the
onboarding step that produces the hair profile the scanner needs; three inserts placed inside
the quiz preview the scanner's judgment using the visitor's own answers so far, keeping the
promise concrete before the visitor ever reaches the paid offer.

## Primary KPI

Purchase rate per landing view (`purchase_completed` / `landing_viewed`), compared against
`default_organic` for the same reporting window, broken down by `funnel_package_key`. See
`docs/funnel-attribution.md` → "Comparing Packages in PostHog" for the full event list
(`landing_viewed`, `quiz_started`, `quiz_insert_viewed`, `quiz_completed`, `offer_viewed`,
`purchase_completed`) and the Starter Report SQL for a Supabase-side read on the same funnel.

No A/B split, kill criteria, or pricing experiment is part of this package; it ships as a
straight parallel funnel and is read against `default_organic` after launch.

## The three quiz inserts

The legacy quiz's ten questions and their order are unchanged. Three non-question inserts are
spliced between question groups; they do not count toward the "x/10" progress the visitor sees,
and they do not call the recommendation engine — each shows a small, answer-derived example
table (`src/lib/quiz/scan-insert-examples.ts`) that is always labeled `Beispiel`.

| Insert                | Placement                          | Shows                                                                                     |
| ---------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------ |
| 1 — "Das Problem"      | After density (question 3)          | Photo of a woman with a bottle; example row keyed off the visitor's `thickness` answer      |
| 2 — "Die Lösung"       | After scalp (question 8)            | Photo of a shelf scan; example row keyed off the visitor's scalp type/condition answers      |
| 3 — "Und zu Hause"     | After goals (question 10)           | Photo of a bathroom shelf; example rows (Balea Repair Kur) keyed off the visitor's thickness and goal answers      |

Each insert fires `quiz_insert_viewed { insertId, funnelPackageKey }` (PostHog only) and does
not fire `quiz_step_viewed` — see `docs/funnel-attribution.md` for why that split matters for
package comparisons.

## Image provenance

All landing and offer photography is AI-generated lifestyle imagery with a real Chaarlie screen
composited onto the phone in frame, not a stock photo or a captured device screenshot standing
alone. Generation prompts and notes live under `plans/scanner-funnel/evidence/prompts/`; the
1024×1536 PNG originals are kept outside the repository, and the web-sized WebP/PNG derivatives
that actually ship live under `public/images/funnels/scan/`:

- `frau-regal-aha.webp`, `regal-hand-phone.webp`, `regal-scan-flasche.webp`, `bad-ablage.webp` —
  landing and insert photography.
- `hero-camera.png`, `packshot-ogx.png` — offer hero scan-demo assets.
- `tour-scanner.png`, `tour-plan.png`, `tour-anwendung.png`, `tour-chat.png` — the product-tour
  section's four screenshots. These four are currently prototype/dev-seed captures and must be
  replaced before launch — see Activation checklist, item 1.

The phone in each lifestyle photo shows only the camera viewfinder (no verdict of its own), so
the answer-aware overlay card is the only result a visitor sees on an insert and can never
disagree with the photo. Keep that invariant if a photo is replaced.

## Rollout

`scan_v1` ships as a new, parallel package. `default_organic` and `meta_personal_plan_v1` keep
their existing landing, quiz, and offer experiences untouched. Meta campaigns may target
`/lp/scan` directly; UTM parameters and `fbclid` continue to describe acquisition only and never
select the package (the URL slug does).

Same subscription, same pricing (€14.99 / €34.99 / €99.99, annual recommended) as the other
packages — this package changes framing and the product-tour narrative, not commercial terms.
After purchase, the buyer is provisioned into `/scan` first rather than `/plan-start`; the plan
remains reachable from navigation. See `plans/scanner-funnel.md` for the full technical mapping.

## Activation checklist

Do not execute this checklist as part of building the package — it is the launch gate for
flipping `scan_v1` from `placeholder` to `active`, and runs only after Nick's explicit GO.

1. Product-tour captures: `tour-scanner.png` (locked scan design) and `tour-chat.png` (real chat
   answer) are launch-ready; `tour-plan.png` is the real Stage-1 plan composition
   (`/labs/personal-plan-start`, 2026-09-13); `tour-anwendung.png` is a capture from a real
   Personal-Plan account (2026-09-13). Done.
2. In the real `/result` context (not a lab/harness), verify the shared pricing slot's fine
   print and CTA (`Plan sichern`) read correctly for this package's scanner-first framing.
3. Confirm production environment variables: `PERSONAL_PLAN_LEGACY_QUIZ_CUTOVER_ENABLED=true`
   and a valid `PERSONAL_PLAN_APP_V1_NEW_BUYER_CUTOFF` (both already exist in Vercel; confirm
   their values). `SCAN_FUNNEL_ENABLED` is only needed while the package status stays
   `placeholder` — once status flips to `active`, the flag no longer gates the route or
   attribution (see `docs/funnel-attribution.md`).
4. Flip `status` from `placeholder` to `active` for `scan_v1` in `src/funnels/packages.json` as
   its own commit, after Nick's explicit GO.
5. Drive the full production journey from `/lp/scan` with the standard test account, including
   a real scan on `/scan` after purchase.
6. Point the Meta campaign URL at `/lp/scan`.
