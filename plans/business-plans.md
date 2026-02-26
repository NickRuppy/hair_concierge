# Business plan propositions

---

## Key context

- **Tom's existing business**: 1.5M+ social followers, paid Skool (~1,200 members), course library, brand partnerships, own product line (retail partner handles fulfillment/distribution).
- **Funding**: bootstrapped → prioritize fast revenue + low ongoing support.
- **Geography**: DACH first, then expand.
- **Goals**: cashflow-first, with ambition for €1M+/yr outcomes.

---

## Strategic question

> Is this "TomBot" (Tom-branded, trust + distribution) or "Hair Concierge" (general brand, bigger TAM)?

---

## Universal components

These are not "nice to haves" — they are essential to the product:

1. **Viral/shareable diagnostic**: quiz output should be a shareable artifact (routine/hairtype card + user images).
2. **Social sharing is the #1 growth lever** — Yuka's organic playbook (zero marketing spend, 80M users) was powered by a single viral TikTok account driving 25K new users/day. Every touchpoint (quiz result, routine card, proommendation, progress photo) needs a native share path. Design for Instagram Stories (vertical 9:16, branded overlay, shareable without context).
3. **Recommendation engine that combines deterministic logic + LLM reasoning**: rules/scoring layer to avoid unsafe or inconsistent advice. Surface a visible
4. **per-product compatibility score** ("XX% Match für dein Haar") on every product mention — OnSkin and SkinSort both do this; it makes recommendations feel personalized and trustworthy.
5. **Retention engine**: repeatable hooks, seasonal specials, routine tracking, product reviews + re-order nudges + progress/journey timeline.
6. **Trust-first monetization (Yuka model)**: don't paywall the diagnostic. Free quiz + routine card + limited chat builds habit. Premium unlocks depth (unlimited chat, tracking, seasonal updates). Find good balance between free and premium tiers.

---

## Competitive intelligence & feature roadmap

**Key insight**: haircare is massively underserved. Hair2Hair is the only dedicated haircare app (~50K users, built by influencer Audrey Victoria with 8M followers). There is no "Yuka for hair." Tom has 1.5M followers but deeper expertise (book, courses, methodology) + a richer knowledge base.

**Five strategic positions** (no app does all five):

1. Scanning (Yuka) — scan products, get instant rating
2. **Personalization** (OnSkin) — profile-matched recommendations ← **we already have this**
3. Tracking (Hair2Hair, FeelinMySkin) — routine logging + progress
4. Community (SkinSort, Picky) — reviews, sharing, social proof
5. (Social commerce (TikTok integration) — share + buy)

### Launch-critical (Plan 1 MVP)

1. **Shareable result cards with social-native formatting** — vertical 9:16, branded overlay, hair type name + visual. 1-tap share to Instagram Stories / TikTok / WhatsApp. This is THE primary growth mechanic.
2. **Per-user product compatibility score** — visible "XX% Match für dein Haar" on every product mention. Makes recommendations feel personalized and trustworthy (OnSkin + SkinS.
3. **Generous free tier** — free quiz + routine card + 3-5 messages/day. Paid unlocks unlimited chat + seasonal refresh + progress tracking. Hair2Hair's biggest mistake was making the free version non-functional → negative reviews. (up for debate)

### Post-launch retention features (months 3-6)

4. **Routine / wash day tracker** — Hair2Hair's strongest retention feature. Log wash day steps (pre-wash → shampoo → conditioner → styling), track products used, build a personal hair diary. This is the engagement loop between AI conversations. -> perhaps needs to be MVP feature to ensure retention
5. **Photo-documented progress timeline** — No competitor connects routine tracking with visible outcomes. Periodic hair photos linked to products + routines used. Creates switching costs (your data lives here) and emotional investment.
6. **Seasonal routine refresh** (already planned) — validated by research, no competitor does this well. Quarterly push: "Dein Herbst-Routine Update ist da" with adjusted recommendations.

### Later roadmap (months 6-12)

7. **Product scanner (barcode/photo)** — the "Yuka for hair" play. Scan any hair product → Tom's ingredient analysis + compatibility score. Strategic priority for the general-brand (Hair Concierge) play — this is the killer feature that unlocks the broader market. Significant build effort (product database, barcode/OCR infrastructure) but worth prioritizing months 6-9.
8. (Dupe finder — SkinSort's popular feature. "This €25 product has a €8 alternative that's 90% match for your hair." High commerce value, strong shareability.)
9. **Ingredient conflict detection** — "Don't use Product A and Product B together." Tom's methodology already has opinions on this.
10. **Side-by-side product comparison** — direct comparison of two products with match scores, ingredient breakdowns, price.
11. **Product/routine review center** — space for members to share their specific experiences and review products / routines.

---

## Propositions at a glance

| # | Plan | Brand | Entry price | Best for | Key risk |
|---|------|-------|------------|----------|----------|
| 1 | TomBot Subscription | Tom | €10/mo | Fast cashflow from trust | Churn after novelty |
| 2 | TomBot Pro Tier (Bundle) | Tom | €24.90–29.90/mo | Higher LTV via content/community | Complexity + Tom time |
| 3 | Hair Concierge Freemium | General | Free → €9.90/mo | Venture-style growth | Bootstrapped cost + focus |
| 4 | Hair Concierge Premium | General | €10/mo | Credibility + higher-value users | Slow brand build |

---

# PLAN 1: TomBot Subscription (base cashflow business)

**One line:** Tom's personal AI hair advisor; monetize trust fast, then drive commerce through routines.

## Target customer
Tom's German-speaking audience (18–45) who want Tom's recommendations personalized to their hair/scalp.

## Offer (what users actually get)
- 2-minute diagnostic quiz → hair profile + routine card with per-product compatibility scores + shareable result card (1-tap share to Stories/TikTok/WhatsApp)
- TomBot chat for adjustments + Q&A
- "Buy my routine" packages (affiliate + Tom products)
- Wash day / routine tracker (post-launch retention feature, months 3-6)
- Photo progress timeline (post-launch retention feature, months 3-6)

## Revenue model
- **Pricing**: trial → €10/mo; add annual plan for retention + cashflow.
- **LTV**: ~€135 (10% monthly churn → avg lifetime 10 months × ~€13.50 blended ARPU).
- **Commerce**: 10% commission on €30 AOV at 0.5 orders/user/mo = €1.50/user/mo in affiliate revenue; additional margin from Tom's own product line on top.
- **Brand partnerships (upside, not base case)**: €2K/mo per partner. Potential to scale from 2→13 partners over 12 months (~€4K–26K/mo). Unvalidated — treat as aspirational upside until first deals close.

## Go-to-market (non-viral base-case + viral upside)
- Seed with Skool + Tom's socials (low CAC), retarget quiz completers, and build SEO wedge pages ("Haartyp Test", "welches Shampoo passt zu mir").
- Viral mechanics: shareable routine/result cards + OG images + referral credit.
- **TikTok as primary content channel**: 85% of TikTok Shop best-sellers are health/beauty. Tom's content should target TikTok-native formats (scan reveals, quiz reactions, routine demos).
- **UGC engine**: design features that naturally produce shareable content — quiz results, before/after progress photos, "what's in my bathroom" shelf views, before/after, "glow-up", etc.
- **Micro-influencer partnerships**: 253% higher trust than celebrity endorsements. Build a small creator program for German haircare micro-influencers alongside Tom's own content.

## What exists / what's needed
- **Exists**: quiz flow, RAG/product engine, streaming chat, profiles, admin.
- **Needed**: Stripe/paywall + subscription management, sharing (result cards/OG), affiliate tracking, lifecycle (email/push), deterministic constraints layer.

## Key risks & mitigations
- **Churn**: solve with routine artifacts + quarterly seasonal refresh + progress/journey timeline (not "more chat").
- **Inconsistent advice**: deterministic constraints + scoring/rules layer.
- **Over-gating risk**: Hair2Hair lost users and got negative reviews by making the free tier "essentially non-functional." Mitigation: generous free tier (quiz + routine + limited chat) that builds habit before paywall.

## 12-month target (directional)
- 15k paid if trial→paid and churn are healthy; commerce scales with routine/cart adoption.

---

# PLAN 2: TomBot Pro Tier (Bundle) — add only after Plan 1 retention is proven

**One line:** A higher-priced tier bundling AI + course library + (optional) community, designed to lift retention/LTV.

## Offer
- Everything in Plan 1
- Course modules integrated into the flow ("watch → apply to your profile")
- Community and/or periodic Q&A (record-first; live only if sustainable)

## Revenue model
- **Pricing**: €24.90–29.90/mo (VAT incl.) + annual.
- **Rule**: only ship if it improves LTV more than it increases complexity/support.

## When to add
- Only after Plan 1 shows a stable retention signal (e.g. strong 60–90 day cohorts) and support load is understood.

## What's needed
- Tier gating + content delivery, community integration, upgraded lifecycle.

## Key risks
- Support/community becomes the business; Tom time creeps upward.

## 12-month target (directional)
- Not a separate "growth plan" — this is an ARPU/LTV lift on top of Plan 1.

---

# PLAN 3: Hair Concierge Freemium (general-brand growth engine; not cashflow-first)

**One line:** General brand, free tier as top-of-funnel; monetize via premium + commerce.

## Target customer
German-speaking consumers who want "what should I buy/use for my hair?" but don't care who Tom is.

## Offer
- Free: quiz + routine card + tightly bounded chat (message caps + caching).
- Paid: €9.90/mo (VAT incl.) for deeper personalization, deeper insights, unlimited/expanded chat, seasonal refresh, progress tracking.

## Go-to-market (works without virality)
- **SEO wedge pages** ("Haartyp Test", "Shampoo Beratung", ingredient explainers) + retargeting.
- Partnerships are possible later (dm/Rossmann/magazines), but don't rely on them early.

## What's needed
- Full rebrand layer (copy/design), free-tier limits/cost controls, SEO pages + CMS, general-market onboarding.

## Key risks & mitigations
- **Bootstrapped cost**: free tier burns cash → cap usage aggressively and funnel into commerce + paid.
- **Trust**: general brand starts "cold" → credibility assets, transparent sourcing, clear disclaimers/escalation.

## 12-month target (directional)
- Consider it a potential Phase 2 once TomBot cashflows; targets depend heavily on SEO velocity + CAC.

---

# PLAN 4: Hair Concierge Premium (general brand, credibility play)

**One line:** Premium-positioned expert hair advisor (no freemium), differentiated by seasonal personalization + progress tracking.

## Target customer
Quality-conscious DACH consumers who already spend meaningfully on hair care and want fewer mistakes.

## Offer
- Quiz → routine card → premium concierge chat
- Seasonal refresh + progress timeline as the retention moat

## Revenue model
- **Pricing**: trial → €10/mo (VAT incl.); add annual for retention/cashflow.
- Commerce still applies, but the story is "pay for expertise," not "free app".

## Differentiators
- Seasonal routine refresh (quarterly)
- Ingredient/product reasoning + constraints
- Progress timeline (switching costs)

## Go-to-market
- PR + credibility assets + partnerships; slower ramp without Tom's name but more independent long-term.

## What's needed
- General-brand positioning, PR kit, credibility pages, and a premium onboarding/trial that builds habit.

## Key risks
- Slower early growth (no free tier) → heavier emphasis on PR, SEO, and conversion-quality onboarding.

## 12-month target (directional)
- Fewer users than freemium, but higher willingness-to-pay; success depends on premium conversion + retention.

---

## Practical "success definition" for the first cycle:
- Trial→paid is healthy,
- retention shows a real 60–90 day signal,
- routine/cart adoption is rising (commerce doesn't require virality to work).

---

## Questions (highest leverage to harden the numbers)

1. **Skool baseline**: price, churn, engagement (weekly active, retention).
2. **Owned products**: AOV, gross margin, repeat rate, supply constraints.
3. **Affiliate reality**: partners, commission rates, tracking feasibility in DACH.
4. **Audience assets**: email/SMS list size + engagement (CAC lever).
5. **Support tolerance**: acceptable human handoff per 1,000 users.
6. **Product scanner feasibility**: how many products would we need in a barcode database to make scanning useful in DACH? What's the minimum viable product database?
7. What do we need to learn in the first 90 days? Which metrics need to be hit so we know it's worth to continue pushing.
8. (EU DPP timeline: the EU Digital Product Passport (2027+) will mandate ingredient transparency via QR codes on products. Building early support could position us as the consumer interface for this regulatory mandate.)

## Model assumptions to stress-test

Based on the back-of-envelope model (`20260225_tom_bot_modelling.xlsx`):

- **10% monthly churn** is a conservative starting point. If retention efforts (seasonal refresh, journey tracking) bring this to 7%, M12 active users jump from ~15K to ~20K+.
- **2,000 paying users in M1** is ambitious — requires a strong conversion push from Skool (~1,200 members) plus Tom's social launch driving immediate trial-to-paid.
- **20% monthly new user growth** depends on Tom maintaining an active content cadence (quiz promotion, TomBot content series, social posts). If content slows, growth compounds slower.
- **Fixed cost model** (€21.25K/mo) does not include per-user variable costs (API calls, embedding generation). At scale these are small (~€0.10–0.30/user/mo) but worth tracking.
