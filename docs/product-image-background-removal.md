# Product-Image Background Removal

Reliable, fully local pipeline for turning product packshots (JPG/WebP/PNG/AVIF,
any source) into clean transparent-background PNGs (RGBA), ready for compositing
onto our own backgrounds. Battle-tested on 181 images across 5 batches
(2026-06-10..12: 20-image pilot + catalog batches 02–05, each
`data/product-images/<batch>/selected/` → `selected-nobg/`).

This document covers the cutout/background-removal stage only. For the full
scrape → review → cutout → final composite → manifest → Supabase publish flow,
see `docs/runbooks/product-image-pilot-runbook.md`.

Scripts live in `scripts/product-images/`:

| Script                   | Purpose                                                            |
| ------------------------ | ------------------------------------------------------------------ |
| `removebg.swift`         | Batch cutout via macOS Vision subject-lift (default path)          |
| `removebg-padded.swift`  | Fallback for frame-filling products ("no subject found")           |
| `remove-baked-shadow.py` | Removes opaque drop shadows baked into brand assets                |
| `qa-composite.swift`     | QA: composites cutouts onto magenta to expose shadow/halo remnants |

## TL;DR decision tree

```
0. Check source alpha FIRST (step 0)
   ├─ HAS alpha (any %) → composite on magenta and inspect
   │   ├─ clean                          → PNG passthrough, done (most common: dm/Rossmann assets)
   │   ├─ only ~0–5% transparent         → likely a legit edge-to-edge tight crop, NOT broken:
   │   │                                    alpha histogram ≈ 9x% at 255 + rest at 0 → passthrough
   │   └─ baked-in shadow (opaque, inside the alpha)
   │       ├─ product vividly colored    → flatten on white + BiRefNet (one command, try first)
   │       └─ product white/light        → remove-baked-shadow.py
   │           ├─ shadow touches a dark badge/label → add saturation gate (3rd arg, ~10)
   │           └─ warm fade remains on magenta      → step 4b (flatten + BiRefNet)
   └─ NO alpha (flat photo) → removebg.swift (Vision)
       ├─ "no subject found" (product fills frame)  → removebg-padded.swift
       ├─ product is a sachet/box with people in the
       │  printed artwork (Vision lifts the person!) → full-opacity passthrough instead
       └─ background haze remains on magenta         → rembg isnet-general-use

Always: QA every output on magenta (step 2) + final RGBA/dimension check.
```

## Step 0 — Inspect sources before running any model

Across the catalog batches, **most images (60–90%) already shipped usable
alpha** — the passthrough is the most common path, not the exception. Check
up front (use the rembg venv python; system python3 has no PIL):

```bash
# Which sources already ship transparency? (brand + dm/Rossmann assets usually do)
/tmp/rembg-venv/bin/python3 - <<'EOF'
from PIL import Image
import numpy as np, glob
for f in sorted(glob.glob('selected/*')):
    im = Image.open(f)
    if 'A' in im.mode or im.mode == 'P':
        a = np.array(im.convert('RGBA'))[:,:,3]
        print(f, im.mode, f'transparent={(a==0).mean():.1%}')
    else:
        print(f, im.mode, '(no alpha)')
EOF
```

Interpreting the numbers — the % is only a hint; the magenta composite
(step 2) is the real test:

- **Any transparency at all** → composite on magenta and look. Clean → convert
  to RGBA PNG, done. Never run a model on a source with good alpha: models see
  the flattened RGB and re-include baked shadows (pilot lesson).
- **~0–5% transparent** → usually a legit edge-to-edge tight crop (dm strip
  images), not broken alpha. Confirm via histogram: ~9x% of pixels at alpha 255
  + remainder at 0 = fine. Don't "fix" it.
- **`P` (palette) mode with 0% transparent** → treat as flat, go to Vision.
- **No alpha** → Vision (step 1). AVIF/WebP/JPG/PNG all work as Vision input.

## Step 1 — macOS Vision subject-lift (default for flat sources)

Zero install, runs locally, same tech as "lift subject" in Photos. Excellent on
retailer packshots (product on white/studio background) — 52/52 clean across
catalog batches 2–5, including AVIF sources.

```bash
swift scripts/product-images/removebg.swift <outputDir> <inputs...>
# e.g.
swift scripts/product-images/removebg.swift selected-nobg selected/*.jpg selected/*.webp
```

**Known failure 1:** "SKIP (no subject found)" when the product fills the frame
edge-to-edge (tight crops). Fix: pad with a white border, cut out, crop back —
that's exactly what the padded variant does:

```bash
swift scripts/product-images/removebg-padded.swift <input> <output.png>
```

**Known failure 2 — sachet/box artwork (silent, caught only in QA):** flat
packets/boxes whose printed artwork features a person make Vision lift the
*person out of the packaging art* — padded variant too (batch 3 #44
Schaebens). If the product is the full rectangle, the correct output is a
full-opacity passthrough of the source, not segmentation.

## Step 2 — QA every batch on magenta (non-negotiable)

White-bg cutout flaws are invisible on a white preview. Magenta exposes
shadow remnants, background haze, and halos instantly:

```bash
swift scripts/product-images/qa-composite.swift /tmp/qa-magenta selected-nobg/*.png
# then visually inspect /tmp/qa-magenta/*.png
```

For batches, contact sheets beat per-image files: PIL grid of 8 images per
sheet at ~420px cells, magenta background, image number in the corner. Big
enough to spot shadows, few enough files to actually look at all of them.

Look for: gray/beige smudges next to the product (shadow), lighter bands
(background haze), color fringes on edges. **Zoom suspicious bases/edges at
full resolution** — batch 2's badge-eating looked like a generic gash at
sheet scale. Also verify file properties:

```bash
python3 -c "
from PIL import Image
import glob
for f in sorted(glob.glob('selected-nobg/*.png')):
    im = Image.open(f)
    assert im.mode == 'RGBA', f'{f}: {im.mode}'  # 'P' = palette = degraded, redo
print('all RGBA ok')"
```

## Step 3 — rembg for images Vision gets wrong

Setup (one-time; models cache in `~/.u2net`, ~180MB–1GB each):

```bash
brew install python@3.13
python3.13 -m venv /tmp/rembg-venv
/tmp/rembg-venv/bin/pip install "rembg[cpu,cli]" scipy
```

Use `isnet-general-use` for background haze/gradients that Vision included:

```bash
/tmp/rembg-venv/bin/rembg i -m isnet-general-use input.webp output.png
```

⚠️ Do **not** use the npm package `@imgly/background-removal-node` for final
output — it writes palette-mode PNGs (256 colors, quantized alpha). rembg
writes proper RGBA.

## Step 4 — Baked-in shadows (the hard case)

Some brand assets (Olaplex, epres in the pilot) bake the drop shadow into the
product cutout as **fully opaque pixels**. For WHITE/light products, every
segmentation model (Vision, ISNet, BiRefNet, BiRefNet-DIS, BRIA) treats the
shadow as subject — trying more models is a dead end; we tried five.

**Exception — strongly colored products:** if the product is vividly colored
(catalog batch 3 #34, yellow Olaplex No.7 oil), BiRefNet on the flattened
image separates the gray shadow cleanly — try that FIRST, it's one command.
The geometric script can be unusable there anyway: a dark product body (amber
oil, lum < 185) merges with the shadow into one boundary-connected component.

What works — `remove-baked-shadow.py`, which exploits geometry instead of color:

> Shadow = dark pixels **connected to the outer boundary** of the alpha
> silhouette. Dark label text is also dark, but it's an **interior island**
> surrounded by bright product pixels, so it survives.

```bash
/tmp/rembg-venv/bin/python3 scripts/product-images/remove-baked-shadow.py input.webp output.png
# input must have an alpha channel (the brand asset's own, or a model cutout)
```

### When the shadow touches a dark product feature

If a dark badge/label sits at the silhouette edge AND the shadow runs along
that edge (catalog batch 2 #39: full-height side shadow + bronze badge), the
badge and shadow merge into one boundary-connected dark component and the
badge gets eaten. The discriminator is **saturation**: cast shadows are
warm-tinted (sat = max(rgb)−min(rgb) ≈ 14–20) while product darks are
neutral (sat ≤ 6). Verify per image, then pass the gate as a third arg:

```bash
/tmp/rembg-venv/bin/python3 scripts/product-images/remove-baked-shadow.py input.webp output.png 10
```

**Debug technique:** render a removal overlay — removed pixels in red on the
grayscale source — to see exactly what the script classified as shadow. This
is how the badge-eating was found; the magenta composite alone made it look
like a generic gash.

### Step 4b — second pass for the bright shadow fade (only if needed)

First check the de-shadowed result on magenta — the fade-dilation inside the
script often catches everything, and the second pass is not free: on catalog
batch 2 #39, BiRefNet cut a wedge out of the bottle's badge. Only run it when
a visible warm fade actually remains (pilot #16/#18–20 needed it).

The luminance threshold misses the brightest part of the shadow fade (warm
beige, lum > 185). Fix: flatten the de-shadowed result onto white, then run
BiRefNet — with the dark shadow core gone, the model now drops the faint rest:

```bash
python3 - <<'EOF'
from PIL import Image
im = Image.open('deshadowed.png').convert('RGBA')
bg = Image.new('RGBA', im.size, (255,255,255,255))
Image.alpha_composite(bg, im).convert('RGB').save('deshadowed-white.png')
EOF
/tmp/rembg-venv/bin/rembg i -m birefnet-general deshadowed-white.png final.png
```

Then re-QA on magenta (step 2).

### Dead end to avoid

Growing the shadow region through _warm-tinted_ (r−b) pixels sounds clever but
**eats translucent bottle parts** (caps/necks show the warm background through
them). Don't refine in that direction; the flatten-white + BiRefNet second pass
is the working answer.

## Final check before handoff

1. File count matches source count
2. All outputs `RGBA` mode, dimensions identical to source
3. Contact sheet on a beige/colored background for one last eyeball:
   every product clean, no smudges, label text intact

## Catalog batch 5 notes (2026-06-12, `catalog-2026-06-10-05/`)

- 11 images: 7 alpha passthroughs (dry-shampoo cans), 4 Vision cutouts incl.
  AVIF sources — zero failures.
- #09 was an Olaplex but as a flat retailer photo, not a brand asset — Vision
  excluded the photo shadow naturally. The baked-shadow problem is specific
  to Olaplex's official transparent brand assets.

## Catalog batch 4 notes (2026-06-12, `catalog-2026-06-10-04/`)

- 50 images, the easy case: 44 clean alpha passthroughs (dm/Rossmann-style
  assets), 6 Vision cutouts, zero failures, no baked shadows. No new lessons.

## Catalog batch 3 notes (2026-06-11, `catalog-2026-06-10-03/`)

- 50 images: 26 clean alpha passthroughs, 23 Vision cutouts (zero failures),
  1 baked shadow (#34 Olaplex No.7).
- #34: geometric deshadow unusable (dark amber oil body merges with the
  shadow; saturation ranges overlap). Plain BiRefNet on the flattened image
  worked — vivid yellow vs gray shadow is exactly what models separate well.
- **Sachet/box artwork trap (#44 Schaebens):** flat packets whose printed
  artwork features a person fool Vision — it lifts the person out of the
  packaging art (padded variant too). If the product is the full rectangle,
  the fix is a full-opacity passthrough, not segmentation. Same family as
  batch 2's #15 Gliss box / #19 HASK sachet.

## Catalog batch 2 notes (2026-06-11, `catalog-2026-06-10-02/`)

- 50 images: 30 already-clean brand cutouts (PNG passthrough), 19 Vision
  cutouts (zero failures, no padding needed), 1 baked shadow (#39 Olaplex
  No.6).
- #39 needed the saturation gate (`min_sat=10`) — full-height side shadow
  touching the bronze BOND SMOOTHER badge; no BiRefNet second pass.
- Tight crops with ~1% transparency (#09, #41) are legit edge-to-edge
  product crops, not broken alpha — check the alpha histogram (98% at 255,
  rest at 0) and composite on magenta before "fixing" anything.

## Pilot batch notes (2026-06-10)

- #05 Balea Natural Beauty keeps its coconut/hibiscus props — part of the brand
  arrangement, kept intentionally.
- #09/#10/#14 are tight crops (product fills frame) — low transparency share is
  expected, not a bug.
- Model cache `~/.u2net` was ~3GB after the pilot (birefnet-general,
  birefnet-dis, bria-rmbg, isnet). Safe to delete; re-downloads on demand.
