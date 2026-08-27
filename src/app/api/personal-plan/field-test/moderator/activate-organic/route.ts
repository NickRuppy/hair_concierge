import { createPersonalPlanModeratorActivationHandler } from "../activate/route"
import { activateModeratorOrganicEnrollment } from "@/lib/personal-plan-field-test/moderator-organic"
import { resolveOrganicModeratorOfferAuthorization } from "@/lib/personal-plan-field-test/server"

export const POST = createPersonalPlanModeratorActivationHandler({
  packageKey: "default_organic",
  activate: (input) => activateModeratorOrganicEnrollment(input),
  resolveAuthorization: resolveOrganicModeratorOfferAuthorization,
})
