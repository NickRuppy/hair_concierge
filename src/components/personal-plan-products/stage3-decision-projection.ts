"use client"

import type {
  Stage3AuthorityEvaluation,
  Stage3AuthoritySemanticIntent,
} from "@/lib/personal-plan/products/authority/contracts"
import {
  deriveStage3DecisionSubjects,
  type PersonalPlanCategory,
  type Stage3ProductDraft,
} from "@/lib/personal-plan/products/contracts"
import type { PlanProductRole } from "@/lib/personal-plan/types"

import type { Stage3DecisionAction, Stage3ProductDecisionProjection } from "."

export const CATEGORY_COPY: Record<PersonalPlanCategory, { label: string; need: string }> = {
  shampoo: { label: "Shampoo", need: "Reinigung passend zu deiner Kopfhaut" },
  conditioner: { label: "Conditioner", need: "Pflege nach jeder Wäsche" },
  leave_in: { label: "Leave-in", need: "Pflege, die im Haar bleibt" },
  heat_protectant: { label: "Hitzeschutz", need: "Schutz bei Styling mit Hitze" },
  oil: { label: "Öl", need: "Schutz und Finish für deine Längen" },
  mask: { label: "Maske", need: "Zusätzliche intensive Pflege" },
  scalp_care: { label: "Kopfhautprodukt", need: "Beruhigende Pflege für deine Kopfhaut" },
  dry_shampoo: { label: "Trockenshampoo", need: "Frische zwischen den Haarwäschen" },
  bondbuilder: { label: "Bondbuilder", need: "Unterstützung für beanspruchtes Haar" },
  deep_cleansing_shampoo: {
    label: "Tiefenreinigung",
    need: "Gezielte Entfernung von Rückständen",
  },
}

export const ROLE_COPY: Record<PlanProductRole, { label: string; description: string }> = {
  shampoo_everyday: { label: "Hauptreinigung", description: "Für deine regelmäßige Haarwäsche" },
  shampoo_dandruff: { label: "Gezielte Reinigung", description: "Als gezielte Ergänzung" },
  conditioner_rinse_out: { label: "Pflege nach der Wäsche", description: "Zum Ausspülen" },
  post_wash_leave_in: { label: "Pflege im feuchten Haar", description: "Nach der Haarwäsche" },
  pre_heat_application: { label: "Vor dem Styling", description: "Vor Wärme im Haar" },
  intensive_conditioning_mask: { label: "Intensivpflege", description: "Als auswaschbare Pflege" },
  pre_wash_fibre_treatment: {
    label: "Vor der Haarwäsche",
    description: "Als Pflege vor dem Waschen",
  },
  leave_on_fibre_conditioning: {
    label: "Im feuchten Haar",
    description: "Nach dem Waschen im feuchten Haar",
  },
  dry_finish: { label: "Im trockenen Haar", description: "Für Glanz und Finish" },
  residue_reset: { label: "Rückstände lösen", description: "Bei Bedarf" },
  mineral_reset: { label: "Mineralrückstände lösen", description: "Bei Bedarf" },
  root_refresh_bridge: { label: "Ansatz auffrischen", description: "Zwischen Haarwäschen" },
  pre_heat_protection: { label: "Schutz vor Stylinghitze", description: "Vor Hitze" },
  specialized_bond_treatment: { label: "Bondpflege", description: "Nach Herstellerangabe" },
  scalp_comfort: { label: "Kopfhaut beruhigen", description: "Für ein ruhigeres Hautgefühl" },
  scalp_flake_oil_adjunct: {
    label: "Schuppen kontrollieren",
    description: "Bei sichtbaren Schuppen",
  },
  density_claim_tonic: { label: "Kopfhaut-Tonic", description: "Mit begrenzter Evidenz" },
  scalp_exfoliant: { label: "Kopfhaut klären", description: "Bei Bedarf" },
}

export function authorityEvaluationProjection(
  draft: Stage3ProductDraft,
  subject: ReturnType<typeof deriveStage3DecisionSubjects>[number],
  evaluation: Stage3AuthorityEvaluation,
  needSummary = CATEGORY_COPY[subject.category].need,
): Stage3ProductDecisionProjection {
  if (evaluation.subjectKey !== subject.decisionKey || evaluation.category !== subject.category) {
    throw new Error("stage3_authority_projection_mismatch")
  }
  const product = subject.capturedProductId
    ? draft.products.find((candidate) => candidate.capturedProductId === subject.capturedProductId)
    : undefined
  const base = {
    decisionKey: subject.decisionKey,
    categoryLabel: CATEGORY_COPY[subject.category].label,
    ...(subject.category === "oil" ? { roleLabel: ROLE_COPY[subject.role].label } : {}),
    needSummary,
    ...(product ? { ownedProductName: product.identity.displayName } : {}),
  }

  if (evaluation.status === "unsupported") {
    return {
      ...base,
      kind: "gap",
      verdictLabel: "Prüfung nicht verfügbar",
      rationale: "Diese Passung können wir aktuell noch nicht verlässlich prüfen.",
      actions: [],
    }
  }

  if (subject.subjectKind === "uncovered_role") {
    const projectedActions = projectAuthorityActions(evaluation)
    return {
      ...base,
      kind: "gap",
      verdictLabel: "Dieser Bedarf ist noch offen",
      rationale: "Du hast dafür aktuell kein Produkt ausgewählt.",
      ...((evaluation.status === "known" || evaluation.status === "unknown") &&
      evaluation.criteria.length > 0
        ? { criteria: evaluation.criteria.map(projectCriterion) }
        : {}),
      ...(evaluation.status === "known" && evaluation.recommendation
        ? { recommendation: { productName: evaluation.recommendation.displayName } }
        : {}),
      actions: [{ kind: "choose_other", label: "Passendes Produkt suchen" }, ...projectedActions],
    }
  }

  if (evaluation.status === "pending") {
    return {
      ...base,
      kind: "pending",
      verdictLabel: "Noch in Prüfung",
      rationale: "Wir prüfen das Produkt, bevor wir seine Passung bewerten.",
      actions: [
        {
          kind: "pending",
          label: "Auf Analyse warten",
          productName: product?.identity.displayName,
        },
        { kind: "choose_other", label: "Anderes Produkt wählen" },
      ],
    }
  }
  if (evaluation.status === "unknown") {
    return {
      ...base,
      kind: "gap",
      verdictLabel: "Noch nicht beurteilbar",
      rationale: "Für eine verlässliche Bewertung fehlen noch bestätigte Produktinformationen.",
      criteria: evaluation.criteria.map(projectCriterion),
      actions: projectAuthorityActions(evaluation, product?.identity.displayName),
    }
  }
  const kind =
    evaluation.verdict === "mismatch"
      ? "mismatch"
      : evaluation.verdict === "unknown"
        ? "gap"
        : "fit"
  return {
    ...base,
    kind,
    verdictLabel:
      evaluation.verdict === "ideal"
        ? "Passt sehr gut"
        : evaluation.verdict === "supportive"
          ? "Passt mit Einschränkung"
          : evaluation.verdict === "mismatch"
            ? "Passt nicht zu deinem Bedarf"
            : "Noch nicht beurteilbar",
    rationale:
      evaluation.verdict === "ideal"
        ? "Das Produkt erfüllt den vorgesehenen Bedarf. Das ist ein guter Baustein für deine Routine."
        : evaluation.verdict === "supportive"
          ? "Das Produkt unterstützt deinen Bedarf mit einer dokumentierten Einschränkung."
          : evaluation.verdict === "mismatch"
            ? "Die bestätigten Produkteigenschaften passen nicht zu diesem Bedarf."
            : "Eine verlässliche Bewertung ist noch nicht möglich.",
    criteria: evaluation.criteria.map(projectCriterion),
    ...(evaluation.recommendation
      ? { recommendation: { productName: evaluation.recommendation.displayName } }
      : {}),
    actions: projectAuthorityActions(
      evaluation,
      product?.identity.displayName,
      evaluation.recommendation?.displayName,
    ),
  }
}

function projectCriterion(
  criterion: Extract<
    Stage3AuthorityEvaluation,
    { status: "known" | "unknown" }
  >["criteria"][number],
) {
  return {
    label: criterion.label,
    result:
      criterion.result === "pass"
        ? "Erfüllt"
        : criterion.result === "caution"
          ? "Teilweise"
          : criterion.result === "fail"
            ? "Nicht erfüllt"
            : "Noch offen",
    tone:
      criterion.result === "pass"
        ? ("positive" as const)
        : criterion.result === "fail"
          ? ("negative" as const)
          : ("warning" as const),
    explanation: criterion.explanation,
  }
}

function projectAuthorityActions(
  evaluation: Stage3AuthorityEvaluation,
  productName?: string,
  recommendationName?: string,
): Stage3DecisionAction[] {
  return evaluation.allowedActions.map((action) => {
    switch (action) {
      case "keep_owned":
        return { kind: "keep", label: `${productName ?? "Produkt"} weiterverwenden`, productName }
      case "acknowledge_override":
        return {
          kind: "override",
          label: `${productName ?? "Produkt"} trotzdem behalten`,
          productName,
        }
      case "plan_recommendation":
        return {
          kind: "plan_purchase",
          label: `${recommendationName ?? "Empfehlung"} einplanen`,
          productName: recommendationName,
        }
      case "keep_pending":
        return { kind: "pending", label: "Auf Analyse warten", productName }
      case "leave_uncovered":
        return {
          kind: "skip",
          label: productName ? `${productName} nicht einplanen` : "Ohne Produkt fortfahren",
          productName,
        }
    }
  })
}

export function semanticActionFor(
  action: Stage3DecisionAction,
): Stage3AuthoritySemanticIntent["action"] | null {
  switch (action.kind) {
    case "keep":
      return "keep_owned"
    case "override":
      return "acknowledge_override"
    case "plan_purchase":
      return "plan_recommendation"
    case "pending":
      return "keep_pending"
    case "skip":
      return "leave_uncovered"
    case "choose_other":
      return null
  }
}
