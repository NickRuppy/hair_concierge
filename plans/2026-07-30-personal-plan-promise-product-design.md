# Personal-Plan Product — Promise-Derived Design

Status: draft for Nick's review · 2026-07-30
Supersedes: `plans/2026-07-29-post-payment-personal-plan-product-shape.md` (rethought from scratch, promise-first, per Nick's direction; the day-type recipe concept and adaptive-depth reconciliation survive because they re-emerged from the promises)

## 1. Premise

The `/lp/haarplan` funnel's framing is accepted **as given**. The product is derived strictly from what that funnel promises the buyer:

| # | Promise (funnel copy) | Product obligation |
|---|---|---|
| P1 | „Dein Haarplan ist bereit." | A finished, named, personal plan visible immediately after payment — no data entry before the reward. |
| P2 | „Produkte, Reihenfolge, Anwendung" vereint; „Wie oft du die einzelnen Schritte wirklich brauchst." | Plan = named products + step order + application + cadence. |
| P3 | „Verfeinere ihn mit deinen Produkten." / „…an Produkte an, die du bereits besitzt." | Owned products reconciled into the plan; effort scales with mismatches, not categories. |
| P4 | „Deine Auswertung senden wir dir in jedem Fall." | Post-quiz email with the Auswertung actually sent. |
| P5 | Today-vs-goal potential bars; „Dein Haar hat viel Potenzial." | The measurement survives payment: permanent, sober analysis view with progress. |
| P6 | „Ab ⟨+7⟩ kennst du deine Routine ganz genau." / „Bis ⟨+28/30⟩ gesünder und schöner." | Day-7 and day-30 moments that make the dated arc real — a storyline, not a program spine. |
| P7 | „Wie du Chat und Haartagebuch ergänzend nutzt." | Chat contextual where questions arise; diary absorbed as execution logging. Both secondary. |
| P8 | Subscription (justified by companionship) | Plan is living: adjustable, check-ins, questions — but timeless, not calendar-bound. |

Guiding constraint from Nick: **best minimal product shape that meets the expectations and does the job.** Scratch anything that doesn't serve a promise.

## 2. Product shape at a glance (final, 2026-07-30 evening — matches mockup v8)

**Phase 1 — locked onboarding (no navigation, progress bar Analyse · Produkte · Alltag), 10 screens:**

```
Zahlung → 1 Analyse → 2 Idealplan (Routine-Seiten-Optik) → 3 Übergang
        → 4 Kategorien-Mehrfachauswahl → 5 konkretes Produkt je Kategorie (Suche/Foto-Intake)
        → 6 Übersicht mit Sofort-Urteilen → 7 Vergleichs-Sheet (Hauptaktion: „X auf die Einkaufsliste")
        → 8 Übergang → 9 Gewohnheitsfragen (Live-Onboarding-Stil) → 10 „Dein Plan ist fertig — und gespeichert."
```

No purchase inside onboarding — recommendations land on the Einkaufsliste. The finished plan shows all recommendations incl. Einkaufsliste items (small chip, pending-style).

**Phase 2 — the app, navigation Option A** (research-backed: HIG/M3 3-tab band, Oura/MFP/Curology patterns):

- **Heute** — day-type picker with calendar-strip preview, opens the foldable runbook (accordion; „Erledigt" logs the day, „Kleine Anpassung" for deviations); check-in cards when due; contextual missing-product card.
- **Produkte** — segmented „Meine Produkte | Einkaufsliste"; shopping list is the only purchase surface (shop links, „schon besorgt"), badge only while items are open.
- **Fortschritt** — per-dimension bars (start vs. today), Bilanz schedule (Tag 7 / 30 / monatlich), full Verlauf calendar, rhythm line; dot badge when a check-in is due.
- **Profil — behind the header avatar** (Flo pattern): Haarprofil, Mitgliedschaft incl. Kündigungsweg, Erinnerungen, Hilfe, Abmelden.
- **Chat**: no tab — contextual „Frag Chaarlie" on runbook steps (+ optional header icon). Tagebuch: gone as a surface; logging is a byproduct of „Erledigt".

## 3. The five surfaces

> Note 2026-07-30 evening: Section 2 and mockup v8 are authoritative for structure and navigation; 3.1–3.4 below document the per-surface rationale and earlier decisions that still apply (reveal reward, adaptive depth, fold UX, measurement honesty).

### 3.1 Reveal (first minute after payment)

Two stepped, user-paced screens, mobile-first (~30–60 s total). This is the reward for the long quiz.

1. **Analyse (compact recap)** — sober, product-grade (explicitly *not* the salesy offer aesthetic): the three focus areas, one line each on what we detected, the bars — then quickly on. Full analysis depth lives in Profil from day one. CTA: „Weiter zu deinem Plan".
2. **Dein Haarplan (v1)** — the plan unveils (categories appear staggered): day-type routines with **named products from the start**, labeled „Startempfehlung", plus order, application, cadence. Source: the prepared plan computed at quiz time (`locked_plan` — exists today, currently never rendered).

Ends with the bridge, honest but motivating: „Damit dieser Plan wirklich zu dir passt, gleichen wir ihn jetzt mit den Produkten ab, die du schon benutzt." Refinement is clearly framed as practically required — but never forced. Leaving keeps Plan v1 usable with visible „noch offen" chips.

### 3.2 Adaptive Verfeinerung (revised 2026-07-30 after mockup round 1)

Not a step-by-step wizard: a **category overview with live verdicts** (structure adopted from the 2026-07-29 three-stage mockup), where depth scales with conflict:

1. **Overview screen**: all product roles as rows with verdict badges — „Passt" (green ✓), „Wechsel" (red), „In Prüfung" (amber), „Offen" (not yet entered) — plus a stats strip („3 passen · 1 Wechsel · 2 offen"). Adding an owned product happens inside a row (the old onboarding product intake, integrated). Catalog products get an **instant verdict** (the engine already computes verdicts live today); unknown/photo-submitted products go „In Prüfung" without blocking the rest.
2. **Analytical decision screen** per red row: your product vs. Chaarlies Wahl side by side, a **fit matrix** (Anforderung × Deins/Empfohlen with ✓/△/×), a one-line Fazit, then the decision options (wechseln / behalten / andere Alternative). A user-chosen validated alternative becomes a first-class plan product, no residual warning. Where possible, a replaced product is re-used in another role („dein Aktivkohle-Shampoo wird dein Klär-Shampoo") — nothing is wasted.
3. **Behavior block after products**: „Kurz noch: deine Routine verstehen" — the 2–3 habit questions that change the plan (Hitze, drying, current wash frequency), each answer showing its plan consequence. Technique-only advice (towel, brush, night) becomes runbook step content, not questions.
4. Resumable, skippable; open categories stay visible as „Offen" rows.

**Finale — the single buying moment of the journey:** „Dein Plan ist finalisiert." with pride first („4 deiner Produkte bleiben"), then ONE consolidated Einkaufsliste („Das besorgen wir noch für dich mit") with shop links (affiliate-transparent). Corresponding plan steps show „ab Kauf" with a bridge tip until purchased. Optional (nice-to-have): shareable card „Mein Haarplan von Chaarlie" without full paid detail.

### 3.3 Plan home (the everyday product)

The finished plan as a small set of **day-type routines** (Waschtag, Intensiv-Pflegetag with internal key `intensive_care_wash`, Auffrisch-Tag, Klär-Waschtag when warranted, and **Pausentag always included** as a reassurance card), preceded by a **rhythm strip** („Waschtag → Auffrisch-Tag → Pausentag → Intensiv-Pflegetag ↻", no fixed weekdays). Each day-type card shows its cadence and a **recipe chip row** of its product sequence (missing/„ab Kauf" products in amber). Opening a day type reveals the **runbook**: per step a 3-phase instruction (Auftragen → Bearbeiten/warten → Abschließen, each verb + duration + detail — adopted from the three-stage mockup, stacked cards instead of a table on mobile) plus an ownership chip (Deins / Empfohlen / ab Kauf) with a bridge tip for gaps.

- **Executing is logging, one tap:** pick „Heute ist Waschtag", follow the steps (reference content, not checkboxes), hit one „Erledigt" — with an optional lightweight „kleine Anpassung" (e.g. „Produkt X heute weggelassen"). History visible as a quiet „Verlauf" strip.
- Each step carries a quiet „Frag Chaarlie"-affordance seeding chat with step context. Per-step „Passt nicht?" opens the same decision card as refinement (P8: the plan stays adjustable).
- Einkaufsliste and open refine chips live here until resolved.
- Due check-ins appear here as cards.

### 3.4 Fortschritt (own tab since v8; Profil moved behind the avatar)

- The full analysis, permanent and sober: per-dimension bars, diagnosis, plan rationale („Vier Signale"). Bars use a **finer scale than the offer's three segments** (granular per-dimension scale, reworked during mockups); movement is measured against the user's own starting point — no fake „goal" endpoint.
- **Check-ins move the bars:** Tag ~7 „Sitzt deine Routine?" (quick confirm/adjust, fulfills P6a); Tag ~30 „Deine erste Bilanz" (short self-assessment of perceived state per dimension, visibly updates the bars, fulfills P6b). Delivered as email + in-app card. Cadence after day 30: recurring gentle Bilanz (~monthly) — the subscription's visible heartbeat. Confirmed: 7 / 30 / monthly.
- Existing profile functions (products, membership, quiz answers) remain beneath.

### 3.5 The Auswertung email (post-quiz)

**Already handled outside this design:** a Customer.io email exists (updated 2026-07-30 by Nick) — a reduced version of the result/offer page: brief analysis + redirect, no named products, no plan teaser. P4 is thereby fulfilled as a re-engagement asset. No app-side email work in this design; no second post-finalization email (the app is the living home; the share card covers the pride moment).

## 4. What gets scratched (minimal-shape decisions)

- Chat tab, Tagebuch tab (both absorbed/contextual).
- The generic 13-step onboarding as the post-payment gate (replaced by the reveal → refinement flow; habit questions only where a decision needs them).
- 30-day *program* structure (no week phases, no calendar) — the arc is two check-ins + copy.
- Second plan email, full PDF export.
- Diary-driven journey mechanics (explicit later-stage dream, out of scope).

## 4a. Rollout scope

Personal-plan funnel (`/lp/haarplan` buyers) first. Legacy organic buyers keep the current flow until the new product is proven, then migrate. Mockups reflect the personal-plan journey.

## 5. Non-goals

- No changes to quiz, offer, checkout, pricing, entitlement in this design.
- No new recommendation-engine rules unless a surface exposes a concrete gap.
- No outcome claims from plan changes; check-ins record perceived state only.
- Legal/copy flags from the 2026-07-30 funnel review (reference prices, consent, testimonial attribution) are acknowledged but handled separately.

## 6. Open items

- Exact German naming polish (Bilanz vs. Check-in; „Heute"-tab greeting).
- Share-card content boundaries (what's free to show vs. paid detail).
- Plan-edit undo/versioning depth; post-onboarding product substitution entry point.
- Fortschritt tab: whether the rhythm line needs the tracker's trust-gate semantics.

## 7. Status & next steps

1. **Mockups: done through v8** (`plans/mockups/2026-07-30-promise-product-journey.html`, published artifact; focus mockup `2026-07-30-runbook-fold-nav.html` is historical detail). Iterated with Nick across 8 rounds; navigation Option A accepted („sounds reasonable") based on the dedicated nav research (HIG/M3/NN/g + app survey: Oura, Headspace, MFP, Curology, Flo).
2. Remaining gates per CLAUDE.md: final mockup confirmation on v8 → designed-user-journey walkthrough & explicit sign-off → then `writing-plans` for implementation.
