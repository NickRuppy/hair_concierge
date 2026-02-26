# Product Strategy: Value Proposition & Feature Prioritization

> **Decisions locked**: TomBot branding. Shareable card = priority #1. Free tier = unlimited quiz + diagnosis, zero chat (all chat is premium). Routine tracker included in MVP.

## Context

Tom has 1.5M DACH followers, a paid Skool community (~1,200 members), a published book, course library, and his own product line. The Hair Concierge app already has a working quiz, profile-aware AI chat with Tom's personality (RAG pipeline), product recommendations with scoring, and an admin panel. What's missing: sharing, paywall enforcement, routine tracking, and scanner. This analysis determines the strongest value proposition and which features justify building.

---

## Competitive Landscape (Deep Research)

### Feature Matrix

| Capability | Hair2Hair | Yuka | OnSkin | SkinSort | Picky | FeelinMySkin | **Us (today)** |
|---|---|---|---|---|---|---|---|
| Scanning (barcode/photo) | -- | **Core** (73M users) | Yes | -- | Yes | -- | -- |
| Personalization (profile recs) | Quiz + selfie | Basic | Quiz + match score | -- | Quiz + match | Basic | **Yes** (quiz + RAG) |
| Expert voice / methodology | Influencer tips | -- | AI cosmetologist | -- | -- | -- | **Yes** (Tom's KB) |
| Conversational AI | -- | -- | Paywalled | -- | -- | -- | **Yes** (streaming) |
| Product match scores | Yes | Rating | Skin Match | Dupe finder | Picky Match | -- | **Yes** |
| Routine tracking | **Yes** (wash day) | -- | AM/PM routines | Routine builder | -- | **Yes** (diary) | -- |
| Community/reviews | -- | -- | -- | Reviews + dupes | Reviews + coins | Before/after | -- |
| Commerce | Affiliate | None | Affiliate | Affiliate | Coins | -- | Product DB |
| Sharing/viral | Limited | Scan result | Limited | Dupe comparisons | Reviews | Before/after | **None** |
| German language | -- | Yes (multi) | -- | -- | -- | -- | **Monopoly** |

### Key Competitor Insights

**Hair2Hair** (~50K users, Audrey Victoria 8M followers)
- Only dedicated haircare app globally. Quiz + selfie analysis + wash day tracker + ingredient breakdown
- Biggest mistake: over-gated free tier → negative reviews, had to backtrack
- Routine tracker is their strongest retention feature
- Revenue: subscription + lifetime purchase

**Yuka** (73M users, $7M revenue, profitable)
- Zero marketing spend. Growth 100% word-of-mouth + viral TikTok (20K US downloads/day)
- Independence = trust (no ads, no brand money, no affiliate revenue)
- Lesson: viral growth from a single shareable action (scan → see rating → screenshot → share)
- Premium $20/mo for search + personalized recs

**OnSkin** (~200K downloads/mo, ~$200K/mo revenue, Webby winner)
- Skin quiz → "Skin Match" percentage on every product
- Premium: ~$46/yr, gates AI cosmetologist + unlimited scans
- Lesson: per-product match score IS the engagement mechanic

**SkinSort** (19K+ product DB, 3.3M+ dupes)
- Mostly free; premium = ad-free + unlimited comparisons
- Dupe finder is viral + commerce-driving
- Lesson: comparison tools create shareable, high-value content

### White Space

**Nobody combines: trusted expert methodology + conversational AI + personalization.** Not in any language. Certainly not in German. The intersection of "expert voice" and "AI chat" is completely unoccupied.

---

## Recommended Value Proposition

> **"Tom kennt dein Haar. Frag ihn alles."**
> *(Tom knows your hair. Ask him anything.)*

The specific promise: Tom's expertise — previously only accessible through courses (hundreds of euros) or Skool membership — personalized to YOUR hair, available 24/7, for €10/mo.

### Why this wins

1. **Not competing against apps — competing against confusion.** The real alternative is "no expert access." Users waste money on wrong products and follow contradictory social media advice.
2. **Trust is pre-built.** Tom has 1.5M followers who already trust him. Hair2Hair's Audrey is a content creator; Tom is a methodologist with a book and courses.
3. **Zero competition in DACH.** There is literally no German-language AI hair care app.
4. **Expert reasoning is the moat.** Every competitor gives scores/ratings. Only Tom explains *why* — "Das passt zu deinem Haar, weil es leichte Feuchtigkeit gibt ohne zu beschweren."

---

## Brand Recommendation: TomBot

**TomBot wins over "Hair Concierge" for launch.** Reasoning:

| Factor | TomBot | Hair Concierge |
|---|---|---|
| Trust at launch | Pre-built (1.5M followers) | Zero, must earn |
| Distribution | Every Tom post = marketing | Needs paid acquisition / SEO |
| User acquisition cost | Near-zero (organic) | High (cold audience) |
| Memorability | "Hast du den TomBot probiert?" | Generic |
| TAM concern | 1.5M accessible followers > "everyone" theoretically | Bigger TAM on paper, harder to reach |
| Exit/rebrand | Can rebrand after PMF | -- |

Hybrid option: **"TomBot" as product name, "Hair Concierge" as company/platform name** for future optionality.

---

## Feature Prioritization

### Launch-Critical (before first paying user)

| # | Feature | Status | Why critical |
|---|---|---|---|
| 1 | **Shareable Hair Diagnosis Card** | NOT BUILT | **PRIORITY #1.** Growth engine. Without it, growth = only Tom manually promoting. See "Viral Mechanic" below. |
| 2 | **Rich quiz result ("Tom's Diagnosis")** | PARTIAL | Transform quiz output from "data stored" to "first wow moment." Tom-voice paragraph explaining their hair. This IS the shareable card content. |
| 3 | **Paywall: quiz free, all chat premium** | SCHEMA ONLY | Clean separation: quiz + diagnosis card = free forever (growth). Any chat with Tom = subscription. No message counting needed. |
| 4 | **Simple routine tracker** | NOT BUILT | Retention-critical. Hair2Hair's strongest feature. Log wash days, track products used. Creates switching costs + engagement between chats. |
| 5 | **Chat personality polish** | BUILT, REFINE | Must feel like Tom, not generic AI. Proactive profile references ("Du hast ja feines Haar — da würde ich..."). |
| 6 | **Product recs with Tom's reasoning** | BUILT, REFINE | "Why" differentiates from algorithmic matching. Every rec needs Tom's rationale, not just a score. |

### Post-Launch (months 1-3)

| # | Feature | Status | Why |
|---|---|---|---|
| 7 | **Quick-ask prompt buttons** | NOT BUILT | Reduces blank-page anxiety. Pre-written Qs: "Welches Shampoo?", "Wie oft waschen?", "Warum trockene Spitzen?" |
| 8 | **Tom-generated routine card** | NOT BUILT | Tom generates a weekly routine from profile + chat. Persistent artifact, not buried in chat history. |
| 9 | **Seasonal refresh push** | NOT BUILT | "Tom sagt: Im Winter braucht dein Haar mehr Feuchtigkeit." Brings users back without them thinking of a question. |
| 10 | **Product update alerts** | NOT BUILT | New products added → notify relevant users. Ongoing subscription value. |

### Do NOT Build (at least not now)

| Feature | Why skip |
|---|---|
| **Barcode scanner** | Yuka owns this (73M users). Different product paradigm ("evaluate what's in front of me" vs "tell me what to use"). Enormous DB maintenance. |
| **Photo-based hair analysis** | Technically complex, accuracy questionable. Tom's method works through understanding properties (quiz), not computer vision. |
| **Community features** | Tom already has Skool (1,200 paying members). App community would cannibalize it + create moderation burden. |
| **Dupe finder** | Requires thousands of German-market products with ingredient data. SkinSort has 19K+. ROI doesn't justify for solo dev. |
| **Gamification / points** | Retention mechanic for products that lack inherent value. Tom's advice IS the value. |
| **Ingredient breakdown tool** | Needs comprehensive ingredient DB + safety assessments + liability exposure. Maybe later as "Tom erklärt die Inhaltsstoffe." |

---

## The Viral Mechanic: Shareable Hair Diagnosis Card

This is the single most important growth feature. Modeled on Yuka's scan-and-share loop.

### What it looks like
Instagram Story format (1080x1920), generated after quiz completion:

```
┌──────────────────────────────┐
│       [TomBot Logo]          │
│                              │
│    Dein Haar-Profil          │
│                              │
│   Wellig · Fein · Trocken   │
│   [visual icons/badges]      │
│                              │
│   Tom sagt:                  │
│   "Dein Haar braucht leichte │
│   Feuchtigkeit ohne          │
│   Beschwerung. Finger weg    │
│   von Silikonen!"            │
│                              │
│   ┌────────────┐             │
│   │  QR Code   │             │
│   └────────────┘             │
│   Was sagt Tom zu            │
│   DEINEM Haar?               │
│   tombot.de/quiz             │
└──────────────────────────────┘
```

### Why it works
1. **Identity expression** — hair type as identity (like zodiac/MBTI). People share things about themselves.
2. **Tom's voice creates curiosity** — personalized quote from Tom, not generic labels. Viewer thinks: "What would Tom say about MY hair?"
3. **Low friction** — 7-question quiz, <2 minutes, web-based (no app download).
4. **Natural sharing context** — hair discussions happen constantly in friend groups, DMs, TikTok comments.
5. **Tom amplifies** — Tom shares his own card, reacts to follower cards, creates content around profiles. Each drives quiz completions.

### The growth loop
Tom posts content → Follower takes quiz → Gets shareable card → Posts to Story → Friends take quiz → Loop repeats. Each node generates its own shareable artifact without Tom doing anything.

---

## Decisions Made

1. **Brand**: TomBot. Lead with Tom's name and trust. Fastest path to PMF.
2. **Free tier**: Unlimited quiz + diagnosis card = free forever (growth engine). All chat with Tom = premium subscription. Clean, no message counting.
3. **Priority**: Shareable hair diagnosis card is #1 build priority.
4. **Scanner**: Skip. Yuka owns this space.
5. **Routine tracker**: Included in MVP launch features (not deferred to month 2-3).
6. **Skip list confirmed**: No scanner, no photo analysis, no community, no dupe finder, no gamification, no ingredient tool.

---

## Build Sequence (Recommended)

1. **Shareable Hair Diagnosis Card** — quiz result → beautiful card with Tom's personalized quote → 1-tap share to Stories/WhatsApp → QR/link back to quiz
2. **Rich Quiz Result Page** — the "Tom's Diagnosis" experience that feeds the card. AI-generated Tom-voice summary, not just data labels.
3. **Paywall (Stripe + subscription gating)** — quiz = free, chat = premium. Implement Stripe checkout, subscription management, gate chat route.
4. **Routine Tracker (simple)** — log wash days, track which products used at each step, build a personal hair diary over time.
5. **Chat refinements** — personality polish, quick-ask buttons, proactive profile references.
