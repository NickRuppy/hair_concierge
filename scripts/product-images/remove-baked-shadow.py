"""Remove baked-in drop shadows from product cutouts with alpha channels.

Shadow = dark, desaturated pixels connected to the OUTER boundary of the
alpha silhouette. Label text/badges are dark too, but they are interior
islands fully surrounded by bright product pixels, so they survive.
"""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage

DARK_LUM = 185        # core shadow luminance
FADE_LUM = 238        # anti-aliased shadow fade
FADE_RADIUS = 4       # how far the fade-extension may grow from core shadow

def deshadow(src_path, out_path):
    im = Image.open(src_path).convert('RGBA')
    arr = np.array(im)
    rgb = arr[:, :, :3].astype(float)
    alpha = arr[:, :, 3].astype(float)

    lum = rgb @ [0.299, 0.587, 0.114]
    mask = alpha > 0

    # outer boundary of the silhouette
    outside = ~mask
    boundary = ndimage.binary_dilation(outside, iterations=2) & mask

    # core shadow: dark pixels connected to the boundary
    dark = (lum < DARK_LUM) & mask
    labels, n = ndimage.label(dark)
    touching = np.unique(labels[boundary & dark])
    touching = touching[touching > 0]
    shadow = np.isin(labels, touching)

    # extend into the anti-aliased fade around the core shadow
    fade = (lum < FADE_LUM) & mask
    shadow = ndimage.binary_dilation(shadow, mask=fade, iterations=FADE_RADIUS)

    # also kill remaining semi-transparent fringe touching the shadow
    semi = (alpha < 250) & mask
    shadow = ndimage.binary_dilation(shadow, mask=semi, iterations=FADE_RADIUS)

    new_alpha = alpha.copy()
    new_alpha[shadow] = 0

    # feather only around the cut: soften the new hard edge
    cut_zone = ndimage.binary_dilation(shadow, iterations=3) & ~shadow
    blurred = ndimage.gaussian_filter(new_alpha, sigma=1.2)
    new_alpha[cut_zone] = blurred[cut_zone]

    out = arr.copy()
    out[:, :, 3] = np.clip(new_alpha, 0, 255).astype(np.uint8)
    Image.fromarray(out).save(out_path)
    removed = shadow.sum() / mask.sum()
    print(f"OK: {out_path.split('/')[-1]}  (removed {removed:.1%} of silhouette)")

if __name__ == '__main__':
    deshadow(sys.argv[1], sys.argv[2])
