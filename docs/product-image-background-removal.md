# Product-Image Background Removal

Reliable, fully local pipeline for turning product packshots (JPG/WebP, any source)
into clean transparent-background PNGs (RGBA), ready for compositing onto our own
backgrounds. Battle-tested on the 20-image pilot batch (2026-06-10,
`data/product-images/pilot-2026-06-10/selected/` → `selected-nobg/`).

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
For each image:
1. Does the source already have a usable alpha channel?   → check FIRST (step 0)
   └─ yes, and it's clean on magenta                      → just convert to PNG, done
   └─ yes, but shadow is baked in (opaque, inside alpha)  → remove-baked-shadow.py (+ step 4b)
2. Flat/studio background, product not touching edges     → removebg.swift (Vision)
   └─ Vision says "no subject found" (product fills frame)→ removebg-padded.swift
3. QA on magenta. Background haze / gradient remnants?    → rembg isnet-general-use
4. Shadow remnant survives every model?                    → it's baked in → remove-baked-shadow.py
   └─ bright warm fade still left after that              → 4b: flatten on white + BiRefNet 2nd pass
```

## Step 0 — Inspect sources before running any model

Two things bit us in the pilot; both are cheap to check up front:

```bash
# Which sources already ship transparency? (brand assets often do)
python3 - <<'EOF'
from PIL import Image
import numpy as np, glob
for f in sorted(glob.glob('selected/*')):
    im = Image.open(f)
    if 'A' in im.mode:
        a = np.array(im.convert('RGBA'))[:,:,3]
        print(f, im.mode, f'transparent={(a==0).mean():.0%}')
    else:
        print(f, im.mode, '(no alpha)')
EOF
```

- **Source already >80% transparent** → it's an official brand cutout. Don't run a
  model on it (models receive the flattened RGB and re-include baked shadows).
  Work with the existing alpha instead.
- **Source has no alpha** → proceed to Vision (step 1).

## Step 1 — macOS Vision subject-lift (default, handles ~75% of images)

Zero install, runs locally, same tech as "lift subject" in Photos. Excellent on
retailer packshots (dm/Rossmann style: product on white).

```bash
swift scripts/product-images/removebg.swift <outputDir> <inputs...>
# e.g.
swift scripts/product-images/removebg.swift selected-nobg selected/*.jpg selected/*.webp
```

**Known failure:** "SKIP (no subject found)" when the product fills the frame
edge-to-edge (tight crops). Fix: pad with a white border, cut out, crop back —
that's exactly what the padded variant does:

```bash
swift scripts/product-images/removebg-padded.swift <input> <output.png>
```

## Step 2 — QA every batch on magenta (non-negotiable)

White-bg cutout flaws are invisible on a white preview. Magenta exposes
shadow remnants, background haze, and halos instantly:

```bash
swift scripts/product-images/qa-composite.swift /tmp/qa-magenta selected-nobg/*.png
# then visually inspect /tmp/qa-magenta/*.png
```

Look for: gray/beige smudges next to the product (shadow), lighter bands
(background haze), color fringes on edges. Also verify file properties:

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
product cutout as **fully opaque pixels**. Every segmentation model
(Vision, ISNet, BiRefNet, BiRefNet-DIS, BRIA) treats it as subject — trying more
models is a dead end; we tried five.

What works — `remove-baked-shadow.py`, which exploits geometry instead of color:

> Shadow = dark pixels **connected to the outer boundary** of the alpha
> silhouette. Dark label text is also dark, but it's an **interior island**
> surrounded by bright product pixels, so it survives.

```bash
/tmp/rembg-venv/bin/python3 scripts/product-images/remove-baked-shadow.py input.webp output.png
# input must have an alpha channel (the brand asset's own, or a model cutout)
```

### Step 4b — second pass for the bright shadow fade

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

## Pilot batch notes (2026-06-10)

- #05 Balea Natural Beauty keeps its coconut/hibiscus props — part of the brand
  arrangement, kept intentionally.
- #09/#10/#14 are tight crops (product fills frame) — low transparency share is
  expected, not a bug.
- Model cache `~/.u2net` was ~3GB after the pilot (birefnet-general,
  birefnet-dis, bria-rmbg, isnet). Safe to delete; re-downloads on demand.
