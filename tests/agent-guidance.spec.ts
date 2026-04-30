import test from "node:test"
import assert from "node:assert/strict"
import { mkdtemp } from "fs/promises"
import { join } from "path"
import { tmpdir } from "os"

import { loadGuidance } from "@/lib/agent/guidance/load-guidance"
import type { GuidanceId, GuidanceKind } from "@/lib/agent/contracts"

test("loadGuidance returns named playbooks and overlays", async () => {
  const result = await loadGuidance(["playbook:recommend_products", "overlay:fine_hair"])

  assert.deepEqual(
    result.items.map((item) => item.id),
    ["playbook:recommend_products", "overlay:fine_hair"],
  )
  assert.equal(result.items[0].kind, "playbook")
  assert.equal(result.items[1].kind, "overlay")
  assert.match(result.items[0].content, /When to use/i)
  assert.match(result.items[1].content, /fine/i)
})

test("loadGuidance returns intent playbooks salvaged from chat-response review", async () => {
  const result = await loadGuidance([
    "playbook:troubleshoot_hair_issue",
    "playbook:compare_or_decide",
    "playbook:usage_and_application",
  ])

  assert.deepEqual(
    result.items.map((item) => item.id),
    [
      "playbook:troubleshoot_hair_issue",
      "playbook:compare_or_decide",
      "playbook:usage_and_application",
    ],
  )
  assert.deepEqual(
    result.items.map((item) => item.kind),
    ["playbook", "playbook", "playbook"],
  )
  assert.match(result.items[0].content, /troubleshoot/i)
  assert.match(result.items[1].content, /compare/i)
  assert.match(result.items[2].content, /application/i)
})

test("loadGuidance loads every callable v1 guidance kind", async () => {
  const cases: Array<{ id: GuidanceId; kind: GuidanceKind; marker: RegExp }> = [
    { id: "overlay:curly_hair", kind: "overlay", marker: /Curly Hair/i },
    { id: "overlay:coily_hair", kind: "overlay", marker: /Coily Hair/i },
    { id: "overlay:heat_styling", kind: "overlay", marker: /Heat Styling/i },
    { id: "overlay:mechanical_stress", kind: "overlay", marker: /Mechanical Stress/i },
    { id: "overlay:buildup_risk", kind: "overlay", marker: /Buildup Risk/i },
    { id: "overlay:damage_repair", kind: "overlay", marker: /Damage Repair/i },
    { id: "overlay:sensitive_scalp", kind: "overlay", marker: /Sensitive Scalp/i },
    { id: "overlay:dandruff_scalp", kind: "overlay", marker: /Dandruff Scalp/i },
    { id: "routine:curl_definition", kind: "routine", marker: /Core Fit[\s\S]*Assembly Rules/ },
    {
      id: "routine:straight_low_definition",
      kind: "routine",
      marker: /Core Fit[\s\S]*Assembly Rules/,
    },
    { id: "topic:bond_builder", kind: "topic", marker: /Core Fit[\s\S]*Response Playbook/ },
    { id: "topic:cwc_owc", kind: "topic", marker: /Core Fit[\s\S]*Response Playbook/ },
    { id: "topic:deep_cleansing", kind: "topic", marker: /Core Fit[\s\S]*Response Playbook/ },
    { id: "topic:general_haircare", kind: "topic", marker: /Core Fit[\s\S]*Response Playbook/ },
    { id: "topic:hair_oiling", kind: "topic", marker: /Core Fit[\s\S]*Response Playbook/ },
  ]

  const result = await loadGuidance(cases.map((item) => item.id))

  assert.deepEqual(
    result.items.map((item) => [item.id, item.kind]),
    cases.map((item) => [item.id, item.kind]),
  )

  for (const [index, item] of result.items.entries()) {
    assert.match(item.content, cases[index].marker, item.id)
  }
})

test("playbooks keep the five user-job boundaries explicit", async () => {
  const result = await loadGuidance([
    "playbook:recommend_products",
    "playbook:compare_or_decide",
    "playbook:build_or_fix_routine",
    "playbook:troubleshoot_hair_issue",
    "playbook:usage_and_application",
  ])
  const contentById = Object.fromEntries(result.items.map((item) => [item.id, item.content]))

  assert.match(contentById["playbook:recommend_products"], /product pick/i)
  assert.doesNotMatch(contentById["playbook:recommend_products"], /comparisons/i)
  assert.match(contentById["playbook:compare_or_decide"], /compare\/decide/i)
  assert.match(contentById["playbook:build_or_fix_routine"], /routine structure/i)
  assert.doesNotMatch(contentById["playbook:build_or_fix_routine"], /debug/i)
  assert.match(contentById["playbook:troubleshoot_hair_issue"], /troubleshoot/i)
  assert.match(contentById["playbook:usage_and_application"], /usage/i)
})

test("dandruff overlay preserves dry-flakes and length-protection decisions", async () => {
  const result = await loadGuidance(["overlay:dandruff_scalp"])
  const content = result.items[0]?.content ?? ""

  assert.match(content, /Do not load this from dry flakes alone/i)
  assert.match(content, /CWC\/OWC/i)
  assert.match(content, /optional/i)
  assert.match(content, /length/i)
})

test("loadGuidance rejects unknown ids", async () => {
  await assert.rejects(
    () => loadGuidance(["overlay:not-real"]),
    /Unknown guidance id: overlay:not-real/,
  )
})

test("loadGuidance works when cwd is outside the repo root", async () => {
  const originalCwd = process.cwd()
  const tempDir = await mkdtemp(join(tmpdir(), "hair-guidance-"))

  try {
    process.chdir(tempDir)

    const result = await loadGuidance(["overlay:fine_hair"])

    assert.equal(result.items[0].id, "overlay:fine_hair")
    assert.match(result.items[0].content, /fine/i)
  } finally {
    process.chdir(originalCwd)
  }
})
