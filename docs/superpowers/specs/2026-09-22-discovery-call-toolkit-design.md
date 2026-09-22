# Discovery-Call Toolkit — Design

**Date:** 2026-09-22
**Status:** Approved in shape by Nick (chat, 2026-09-21/22); spec pending review
**Owner:** Nick

## Purpose

Nick runs 50–100 manual one-on-one hair-consultation calls (friends, family, extended network) to rediscover the product shape from first principles. Participants rate their hair satisfaction 1–10; anyone below 10 gets a call whose goal is that they leave knowing exactly what to do to get to a 10.

The toolkit optimizes call productivity: all data is captured **before** the call, all analysis happens **during prep**, and the call itself is Nick driving a purpose-built cockpit. The cockpit deliberately is **not** the existing product UI — it is the canvas on which the next product version gets discovered, adapted call by call.

## Participant journey (locked boundary)

Participants see **only**: registration → existing 10-question quiz (unchanged) → new intake checklist page. No routine, no plan UI, no paywall, no existing member area. The call is the reveal; delivery is cockpit (screen-share) + PDF afterwards.

1. **Outreach** (manual) → participant books via Calendly.
2. **Intake link** in the booking confirmation → register → quiz → product checklist → submit.
3. **Prep** (Nick, T-1 day): research unknown products, review generated analysis in cockpit.
4. **Call**: Nick screen-shares the cockpit and walks through diagnosis → product verdicts → ideal routine → concrete steps.
5. **After**: participant receives a simple PDF of their plan; optionally a `manual_access_grants` comp (reason `friend`) if they want to explore the app themselves.

**Sequencing decision:** build intake + cockpit **first**, then start outreach (no Calendly free-text bridge, no manual product entry).

## Component 1 — Intake checklist page (build)

A flag-/link-gated page in the existing app (participant must be logged in).

- **Step 1:** capture 1–10 satisfaction score + biggest problem/goal (free text). Lives here, not in Calendly questions, so all call data is in the DB and appears in the cockpit automatically.
- **Steps 2…n:** one entry per product category (Shampoo, Conditioner, Maske, Leave-in, Öl, Styling, …exact list decided at planning time from the engine's category set). Per category:
  - **Scan barcode** (existing scan resolve flow) **or type a name** (existing name-only search with dm-backed lane from the scan-search revamp, PR #593).
  - Pick the match, or „nicht dabei" → files a normal miss into the existing intake pipeline (`scan_resolve_events` / `product_submissions`).
  - Category gets its checkmark; **multiple products per category allowed**; "use nothing here" is a valid answer.
- **Storage:** new small table (working name `discovery_intake`) holding score, problem text, and product rows `(user_id, category, product_id | raw_name, source)`. Deliberately **not** squeezed into `user_product_usage` (one-per-category limit) — a mapping into engine inputs happens at analysis time.
- **Finish:** explicit „Absenden" marking intake complete (visible to Nick).
- All UI text in German, telegram style, one job per screen.

This page doubles as a live probe of the Badezimmer-Check pillar from the freemium direction.

## Component 2 — Thin cockpit (build)

One admin-gated page per participant, inside the existing repo so it calls the real engines directly. Sections:

1. Score + stated problem/goal (from intake)
2. Diagnosis — quiz profile rendered readable
3. Product verdicts — their shelf, evaluated by the existing evaluation logic
4. Idealroutine (existing engine)
5. Konkrete Schritte / refined routine (existing engine)
6. Alternatives / recommendations
7. **Notes** — free-text per participant; Nick's discovery log (what confused them, what landed). This is the research output of the program.

Design bar: deliberately plain, fast to reshape between calls. No polish, no mobile optimization, no access for anyone but Nick.

## Component 3 — PDF (thin)

A participant-facing, print-styled view of the cockpit's plan sections (product voice, German, no internal notes/verdict internals). Export = browser "print to PDF", sent manually. No PDF generation pipeline.

## Component 4 — Prep runbook (docs only)

Checklist in `docs/` (no feature): T-1 day → check intake submitted → run misses through the existing research queue → promote → open cockpit → sanity-check routine → note talking points against the stated problem.

## Non-goals (YAGNI)

- No shortened quiz variant; the existing quiz runs unchanged.
- No shelf-inventory feature in the member product proper (checklist stays gated to the discovery program).
- No PDF generation pipeline, no email automation, no Calendly API integration.
- No self-serve reveal for participants pre-call.
- No cockpit multi-user/team features.

## Open items (resolved during planning, not blockers)

- Exact category list for the checklist (derive from engine categories).
- How intake products map into engine inputs at analysis time (primary product per category selection when multiple exist).
- Gating mechanism for the intake page (invite link token vs. env flag vs. account allowlist).

## Decisions log

- Intake path: existing funnel, full quiz, checklist page; submit-everything before call (Nick, 2026-09-21)
- Cockpit: thin, purpose-built, not the existing product UI — seed of next product version (Nick)
- Handoff: simple PDF; optional comp grant (Nick)
- Build first, then start calls — no manual-entry bridge (Nick, 2026-09-22)
- Participant boundary confirmed: registration + quiz + checklist only (Nick, 2026-09-22)
