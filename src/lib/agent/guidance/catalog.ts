import type { GuidanceId, GuidanceKind } from "../contracts"

export interface GuidanceCatalogEntry {
  kind: GuidanceKind
  title: string
  path?: string
  paths?: string[]
}

export const guidanceCatalog = {
  "playbook:recommend_products": {
    kind: "playbook",
    title: "Produkte empfehlen",
    path: "data/agent-guidance/playbooks/recommend-products.md",
  },
  "playbook:build_or_fix_routine": {
    kind: "playbook",
    title: "Routine bauen oder reparieren",
    path: "data/agent-guidance/playbooks/build-or-fix-routine.md",
  },
  "playbook:troubleshoot_hair_issue": {
    kind: "playbook",
    title: "Haarproblem einordnen",
    path: "data/agent-guidance/playbooks/troubleshoot-hair-issue.md",
  },
  "playbook:compare_or_decide": {
    kind: "playbook",
    title: "Vergleichen oder entscheiden",
    path: "data/agent-guidance/playbooks/compare-or-decide.md",
  },
  "playbook:usage_and_application": {
    kind: "playbook",
    title: "Anwendung und Dosierung",
    path: "data/agent-guidance/playbooks/usage-and-application.md",
  },
  "overlay:fine_hair": {
    kind: "overlay",
    title: "Feines Haar",
    path: "data/agent-guidance/overlays/fine-hair.md",
  },
  "overlay:oily_scalp": {
    kind: "overlay",
    title: "Fettige Kopfhaut",
    path: "data/agent-guidance/overlays/oily-scalp.md",
  },
  "overlay:dry_lengths": {
    kind: "overlay",
    title: "Trockene Längen",
    path: "data/agent-guidance/overlays/dry-lengths.md",
  },
  "overlay:minimal_routine": {
    kind: "overlay",
    title: "Minimale Routine",
    path: "data/agent-guidance/overlays/minimal-routine.md",
  },
  "overlay:curly_hair": {
    kind: "overlay",
    title: "Lockiges Haar",
    path: "data/agent-guidance/overlays/curly-hair.md",
  },
  "overlay:coily_hair": {
    kind: "overlay",
    title: "Coily Hair",
    path: "data/agent-guidance/overlays/coily-hair.md",
  },
  "overlay:heat_styling": {
    kind: "overlay",
    title: "Heat Styling",
    path: "data/agent-guidance/overlays/heat-styling.md",
  },
  "overlay:mechanical_stress": {
    kind: "overlay",
    title: "Mechanical Stress",
    path: "data/agent-guidance/overlays/mechanical-stress.md",
  },
  "overlay:buildup_risk": {
    kind: "overlay",
    title: "Buildup Risk",
    path: "data/agent-guidance/overlays/buildup-risk.md",
  },
  "overlay:damage_repair": {
    kind: "overlay",
    title: "Damage Repair",
    path: "data/agent-guidance/overlays/damage-repair.md",
  },
  "overlay:sensitive_scalp": {
    kind: "overlay",
    title: "Sensitive Scalp",
    path: "data/agent-guidance/overlays/sensitive-scalp.md",
  },
  "overlay:dandruff_scalp": {
    kind: "overlay",
    title: "Dandruff Scalp",
    path: "data/agent-guidance/overlays/dandruff-scalp.md",
  },
  "routine:curl_definition": {
    kind: "routine",
    title: "Curl Definition Routine",
    paths: [
      "data/agent-guidance/routines/curl-definition/core-fit.md",
      "data/agent-guidance/routines/curl-definition/assembly-rules.md",
      "data/agent-guidance/routines/curl-definition/guardrails.md",
      "data/agent-guidance/routines/curl-definition/followups.md",
    ],
  },
  "routine:straight_low_definition": {
    kind: "routine",
    title: "Straight / Low Definition Routine",
    paths: [
      "data/agent-guidance/routines/straight-low-definition/core-fit.md",
      "data/agent-guidance/routines/straight-low-definition/assembly-rules.md",
      "data/agent-guidance/routines/straight-low-definition/guardrails.md",
      "data/agent-guidance/routines/straight-low-definition/followups.md",
    ],
  },
  "topic:bond_builder": {
    kind: "topic",
    title: "Bond Builder",
    paths: [
      "data/agent-guidance/topics/bond-builder/core-fit.md",
      "data/agent-guidance/topics/bond-builder/response-playbook.md",
      "data/agent-guidance/topics/bond-builder/guardrails.md",
      "data/agent-guidance/topics/bond-builder/confusions.md",
    ],
  },
  "topic:cwc_owc": {
    kind: "topic",
    title: "CWC & OWC",
    paths: [
      "data/agent-guidance/topics/cwc-owc/core-fit.md",
      "data/agent-guidance/topics/cwc-owc/response-playbook.md",
      "data/agent-guidance/topics/cwc-owc/guardrails.md",
      "data/agent-guidance/topics/cwc-owc/confusions.md",
    ],
  },
  "topic:deep_cleansing": {
    kind: "topic",
    title: "Deep Cleansing",
    paths: [
      "data/agent-guidance/topics/deep-cleansing/core-fit.md",
      "data/agent-guidance/topics/deep-cleansing/response-playbook.md",
      "data/agent-guidance/topics/deep-cleansing/guardrails.md",
      "data/agent-guidance/topics/deep-cleansing/confusions.md",
    ],
  },
  "topic:general_haircare": {
    kind: "topic",
    title: "General Haircare",
    paths: [
      "data/agent-guidance/topics/general-haircare/core-fit.md",
      "data/agent-guidance/topics/general-haircare/response-playbook.md",
      "data/agent-guidance/topics/general-haircare/guardrails.md",
      "data/agent-guidance/topics/general-haircare/confusions.md",
    ],
  },
  "topic:hair_oiling": {
    kind: "topic",
    title: "Hair Oiling",
    paths: [
      "data/agent-guidance/topics/hair-oiling/core-fit.md",
      "data/agent-guidance/topics/hair-oiling/response-playbook.md",
      "data/agent-guidance/topics/hair-oiling/guardrails.md",
      "data/agent-guidance/topics/hair-oiling/confusions.md",
    ],
  },
} as const satisfies Record<GuidanceId, GuidanceCatalogEntry>

export type GuidanceCatalog = typeof guidanceCatalog
