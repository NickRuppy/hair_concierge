import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"

import type { DismissedSuggestionRow } from "../src/lib/routines/dismissals"

const migrationName = "20260706130000_dismissed_suggestions.sql"
const migrationPath = join(process.cwd(), "supabase", "migrations", migrationName)

function readNormalizedMigrationSql() {
  assert.ok(existsSync(migrationPath), `${migrationName} is missing`)
  return readFileSync(migrationPath, "utf8").replace(/\s+/g, " ")
}

test("dismissed suggestions migration creates the per-user category dismissal table", () => {
  const sql = readNormalizedMigrationSql()
  const normalized = sql.toLowerCase()

  assert.match(normalized, /create table if not exists public\.dismissed_suggestions/)
  assert.match(normalized, /id uuid primary key default gen_random_uuid\(\)/)
  assert.match(
    normalized,
    /user_id uuid not null references public\.profiles\(id\) on delete cascade/,
  )
  assert.match(
    normalized,
    /category text not null references public\.product_categories\(key\) on delete restrict/,
  )
  assert.match(normalized, /dismissed_at timestamptz not null default now\(\)/)
  assert.match(normalized, /reappear_at timestamptz not null/)
  assert.match(normalized, /unique \(user_id, category\)/)
  assert.match(normalized, /create index if not exists idx_dismissed_suggestions_user_id/)
  assert.match(normalized, /on public\.dismissed_suggestions \(user_id\)/)
  assert.match(normalized, /create index if not exists idx_dismissed_suggestions_user_reappear_at/)
  assert.match(normalized, /on public\.dismissed_suggestions \(user_id, reappear_at\)/)
  assert.doesNotMatch(normalized, /where reappear_at > now\(\)/)
})

test("dismissed suggestions migration gives authenticated users own-row RLS", () => {
  const sql = readNormalizedMigrationSql()
  const normalized = sql.toLowerCase()

  assert.match(normalized, /alter table public\.dismissed_suggestions enable row level security/)
  assert.match(
    normalized,
    /grant select, insert, update, delete on table public\.dismissed_suggestions to authenticated/,
  )

  for (const action of ["select", "insert", "update", "delete"]) {
    assert.match(
      normalized,
      new RegExp(
        `create policy dismissed_suggestions_${action}_own on public\\.dismissed_suggestions for ${action} to authenticated`,
      ),
    )
  }

  assert.match(normalized, /for select to authenticated using \(user_id = auth\.uid\(\)\)/)
  assert.match(normalized, /for insert to authenticated with check \(user_id = auth\.uid\(\)\)/)
  assert.match(
    normalized,
    /for update to authenticated using \(user_id = auth\.uid\(\)\) with check \(user_id = auth\.uid\(\)\)/,
  )
  assert.match(normalized, /for delete to authenticated using \(user_id = auth\.uid\(\)\)/)
})

test("createDismissal upserts a 14-day dismissal for the user and category", async () => {
  const calls: Array<{ row: Record<string, unknown>; options: Record<string, unknown> }> = []
  const client = {
    from(table: string) {
      assert.equal(table, "dismissed_suggestions")
      return {
        upsert(row: Record<string, unknown>, options: Record<string, unknown>) {
          calls.push({ row, options })
          return {
            select(columns: string) {
              assert.equal(columns, "*")
              return {
                async single() {
                  return {
                    data: { id: "dismissal-1", ...row } as DismissedSuggestionRow,
                    error: null,
                  }
                },
              }
            },
          }
        },
      }
    },
  }
  const { createDismissal } = await import("../src/lib/routines/dismissals")
  const now = new Date("2026-07-06T10:00:00.000Z")

  const row = await createDismissal({
    client,
    userId: "user-1",
    category: "shampoo",
    now,
  })

  assert.equal(calls.length, 1)
  assert.deepEqual(calls[0]?.options, { onConflict: "user_id,category" })
  assert.deepEqual(calls[0]?.row, {
    user_id: "user-1",
    category: "shampoo",
    dismissed_at: "2026-07-06T10:00:00.000Z",
    reappear_at: "2026-07-20T10:00:00.000Z",
  })
  assert.equal(row.id, "dismissal-1")
  assert.equal(row.reappear_at, "2026-07-20T10:00:00.000Z")
})
