"use client"

import { useState, type CSSProperties } from "react"

import { RoutineEditor } from "@/components/routine/personal-plan/routine-editor"
import type { RoutinePayloadV1 } from "@/lib/personal-plan/routine/contracts"

const routine: RoutinePayloadV1 = {
  schemaVersion: 1,
  planId: "11111111-1111-4111-8111-111111111111",
  versionId: "routine-lab-v1",
  parentVersionId: null,
  source: {
    refinedVersionId: "22222222-2222-4222-8222-222222222222",
    productPortfolioVersionId: "portfolio-lab-v1",
    sourceFingerprint: "a".repeat(64),
    compilerVersion: "routine-lab-v1",
    authorityVersions: {},
  },
  intent: { schemaVersion: 1, categories: [] },
  sections: [
    { key: "basis", itemKeys: ["item:shampoo:cleanse:owned"] },
    { key: "optional", itemKeys: [] },
  ],
  items: [
    {
      itemKey: "item:shampoo:cleanse:owned",
      assignmentKey: "assignment:shampoo:cleanse:owned",
      category: "shampoo",
      role: "shampoo_everyday",
      purposeKey: "shampoo_everyday",
      roleOrder: 0,
      state: {
        systemAssessment: "basis",
        inclusion: "included",
        availability: "owned",
        fitDecision: "standard",
      },
      product: {
        kind: "owned",
        capturedProductId: "captured-shampoo",
        productId: "product-shampoo",
        displayName: "Sanftes Shampoo",
      },
      cadence: { recommended: null, userOverride: null, displayKey: "personal_plan.cadence.none" },
      sourceDecisionKeys: [],
      authorityRuleIds: [],
      executable: true,
    },
  ],
  createdAt: "2026-08-16T00:00:00.000Z",
}

export function RoutineEditorLab() {
  const [cancelled, setCancelled] = useState(false)
  if (cancelled) return <p className="p-6">Routineübersicht</p>

  return (
    <div
      data-personal-plan-shell="true"
      style={{ "--personal-plan-shell-header-offset": "3.5rem" } as CSSProperties}
    >
      <div className="sticky top-0 z-40 h-14 border-b border-border bg-background" aria-hidden />
      <RoutineEditor
        routine={routine}
        productOptions={{}}
        supportedCadences={["weekly_1x"]}
        supportedRolesByCategory={{ shampoo: ["shampoo_everyday"] }}
        onCancel={() => setCancelled(true)}
        onSubmitOperations={() => {}}
      />
    </div>
  )
}
