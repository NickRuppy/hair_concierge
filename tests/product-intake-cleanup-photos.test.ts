import assert from "node:assert/strict"
import test from "node:test"

import { cleanupExpiredSubmissionPhotos } from "../scripts/product-intake/cleanup-photos"

type PhotoRow = {
  id: string
  front_image_path: string | null
  barcode_image_path: string | null
}

function createCleanupSupabaseFake(rows: PhotoRow[]) {
  const calls: string[] = []
  const removedPaths: string[] = []
  let nextRange: { from: number; to: number } | null = null

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
        select() {
          return this
        },
        in() {
          return this
        },
        lte() {
          return this
        },
        is() {
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
        async then(resolve: (value: { data: PhotoRow[]; error: null }) => unknown) {
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
