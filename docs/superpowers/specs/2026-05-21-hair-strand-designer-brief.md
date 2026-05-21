# Designer Brief — Hair Strand "Under the Microscope" Illustration

**Date:** 2026-05-21
**Owner:** Nick (Chaarlie)
**Project context:** v2 of the post-quiz results page on chaarlie.de (German consumer hair care product). The static v1 ships first; this asset powers the v2 interactive version.

---

## In one line

A magnified illustration of a single human hair strand — drawn in two states (stressed / healed) — that animates between them as the user drags an on-screen slider, communicating "this is what Chaarlie will change about your hair."

---

## Why this asset exists

Chaarlie sells a personalised hair care plan. After a 2-minute quiz, users land on a results page that needs to convince them to subscribe. The page already explains *what's wrong* and *what we'll fix* in words. The strand illustration replaces a static written before/after with an **interactive visual moment** — the user drags a divider across the strand and watches it transform from damaged to healthy. It's the page's hero "wow" element.

The framing is **hair-science credibility**, not playful styling. Think: Olaplex molecular bond imagery, Kérastase cross-section diagrams, Living Proof's "before/after at the strand level." This isn't an avatar; it's a clinical specimen with brand polish.

The illustration also needs to **re-deploy on product pages** (Bondbuilder, Conditioner, etc.) where similar transformation animations would explain how a single product changes the strand. Design with reuse in mind.

---

## Brand context

- **Brand:** Chaarlie. Quiet, expert, German consumer hair care. Founder is Tom — a master stylist (Friseurmeister) with 18 years of experience.
- **Primary brand colour:** Plum `#6B50A0` (mid), `#3D2A62` (dark), `#2A1845` (darkest), `#F2EEFA` (very light tint).
- **Accent:** Coral `#D4616A` (used for CTAs and a "problem" register on this page).
- **Display typeface:** Playfair Display. Sans: Plus Jakarta Sans. Mono: IBM Plex Mono.
- **Tone of the page:** confident, calm, evidence-based. Not loud, not gimmicky, not childish.
- **Page surface where this lives:** mobile-first (390 px wide on iPhone). Will also render on desktop but mobile is the priority.

---

## Visual direction

- **Style:** vector illustration, not photorealistic. Clean, slightly editorial. Detail enough to feel scientifically credible (visible cuticle scales, fibre texture, ends) but not so detailed it becomes a medical diagram.
- **Mood:** "under glass" — a clinical specimen displayed for the viewer. Soft, even lighting. No dramatic shadows. Quietly beautiful.
- **Crop:** **Full strand visible end-to-end**, running horizontally across the canvas. The strand is the hero. Around 80–90 % of the canvas width should be the strand body; the remaining margins are quiet space for an annotation label or two.
- **Orientation:** horizontal. The user will drag a vertical divider across the strand left-to-right.
- **Colour of the strand:** **monochrome for v2** — a deep, slightly warm plum-brown (`#5C3E2E` or similar warm tone — show options). One colour bracket for everyone in this version. Personalised colour-matching is a later evolution.
- **Background:** off-white / paper-cream (`#FBF8F3` page background). The strand sits on this; no card or border in the illustration itself — the surrounding UI will provide the frame.
- **Resolution-independent:** SVG. Should look perfect at 390 px width (mobile) and 760 px width (desktop max).

### References / mood board

The designer should pull at least the following for context:

- **Olaplex bond imagery** — search "Olaplex before after bond strand illustration." Note how they show molecular structure at the strand level without being literal.
- **Kérastase microscope photography** — search "Kerastase cuticle scales before after." Note the cuticle scale anatomy.
- **L'Oréal hair fibre cross-sections** — for cuticle/cortex anatomy reference.
- **Living Proof "hair strand zoom"** marketing — for the "specimen on white" aesthetic.

These are **references, not models to copy**. Chaarlie's version should be more illustrated, less photographic; warmer and quieter than the typical clinical look.

---

## The two states

### Heute (the "stressed" state)

The strand is showing the hallmarks of hair that needs help. Visually:

- **Cuticle scales:** raised, irregular, sticking out from the strand body at angles (~20–30°). Like roof shingles that have lifted in a storm. ~16–20 visible scales along the strand.
- **Surface:** rough, slightly matte. No specular highlight. Faint texture/grain across the body.
- **Colour:** the deep plum-brown but **desaturated** — muted, slightly washed out. ~25 % less saturation than the healed state.
- **Body shape:** mild irregularity. The strand is uneven in width — slight thinning in a couple of spots. Not a perfectly smooth cylinder; subtle damage variations.
- **Ends:** **split end at the right-most tip** — two diverging frayed paths instead of one sealed point. The split should be visible but not grotesque; it's a credibility signal, not a horror image.
- **Optional micro-detail:** one or two tiny "breakage gaps" along the length — interruptions in the cortex where the strand looks like it's about to break. Use sparingly; less is more.

### Ziel (the "healed" state)

The same strand, after 4 weeks of Chaarlie. Visually:

- **Cuticle scales:** flat, aligned, smooth. All scales lie down at the same angle (close to 0°). The strand reads as a continuous smooth surface.
- **Surface:** smooth, with a soft specular highlight running along the top edge — light catching on intact cuticle.
- **Colour:** the deep plum-brown at full saturation. Richer, deeper.
- **Body shape:** consistent width along the length. Smooth, cylindrical, intact.
- **Ends:** **sealed tip on the right** — the strand ends in a single clean point. A subtle "light-catch" sparkle (✦) sits at the tip — small, tasteful, present.
- **No breakage gaps.**

The Ziel state is **the same strand, healed** — not a different strand. Same length, same overall shape, same position on the canvas. Only the surface quality, scales, colour saturation, and ends change.

---

## The animation primitives

The engineering team will animate the strand using a single `revealValue` between 0 (full Heute) and 1 (full Ziel). For this to work, we need the designer to think about the strand as **parametric** between the two states, not as two unrelated drawings.

What the designer needs to deliver:

1. **Heute master SVG** — the strand in its stressed state, fully rendered, with named layers (see Format requirements below).
2. **Ziel master SVG** — the strand in its healed state, **using the same layer names, same path counts, same path ordering** as Heute. Each path in Heute must have a one-to-one counterpart in Ziel with the same name. This is critical: it's what makes SVG morphing possible.
3. **A style guide for the in-between** — a single PNG mock or short Loom showing what the strand looks like at `revealValue = 0.5` (the midpoint). Engineering will interpolate the geometry; the designer's mock is the reference for whether the interpolation looks right.

That's it. The designer does **not** need to animate. Engineering builds the animation; the designer provides the two endpoints and the visual target for the midpoint.

### Layers that will animate

The following layers need to be **separately named** in both SVGs so engineering can drive them independently:

| Layer name (suggested) | Heute appearance | Ziel appearance | Animation type |
|---|---|---|---|
| `strand-body` | Slightly uneven width, muted colour | Even width, saturated colour | Path morph + fill interpolation |
| `cuticle-scale-1` … `cuticle-scale-N` | Raised, angled | Flat, aligned | Per-scale rotation |
| `strand-highlight` | Absent or barely visible | Soft specular highlight running along top edge | Opacity 0 → 1 |
| `strand-tip` | Split, two diverging paths | Single sealed point | Path morph |
| `strand-sparkle` | Absent | Small ✦ at the tip | Opacity 0 → 1, slight scale pulse |
| `damage-spot-1`, `damage-spot-2` (optional) | Faint breakage gap | Absent | Opacity 1 → 0 |

The designer chooses how many cuticle scales to include (recommend 16–20) and names them sequentially. Engineering will animate them with a small staggered delay across the strand length so the "wave of healing" reads visually.

---

## Deliverables checklist

The designer hands off:

- [ ] **Heute master SVG** (`hair-strand-heute.svg`) with named layers
- [ ] **Ziel master SVG** (`hair-strand-ziel.svg`) with matching layer names + counts
- [ ] **Midpoint reference mock** (PNG or short Loom, ~5 sec) showing what the strand should look like at 50 % reveal
- [ ] **Source file** (Figma frame or Illustrator AI) with layers preserved, exported alongside the SVGs
- [ ] **Colour spec** — exact hex values for: strand body (Heute), strand body (Ziel), highlight, sparkle. Brand tokens are listed above as starting points; designer can refine within range.
- [ ] **One alternate colour proposal** (optional but welcome) — if the designer thinks a different strand colour reads better than plum-brown, propose one with a one-frame mock.

---

## Format / technical requirements

- **Format:** SVG. Embedded raster images are not acceptable — paths and shapes only.
- **viewBox:** the designer chooses, but recommend `0 0 760 200` (16 : 4.2 aspect ratio, suits the horizontal strand crop). Engineering will scale.
- **Layer naming:** kebab-case (`strand-body`, `cuticle-scale-3`), no spaces, no special characters. Each animated element on its own `<g>` or `<path>`. No groups merged.
- **No filters / no `<image>` tags** — these can't be reliably animated by the React engine. Use only `<path>`, `<rect>`, `<circle>`, `<polyline>`, `<linearGradient>`, `<radialGradient>` for fills.
- **No text in the SVG.** Annotation labels are rendered in HTML by the engineering team and positioned relative to the SVG. The SVG should be free of `<text>` elements.
- **File size:** under 25 KB each (gzipped) is the target. Pretty achievable for a single strand.
- **Sanitised:** no editor metadata, no `<sodipodi:*>` or `<inkscape:*>` namespaces, no comments. Run through SVGO or similar before handoff.

---

## What's out of scope (v2)

- **Per-user colour variants.** The strand is one colour for everyone in v2. Personalised colour bands are a v3 conversation.
- **Per-structure variants.** No separate strand for straight/wavy/curly/coily. The strand is universal; the structural context is communicated by HTML annotations + caption ("welliges, feines Haar") around the SVG, not by re-drawing the strand. (If we later move to structure-matched strands, that's a separate brief.)
- **3D / depth effects.** Stay flat-illustrated. No fake 3D shading.
- **Background art / decorative elements.** The strand sits on the page background. No additional flourishes.
- **Animation work.** Designer provides the two states + midpoint reference; engineering builds the animation.

---

## Timeline expectation

Rough working assumption for the brief:

- Brief acknowledged + clarifying questions: **1–2 days**
- First draft (both states + midpoint): **5–7 working days**
- Review round with Nick + Tom: **1–2 days**
- Revisions: **2–3 days**
- Final handoff: **~2 weeks total** from brief acceptance to engineering-ready SVGs

This is one focused designer's pace, not a team. If we need to compress, the trade-off is fewer review cycles, not parallel work.

---

## Questions the designer should answer before starting

The brief is intentionally tight, but these are open enough that a chat is warranted:

1. **Strand colour:** are you happy with the deep plum-brown (`#5C3E2E`), or do you want to propose an alternate that you think reads better against the page background (`#FBF8F3`)?
2. **Cuticle scale count:** the brief recommends 16–20. Confirm or push back based on what's animatable cleanly.
3. **Split end style:** do you have a strong opinion on whether the Heute tip should split into 2 paths or 3? Two is enough to read as a split; three is more dramatic.
4. **Sparkle ✦ shape:** circular highlight? Cross-hair? Custom mark? Designer's call within "tasteful, restrained, brand-on."
5. **Mid-point reference:** do you prefer to draw the 50 % frame, or would you prefer engineering to send a first interpolation pass for you to validate? Either works.

---

## Background reading for the designer

- The static v1 of the results page can be seen at `.tmp-previews/quiz-results-redesign.html` (Option B) — gives context for the surrounding card.
- The Chaarlie brand tokens live in `src/app/globals.css` if the designer wants to inspect colours directly.
- The implementation plan that the strand will eventually replace is in `plans/2026-05-21-quiz-results-transformation-card.md`.
- chaarlie.de — public site, gives a feel for the brand voice and visual register.
