# OGX Renewing canonical merge — operator package

Status: **prepared only; no database change has been made.** This is the lean
one-off repair selected for one known duplicate. It is not a migration and it
must never be sent through a browser/API route.

## Intended result

- Canonical: `2ecd3c9d-90f6-45a3-a72c-daefed50be10`
- Duplicate/tombstone: `f41badc9-16e3-41c1-ab6c-23541fffade0`
- Canonical stored name: `OGX Renewing + Argan Oil of Morocco Shampoo`
- Canonical shampoo authority: `normal / normal / balanced / gentle`
- The duplicate becomes inactive/discontinued, remains `user_submitted` for
  provenance, and records `replaced_by` the canonical row.

The forward operator moves the four duplicate identifiers, two matched owner
links, one approved submission pointer, and every active Stage 3 draft
reference enumerated by the fresh preflight. It deliberately removes the
duplicate's three `regular` specs;
they are not authority for the canonical product. The `user_products` update
uses the established trigger, so affected Personal Plans receive a monotonic
source revision/outbox change.

## Privacy boundary

`before.json` contains no user IDs, email, conversation, or raw user-entered
text. `preflight.sql` exposes only catalog fields and SHA-256 hashes of internal
row UUIDs. Catalog identifiers are retained because they are product metadata,
not personal data.

The repository has the enumerated dependency counts, but not a fresh immutable
preflight fingerprint, complete redacted before-image, nor row-id hashes.
Therefore the operator constants are
intentionally `NULL` and both `merge.sql` and `rollback.sql` fail before any
DML. Do not replace them from memory or a stale terminal transcript.

## Guarded runbook

1. Obtain the separate explicit data-apply authorization and use a
   service-role/Postgres operator connection.
2. Run `preflight.sql` read-only. Compare every count/authority field to
   `before.json`; if any differ, stop and create a new repair plan.
3. Copy only the returned privacy-safe capture fields into `before.json` and
   the four forward constants. Record the before-image file hash with:

   ```sh
   shasum -a 256 before.json
   ```

4. Copy the complete `body` value into the forward `v_before_image` constant
   and its SHA-256 into `v_snapshot_fingerprint`; copy the exact hash arrays
   into their named constants. The capture enumerates every matching duplicate UUID
   string in each active Stage 3 draft and permits only
   `products[*].identity.productId`; any other occurrence hard-stops the repair.
   The approved submission's `user_product_id` linkage is captured too: a linked
   owner is updated by the submission trigger, never by the direct owner-link
   update, so each affected source revision/outbox increment occurs exactly once.
   Review the diff. The forward script must still
   have one `BEGIN ... SERIALIZABLE` transaction, advisory/row locks, and no
   unresolved `NULL` constants.
5. Run `merge.sql` once. A retry is not idempotent: any postcondition drift is
   intentionally a hard stop. Run the read-only verification queries below.
6. There is no automatic rollback. For a verified defect, stop and create a
   fresh compensating-recovery plan from a new read-only snapshot. The
   `rollback.sql` file is an intentional hard stop: source/draft revisions are
   monotonic and this privacy-safe package does not retain a sufficient mutable
   production before-image to reverse them faithfully.

## Post-apply verification (read-only)

```sql
SELECT id, name, origin, is_active, lifecycle_status, is_chaarlie_recommended
FROM public.products
WHERE id IN (
  '2ecd3c9d-90f6-45a3-a72c-daefed50be10',
  'f41badc9-16e3-41c1-ab6c-23541fffade0'
)
ORDER BY id;

SELECT product_id, count(*) AS identifiers
FROM public.product_identifiers
WHERE product_id IN (
  '2ecd3c9d-90f6-45a3-a72c-daefed50be10',
  'f41badc9-16e3-41c1-ab6c-23541fffade0'
)
GROUP BY product_id;

SELECT product_id, thickness, shampoo_bucket, scalp_route, cleansing_intensity
FROM public.product_shampoo_specs
WHERE product_id IN (
  '2ecd3c9d-90f6-45a3-a72c-daefed50be10',
  'f41badc9-16e3-41c1-ab6c-23541fffade0'
)
ORDER BY product_id, thickness, shampoo_bucket;

SELECT count(*) AS remaining_duplicate_owner_links
FROM public.user_products
WHERE catalog_product_id = 'f41badc9-16e3-41c1-ab6c-23541fffade0'
  AND identity_status = 'matched'
  AND ownership_status = 'owned';
```

No production execution, migration, intake approval, commit, push, or deploy
is authorized by this package.
