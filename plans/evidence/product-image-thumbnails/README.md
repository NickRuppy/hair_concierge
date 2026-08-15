# Product image thumbnail planning evidence

## Question

Can one pre-generated WebP replace the 1200x1200 canonical product image in the existing 48 CSS pixel Stage 3 search card without a meaningful visual loss, including on 3x displays?

## Decision criterion

- The thumbnail must preserve the product silhouette and recognizability in the existing card.
- It must provide up to three physical pixels per CSS pixel for common high-density mobile displays.
- The encoded payload should be materially smaller than the canonical asset.
- Generation must be deterministic from the canonical image.

## Prototype

Six public, approved catalog images covering bottles, tubes, spray cans, and jars were downloaded without modifying production. Each 1200x1200 source was auto-oriented, resized with Sharp to 144x144, and encoded as WebP at quality 80 and effort 5.

| Sample | Canonical bytes | Thumbnail bytes | Reduction |
| --- | ---: | ---: | ---: |
| Batiste spray can | 36,064 | 1,064 | 97.0% |
| Epres bottle | 16,468 | 522 | 96.8% |
| Guhl tube | 21,876 | 940 | 95.7% |
| Jean&Len jar | 28,242 | 976 | 96.5% |
| L'Oreal bottle | 30,708 | 1,276 | 95.8% |
| NEQI oil bottle | 24,566 | 1,014 | 95.9% |

See [comparison.png](./comparison.png) for the rendered side-by-side comparison. Both columns represent the same 48 CSS pixel card slot at 3x device resolution.

## Finding

Use a stored `search_thumbnail_v1` derivative with a 144x144 pixel WebP payload, quality 80, and content-addressed storage. Keep the 1200x1200 canonical image unchanged for larger presentation contexts. At 522–1,276 bytes in this sample, supporting 3x displays remains materially cheaper than the canonical files.

## Disposition

Commit this report, the comparison image, and the sample inputs/outputs as planning evidence. Implement the production generator independently with unit tests; do not promote prototype code.
