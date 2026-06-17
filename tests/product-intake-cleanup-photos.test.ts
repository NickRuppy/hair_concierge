import assert from "node:assert/strict"
import test from "node:test"

import {
  cleanupAbandonedTmpUploads,
  cleanupExpiredSubmissionPhotos,
  loadReferencedSubmissionImagePaths,
} from "../scripts/product-intake/cleanup-photos"

type PhotoRow = {
  id: string
  front_image_path: string | null
  barcode_image_path: string | null
}

type ReferencedPhotoRow = {
  front_image_path: string | null
  barcode_image_path: string | null
}

function createCleanupSupabaseFake(
  input: PhotoRow[] | { expiredRows?: PhotoRow[]; referencedRows?: ReferencedPhotoRow[] },
) {
  const expiredRows = Array.isArray(input) ? input : (input.expiredRows ?? [])
  const referencedRows = Array.isArray(input) ? [] : (input.referencedRows ?? [])
  const calls: string[] = []
  const removedPaths: string[] = []
  let nextRange: { from: number; to: number } | null = null
  let selectedColumns = ""

  return {
    calls,
    removedPaths,
    storage: {
      from(bucket: string) {
        return {
          async remove(paths: string[]) {
            calls.push(`remove:${bucket}:${paths.join(",")}`)
            removedPaths.push(...paths)
            return { error: null }
          },
        }
      },
    },
    from(table: string) {
      calls.push(`from:${table}`)
      return {
        select(columns: string) {
          selectedColumns = columns
          calls.push(`select:${columns}`)
          return this
        },
        in() {
          return this
        },
        lte() {
          return this
        },
        is(column: string, value: unknown) {
          calls.push(`is:${column}:${String(value)}`)
          return this
        },
        range(from: number, to: number) {
          nextRange = { from, to }
          calls.push(`range:${from}:${to}`)
          return this
        },
        limit(count: number) {
          nextRange = { from: 0, to: count - 1 }
          calls.push(`limit:${count}`)
          return this
        },
        async then(
          resolve: (value: { data: Array<PhotoRow | ReferencedPhotoRow>; error: null }) => unknown,
        ) {
          const rows =
            selectedColumns === "front_image_path, barcode_image_path"
              ? referencedRows
              : expiredRows
          const range = nextRange ?? { from: 0, to: rows.length - 1 }
          nextRange = null
          return resolve({ data: rows.slice(range.from, range.to + 1), error: null })
        },
        update() {
          return {
            eq(idColumn: string, id: string) {
              calls.push(`update:${idColumn}:${id}`)
              return Promise.resolve({ error: null })
            },
          }
        },
      }
    },
  }
}

function createTmpCleanupSupabaseFake() {
  const calls: string[] = []
  const removedPaths: string[] = []

  return {
    calls,
    removedPaths,
    storage: {
      from(bucket: string) {
        return {
          async list(path: string, options: { limit: number; offset: number }) {
            calls.push(`list:${bucket}:${path}:${options.offset}`)
            if (path === "tmp") {
              return { data: [{ name: "user-1" }], error: null }
            }
            if (path === "tmp/user-1") {
              return {
                data: [
                  { name: "referenced-front.jpg", updated_at: "2026-06-14T00:00:00.000Z" },
                  { name: "orphan-front.jpg", updated_at: "2026-06-14T00:00:00.000Z" },
                ],
                error: null,
              }
            }
            return { data: [], error: null }
          },
          async remove(paths: string[]) {
            calls.push(`remove:${bucket}:${paths.join(",")}`)
            removedPaths.push(...paths)
            return { error: null }
          },
        }
      },
    },
  }
}

test("expired submission photo cleanup dry-run paginates instead of rereading first full page", async () => {
  const rows = Array.from({ length: 101 }, (_, index) => ({
    id: `submission-${index}`,
    front_image_path: `user/submission-${index}/front.jpg`,
    barcode_image_path: null,
  }))
  const supabase = createCleanupSupabaseFake(rows)

  const result = await cleanupExpiredSubmissionPhotos(supabase as never, false)

  assert.deepEqual(result, { rows: 101, objects: 101 })
  assert.deepEqual(
    supabase.calls.filter((call) => call.startsWith("range:")),
    ["range:0:99", "range:100:199"],
  )
  assert.deepEqual(supabase.removedPaths, [])
  assert.equal(
    supabase.calls.some((call) => call.startsWith("update:")),
    false,
  )
})

test("abandoned tmp cleanup keeps stale tmp images referenced by active submissions", async () => {
  const pendingReferencedTmp = "tmp/user-1/referenced-front.jpg"
  const orphanTmp = "tmp/user-1/orphan-front.jpg"
  const supabase = createTmpCleanupSupabaseFake()
  const cutoff = new Date("2026-06-15T00:00:00.000Z")

  const result = await cleanupAbandonedTmpUploads(
    supabase as never,
    true,
    cutoff,
    new Set([pendingReferencedTmp]),
  )

  assert.deepEqual(supabase.removedPaths, [orphanTmp])
  assert.deepEqual(result, { objects: 1 })
})

test("referenced submission image path loader collects both image columns", async () => {
  const supabase = createCleanupSupabaseFake({
    referencedRows: [
      { front_image_path: "tmp/user-1/front.jpg", barcode_image_path: null },
      { front_image_path: null, barcode_image_path: "tmp/user-1/barcode.jpg" },
      { front_image_path: "tmp/user-1/front.jpg", barcode_image_path: null },
    ],
  })

  const paths = await loadReferencedSubmissionImagePaths(supabase as never)

  assert.deepEqual([...paths].sort(), ["tmp/user-1/barcode.jpg", "tmp/user-1/front.jpg"])
  assert.deepEqual(
    supabase.calls.filter((call) => call.startsWith("select:")),
    ["select:front_image_path, barcode_image_path"],
  )
  assert.deepEqual(
    supabase.calls.filter((call) => call.startsWith("is:")),
    ["is:photos_deleted_at:null"],
  )
  assert.deepEqual(
    supabase.calls.filter((call) => call.startsWith("range:")),
    ["range:0:99"],
  )
})
