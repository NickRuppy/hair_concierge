import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  PERSONAL_PLAN_READY_MESSAGES,
  PERSONAL_PLAN_READY_MIN_STORY_MS,
  PERSONAL_PLAN_READY_POLL_INTERVAL_MS,
  PERSONAL_PLAN_READY_POLL_LIMIT,
  personalPlanStoryIndexAt,
} from "../src/app/plan-bereit/transition"

test("the post-payment story confirms purchase, preparation, and product refinement", () => {
  assert.deepEqual(PERSONAL_PLAN_READY_MESSAGES, [
    "Deine Zahlung ist bestätigt.",
    "Dein persönlicher Haarplan ist vorbereitet.",
    "Jetzt verfeinerst du ihn mit deinen Produkten.",
  ])
})

test("the story lasts about seven seconds and readiness polling lasts thirty seconds", () => {
  assert.equal(PERSONAL_PLAN_READY_MIN_STORY_MS, 6_600)
  assert.equal(PERSONAL_PLAN_READY_POLL_INTERVAL_MS, 1_500)
  assert.equal(PERSONAL_PLAN_READY_POLL_LIMIT, 20)
  assert.equal(PERSONAL_PLAN_READY_POLL_INTERVAL_MS * PERSONAL_PLAN_READY_POLL_LIMIT, 30_000)
})

test("story progression exposes each message before completion", () => {
  assert.equal(personalPlanStoryIndexAt(0), 0)
  assert.equal(personalPlanStoryIndexAt(2_199), 0)
  assert.equal(personalPlanStoryIndexAt(2_200), 1)
  assert.equal(personalPlanStoryIndexAt(4_400), 2)
  assert.equal(personalPlanStoryIndexAt(6_600), 2)
})

test("readiness failures surface a recoverable error instead of polling forever", () => {
  const route = readFileSync(
    new URL("../src/app/plan-bereit/status/route.ts", import.meta.url),
    "utf8",
  )
  const client = readFileSync(
    new URL("../src/app/plan-bereit/personal-plan-ready-client.tsx", import.meta.url),
    "utf8",
  )
  const readiness = readFileSync(
    new URL("../src/app/plan-bereit/readiness.ts", import.meta.url),
    "utf8",
  )

  assert.match(route, /\{ status: "error" \}/)
  assert.match(route, /status: 500/)
  assert.doesNotMatch(route, /catch \(error\)[\s\S]*\{ status: "pending" \}/)
  assert.match(client, /!response\.ok \|\| body\.status === "error"/)
  assert.match(client, /method: attempts === 1 \? "POST" : "GET"/)
  assert.match(client, /\/plan-bereit\/status\?lead=/)
  assert.match(route, /loadPersonalPlanReadiness\(admin, user\.id, user\.email, leadId\)/)
  assert.match(readiness, /\.eq\("id", leadId\)/)
  assert.match(readiness, /canLinkDirectQuizLead/)
  assert.doesNotMatch(readiness, /\.eq\("email", email\.toLowerCase\(\)\)/)
})
