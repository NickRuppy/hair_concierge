# OGX Stage 3 search identity completion - operator package

Status: **prepared only; no database change has been made.** This is a
catalog-quality correction package for three active OGX shampoo rows whose
Stage 3 search identity is incomplete because `product_line_id` is `NULL` and
`products.name` contains only a broad shorthand. It is not a migration and it
must not be routed through an app endpoint, intake approval command, or generic
Supabase push.

## Intended result

Stage 3 keeps the brand separately and formats the visible candidate name as:

| Product id | Brand | Line | Stored product name | Stage 3 visible name |
| --- | --- | --- | --- | --- |
| `3f3c7d89-9e7b-4e91-85f7-d3c58d304918` | `OGX` | `Thick & Full +` | `Biotin & Collagen Shampoo` | `Thick & Full + Biotin & Collagen Shampoo` |
| `bef4f219-2c1f-4e02-8e3a-93056b95465a` | `OGX` | `Strength & Length +` | `Keratin Oil Shampoo` | `Strength & Length + Keratin Oil Shampoo` |
| `7b5ec424-d21f-4eb8-999e-7aed98e94b86` | `OGX` | `Refreshing Scalp +` | `Rosemary Mint Shampoo` | `Refreshing Scalp + Rosemary Mint Shampoo` |

The SQL creates or reuses those three `product_lines` under the OGX brand, then
updates only `public.products.name` and `public.products.product_line_id` for
the three exact product IDs.

## Rationale

The product-intake identity contract says to split brand, real product line, and
clean product name, and not to let retailer title quirks decide the final split.
The current Stage 3 formatter already joins `product_line.canonical_name` with a
cleaned `products.name`, so storing the full line again inside `products.name`
would repeat words in search results and captured products.

- Biotin & Collagen: the official OGX page and current packaging identify
  `Thick & Full +` as the visible range, while `Biotin & Collagen Shampoo` is
  the recognizable saleable product. The older registry entry that treats
  `Biotin & Collagen` as the line was rejected for this package because it would
  hide the source-backed `Thick & Full +` range and leave the product as a
  generic `Shampoo`.
- Keratin Oil: the current packaging identifies `Strength & Length +` as the
  line and `Keratin Oil Shampoo` as the product. `Strength & Shine` is treated
  as a label benefit, not the product identity.
- Rosemary Mint: the current packaging identifies `Refreshing Scalp +` as the
  line and `Rosemary Mint Shampoo` as the product. The official Canadian page
  also marks the page as Extra Strength; that wording is source evidence, but
  this package does not put it in the stored identity because it is not visible
  in the current production image fingerprint supplied for the row.

## Privacy and safety boundary

`before.json` contains only catalog metadata and source URLs. It contains no
user IDs, email, raw user text, submission history, owner links, or draft
payloads. This package deliberately does not touch `user_products`,
`product_submissions`, intake artifacts, personal-plan drafts, routine state, or
history tables.

`repair.sql` and `rollback.sql` both use a single `SERIALIZABLE` transaction,
an advisory transaction lock, row locks, exact product IDs, exact current/post
names, exact OGX `brand_id`, `product_line_id IS NULL` forward guards, active
shampoo lifecycle guards, and image path fingerprints.

## Guarded runbook

1. Obtain separate explicit data-apply authorization and use a service-role or
   Postgres operator connection. This package alone is not authorization.
2. Re-read `before.json`, `repair.sql`, and this README. Confirm that the
   target line/name pairs still match the intended Stage 3 display contract.
3. Run `repair.sql` only as an operator SQL file. Do not convert it into a
   migration and do not run product-intake `--apply --confirm`.
4. Verify read-only that the three rows now join to the intended OGX product
   lines and still have `category_key='shampoo'`, `is_active=true`, and
   `lifecycle_status='active'`.
5. If the result is wrong and no further writes have occurred, run
   `rollback.sql`. If either script fails, stop and prepare a fresh package
   from a new read-only production snapshot.

No production execution, intake approval, migration, commit, push, PR, merge, or
deploy is authorized by this package.
