import { buildHairProfileSection } from "@/lib/personal-plan/refinement/hair-profile-section"
import type { RefinementStatusResponse } from "@/lib/personal-plan/refinement/refinement-status"

type ModuleState = "open" | "complete"

/**
 * `tools: null` is the rollout-off member: the real response lists the tools module as
 * `not_applicable`, so the section has four steps. A state is the rollout-on member: five steps.
 */
function statusResponse(
  products: ModuleState,
  habits: ModuleState,
  tools: ModuleState | null,
): RefinementStatusResponse {
  const states = [products, habits, ...(tools ? [tools] : [])]
  const completedModules = states.filter((entry) => entry === "complete").length
  return {
    modules: [
      { module: "products", status: products, openQuestionCount: products === "open" ? 2 : 0 },
      tools
        ? { module: "tools", status: tools, openQuestionCount: tools === "open" ? 3 : 0 }
        : { module: "tools", status: "not_applicable", openQuestionCount: 0 },
      { module: "habits", status: habits, openQuestionCount: habits === "open" ? 4 : 0 },
    ],
    progress: { completedSteps: 2 + completedModules, totalSteps: 2 + states.length },
    module1HandedOff: products === "complete",
    banner: { visible: false, module: null, dismissed: false },
  }
}

export const HAARPROFIL_LAB_SCENARIOS = [
  {
    title: "Frisch akzeptiert · 2 von 4",
    view: buildHairProfileSection({ status: statusResponse("open", "open", null) }),
  },
  {
    title: "Deferred-Kohorte · 2 von 4 mit Freischalt-Hinweis",
    view: buildHairProfileSection({
      status: statusResponse("open", "open", null),
      deferredRolesPendingRefinement: true,
    }),
  },
  {
    title: "Produkte fertig · 3 von 4",
    view: buildHairProfileSection({ status: statusResponse("complete", "open", null) }),
  },
  {
    title: "Alles fertig · 4 von 4",
    view: buildHairProfileSection({ status: statusResponse("complete", "complete", null) }),
  },
  {
    title: "Mit Tools · frisch akzeptiert · 2 von 5",
    view: buildHairProfileSection({ status: statusResponse("open", "open", "open") }),
  },
  {
    title: "Mit Tools · Produkte fertig · 3 von 5",
    view: buildHairProfileSection({ status: statusResponse("complete", "open", "open") }),
  },
  {
    title: "Mit Tools · Tools fertig · 4 von 5",
    view: buildHairProfileSection({ status: statusResponse("complete", "open", "complete") }),
  },
  {
    title: "Mit Tools · Alles fertig · 5 von 5",
    view: buildHairProfileSection({ status: statusResponse("complete", "complete", "complete") }),
  },
] as const
