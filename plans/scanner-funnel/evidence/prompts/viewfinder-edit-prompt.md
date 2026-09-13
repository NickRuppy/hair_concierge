# Einfügung 2 + 3: Handy-Screen → Kamera-Sucher

Mode: built-in image_gen, use case precise-object-edit. Two independent edits, one output each.
Attachment for both: `screen-kamera.png` (750 × 1514, the scanner viewfinder). Keep 1024 × 1536 portrait.

Why: the overlay card on these inserts reacts to the user's quiz answer, so the phone in the photo must not show a verdict of its own. Only the camera viewfinder may be on the screen.

## Edit A — `regal-scan-flasche.png` → output `regal-scan-flasche-v2.png`

Input image 1 is the edit target (over-the-shoulder drugstore shot, phone held above a white shampoo bottle). Make ONE localized change: replace the entire app content on the smartphone display with the attached screenshot (camera viewfinder), fitted edge to edge inside the display, in the phone's existing perspective and tilt, with the same screen glow and reflection. Do not redraw, crop, translate, retype or alter the screenshot; its German text stays exactly as it is. Everything outside the display stays unchanged: phone shape, bezel and placement, both hands, lilac sleeve, the bottle and its barcode, shelf, lighting, framing and colors. No new text, no logos, no watermark.

## Edit B — `bad-ablage.png` → output `bad-ablage-v2.png`

Input image 1 is the edit target (bright bathroom, lilac bathrobe, phone held frontal next to a white bottle). Make ONE localized change: replace the entire app content on the smartphone display with the attached screenshot (camera viewfinder), fitted edge to edge inside the display, in the phone's existing perspective, with the same screen glow and reflection. Do not redraw, crop, translate, retype or alter the screenshot; its German text stays exactly as it is. Everything outside the display stays unchanged: phone shape, bezel and placement, both hands, bathrobe, the bottle and its barcode, sink, faucet, plants, bathroom objects, lighting, framing and colors. No new text, no logos, no watermark.

## Acceptance

- The screen shows only the viewfinder frame over the bottle, no result card, no "Passt" headline, no table.
- No black band at the top of the display (see the v4 fix for bad-ablage).
- Hands, bottle and background pixel-identical to the input.

Delivery: drop both outputs as PNG into `public/images/funnels/scan/` under the ORIGINAL names (`regal-scan-flasche.png`, `bad-ablage.png`); Claude converts them to webp and replaces the current files.
