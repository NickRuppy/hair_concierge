# Built-in viewfinder image edits — 2026-09-13

Mode: built-in image_gen, two independent precise-object-edit calls; one 1024 × 1536 PNG output each.

Delivery: public/images/funnels/scan/regal-scan-flasche.png and public/images/funnels/scan/bad-ablage.png. Existing WebP files unchanged for Claude to convert.

Visual QA: both show camera viewfinder only, with no verdict card, Passt headline, table, or added full-width top band. Camera screenshot fitted visually; exact source-pixel preservation is not established.

Strict acceptance NOT met: pixel comparison detected changes outside the phone display. In two test regions entirely outside the phone (top 250 rows and rows 1000–1535), 787685/804864 pixels differ for regal-scan-flasche and 793773/804864 differ for bad-ablage. These counts detect any channel difference; they do not measure perceptual severity. Do not describe these outputs as pixel-identical outside the display. Exact preservation would require deterministic screen compositing, which was not performed because built-in image_gen was the requested mode.

## regal-scan-flasche

Source photo: `/private/tmp/claude-501/-Users-nick-AI-work-hair-conscierge/8ac2e4e1-3839-49d1-b03f-7ecf1a39bda4/scratchpad/chatgpt/regal-scan-flasche.png`

Mode: precise-object-edit. One localized screen replacement, one output, 1024 x 1536 portrait PNG.
Input image 1 is the photograph edit target. Input image 2 is screen-kamera.png, the exact 750 x 1514 scanner-viewfinder screenshot to insert.
Replace ONLY the entire app content inside the smartphone display with input image 2, fitted edge to edge inside the display in the phone's EXISTING perspective and tilt, retaining the same screen glow and subtle reflection. Treat image 2 as an image insert, not inspiration: do not redraw, crop, translate, retype, reflow or alter the screenshot. Its German text stays exactly as supplied, including "Barcode in den Rahmen halten" and the bottom product chips. The viewfinder and bottle silhouette must remain as shown in input image 2.
Remove ALL former verdict content from the display: no result card, no "Passt" headline, no comparison table, no alternatives, no Kaufen or Hinzufügen buttons. Only the supplied camera viewfinder screenshot appears on the screen.
No added black band at the top: the screenshot fills the complete display from the top inner edge to the bottom inner edge, with no letterboxing, no separate black header strip; preserve only existing physical bezel/camera hardware. The screenshot's continuous dark camera background is intentional.
Everything outside the display MUST stay pixel-identical to image 1: phone shape, bezel and placement, both hands, lilac sleeve, white shampoo bottle and its barcode, drugstore shelf, lighting, framing and colors. Preserve the original pixels outside the screen. Do not regenerate, retouch, sharpen, smooth, recolor or shift any part of the photo outside the display. No new text, no logos, no watermark.

## bad-ablage

Source photo: `/private/tmp/claude-501/-Users-nick-AI-work-hair-conscierge/8ac2e4e1-3839-49d1-b03f-7ecf1a39bda4/scratchpad/chatgpt/bad-ablage.png`

Mode: precise-object-edit. One localized screen replacement, one output, 1024 x 1536 portrait PNG.
Input image 1 is the photograph edit target. Input image 2 is screen-kamera.png, the exact 750 x 1514 scanner-viewfinder screenshot to insert.
Replace ONLY the entire app content inside the smartphone display with input image 2, fitted edge to edge inside the display in the phone's EXISTING perspective and tilt, retaining the same screen glow and subtle reflection. Treat image 2 as an image insert, not inspiration: do not redraw, crop, translate, retype, reflow or alter the screenshot. Its German text stays exactly as supplied, including "Barcode in den Rahmen halten" and the bottom product chips. The viewfinder and bottle silhouette must remain as shown in input image 2.
Remove ALL former verdict content from the display: no result card, no "Passt" headline, no comparison table, no alternatives, no Kaufen or Hinzufügen buttons. Only the supplied camera viewfinder screenshot appears on the screen.
No added black band at the top: the screenshot fills the complete display from the top inner edge to the bottom inner edge, with no letterboxing, no separate black header strip; preserve only existing physical bezel/camera hardware. The screenshot's continuous dark camera background is intentional.
Everything outside the display MUST stay pixel-identical to image 1: phone shape, thin bezel and small camera cutout, placement, both hands, lilac bathrobe, white bottle and barcode, sink, faucet, plants, all bathroom objects, lighting, framing and colors. Preserve the original pixels outside the screen. Do not regenerate, retouch, sharpen, smooth, recolor or shift any part of the photo outside the display. No new text, no logos, no watermark.
