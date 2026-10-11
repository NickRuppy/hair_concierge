import fs from "node:fs"
import { applicationGuidanceProtocolSchema } from "/Users/nick/AI_work/hair_conscierge/.worktrees/catalog-completeness-fill/src/lib/routines/personal-plan/application/contracts"
import { productApplicationPointerV2Schema } from "/Users/nick/AI_work/hair_conscierge/.worktrees/catalog-completeness-fill/src/lib/routines/personal-plan/application/contracts-v2"
const OLD =
  "/Users/nick/AI_work/hair_conscierge/.worktrees/catalog-assessment-completeness/plans/catalog-assessment-completeness"
const cand = JSON.parse(
  fs.readFileSync(OLD + "/ordinary-guidance-bindings-v1/candidate.json", "utf8"),
)
for (const b of cand.bindings) {
  const v1 = applicationGuidanceProtocolSchema.safeParse(b.row.guidance_payload)
  const v2 = productApplicationPointerV2Schema.safeParse(b.guidance_payload_v2)
  console.log(
    "ordinary",
    b.product_id.slice(0, 8),
    b.row.role,
    "v1",
    v1.success,
    v1.success ? "" : JSON.stringify(v1.error.issues).slice(0, 300),
    "v2",
    v2.success,
    v2.success ? "" : JSON.stringify(v2.error.issues).slice(0, 300),
  )
}
const man = JSON.parse(fs.readFileSync(OLD + "/leave-in-repairs-v1/manifest.json", "utf8"))
for (const e of man.entries)
  for (const p of e.intendedAuthority.product_application_protocols) {
    const v1 = applicationGuidanceProtocolSchema.safeParse(p.guidance_payload)
    const v2 = productApplicationPointerV2Schema.safeParse(p.guidance_payload_v2)
    console.log(
      "leave_in",
      e.productId.slice(0, 8),
      p.role,
      "v1",
      v1.success,
      v1.success ? "" : JSON.stringify(v1.error.issues).slice(0, 300),
      "v2",
      v2.success,
      v2.success ? "" : JSON.stringify(v2.error.issues).slice(0, 300),
    )
  }
