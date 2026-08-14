import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

test("auth provider clears owner-scoped Stage 3 recovery on signout and owner switch", () => {
  const source = readFileSync(
    new URL("../src/providers/auth-provider.tsx", import.meta.url),
    "utf8",
  )

  assert.match(source, /clearPersonalPlanStage3RecoveryForOwner\(user\?\.id\)/)
  assert.match(source, /clearPersonalPlanStage3RecoveryForOwner\(currentOwnerId\)/)
  assert.doesNotMatch(source, /setUser\(\(prev\)[\s\S]*clearPersonalPlanStage3RecoveryForOwner/)
  assert.match(
    source,
    /createCategoryCaptureQueue\(\{[\s\S]*storage:\s*categoryStorage[\s\S]*\}\)\.clearOnLogout\(ownerId\)/,
  )
  assert.match(source, /clearPendingStage3RecoveryForOwner\([^,]+,\s*ownerId\)/)
  assert.match(source, /clearStage3ReviewDraftsForOwner\([^,]+,\s*ownerId\)/)
  assert.doesNotMatch(source, /clearPendingStage3Recovery\([^)]*\)/)
})
