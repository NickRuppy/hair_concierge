import assert from "node:assert/strict"
import test from "node:test"

import {
  MIGRATION_QUIZ_CONTEXT_COOKIE,
  MIGRATION_QUIZ_HREF,
  createMigrationQuizContextCookie,
  decodeMigrationQuizContextCookie,
  migrationQuizContextCookieOptions,
} from "../src/lib/personal-plan/migration-quiz-context"

const secret = "migration-quiz-context-secret-32-plus"
const userId = "10000000-0000-4000-8000-000000000001"
const enrollmentId = "20000000-0000-4000-8000-000000000002"
const now = Date.UTC(2026, 7, 28, 12, 0, 0)

test("migration quiz context is signed, short-lived, and bound to user plus enrollment", () => {
  const value = createMigrationQuizContextCookie({ userId, enrollmentId }, secret, now)

  assert.ok(value)
  assert.deepEqual(decodeMigrationQuizContextCookie(value, secret, { userId, now }), {
    userId,
    enrollmentId,
    issuedAt: now,
    expiresAt: now + 2 * 60 * 60 * 1000,
  })
  assert.equal(decodeMigrationQuizContextCookie(`${value}x`, secret, { userId, now }), null)
  assert.equal(decodeMigrationQuizContextCookie(value, "wrong-secret", { userId, now }), null)
  assert.equal(
    decodeMigrationQuizContextCookie(value, secret, {
      userId: "10000000-0000-4000-8000-000000000099",
      now,
    }),
    null,
  )
  assert.equal(
    decodeMigrationQuizContextCookie(value, secret, { userId, now: now + 3 * 60 * 60 * 1000 }),
    null,
  )
})

test("migration quiz context refuses missing secrets and malformed identities", () => {
  assert.equal(createMigrationQuizContextCookie({ userId, enrollmentId }, "", now), null)
  assert.equal(
    createMigrationQuizContextCookie({ userId: "user-1", enrollmentId }, secret, now),
    null,
  )
  assert.equal(
    createMigrationQuizContextCookie({ userId, enrollmentId: "enrollment-1" }, secret, now),
    null,
  )
  assert.equal(decodeMigrationQuizContextCookie("not-a-cookie", secret, { userId, now }), null)
})

test("migration quiz navigation and cookie options are server-owned", () => {
  assert.equal(MIGRATION_QUIZ_CONTEXT_COOKIE, "chaarlie_personal_plan_migration_quiz")
  assert.equal(MIGRATION_QUIZ_HREF, "/quiz?mode=retake&returnTo=%2Fplan-bereit")
  assert.equal(migrationQuizContextCookieOptions.httpOnly, true)
  assert.equal(migrationQuizContextCookieOptions.sameSite, "lax")
  assert.equal(migrationQuizContextCookieOptions.path, "/")
  assert.equal(migrationQuizContextCookieOptions.maxAge, 2 * 60 * 60)
})
