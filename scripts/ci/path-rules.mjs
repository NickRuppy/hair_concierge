const CHAT_PREFIXES = [
  "src/lib/agent/",
  "src/lib/agent-v2/",
  "src/lib/chat-runtime/",
  "src/lib/langfuse/",
  "src/lib/openai/",
  "src/lib/product-matching/",
  "src/lib/recommendation-engine/",
  "src/lib/routines/",
  "src/app/api/chat/",
  "data/agent-guidance/",
  "data/agent-v2/",
  "scripts/eval-chat/",
]

const CHAT_EXACT = ["docs/langfuse-quality-loop.md"]
const CHAT_EXCLUDE = ["src/lib/product-matching/product-list-chunks.ts"]
const CHAT_EXCLUDE_PREFIXES = ["src/lib/routines/personal-plan/application/"]

const RETRIEVAL_PREFIXES = [
  "src/lib/product-matching/product-list-chunks.ts",
  "scripts/ingest-",
  "scripts/eval-retrieval.ts",
  "supabase/migrations/",
]

const RETRIEVAL_EXACT = ["tests/fixtures/retrieval-gold-set.json"]

const PLAYWRIGHT_PREFIXES = [
  "src/app/",
  "src/components/",
  "src/providers/",
  "src/lib/auth/",
  "src/lib/stripe/",
  "src/lib/paypal/",
  "src/lib/supabase/",
  "playwright.config.",
]

const PLAYWRIGHT_EXACT = [
  "src/middleware.ts",
  "next.config.ts",
  "package.json",
  "package-lock.json",
  "tests/e2e-smoke.spec.ts",
  "tests/profile-editorial-v3.spec.ts",
  "tests/profile-page-smoke.spec.ts",
  "tests/helpers/auth.ts",
]

const SECURITY_PREFIXES = [".github/workflows/", "supabase/migrations/"]
const SECURITY_EXACT = ["package.json", "package-lock.json", ".github/dependabot.yml"]

const PERSONAL_PLAN_JOURNEY_PREFIXES = [
  "supabase/migrations/",
  "src/lib/personal-plan/",
  "src/lib/routines/personal-plan/",
  "src/lib/personal-plan-field-test/",
  "src/lib/product-intake/",
  "src/lib/auth/",
  "src/lib/supabase/",
  "src/app/auth/",
  "src/app/api/personal-plan/",
  "src/app/anwendung/",
  "src/app/plan-bereit/",
  "src/app/plan-start/",
  "src/app/routine/",
  "src/app/test/haarplan/",
  "src/components/application/",
  "src/components/auth/",
  "src/components/personal-plan-field-test/",
  "src/components/personal-plan-products/",
  "src/components/personal-plan-refinement/",
  "src/components/personal-plan-start/",
  "src/components/routine/personal-plan/",
  "scripts/personal-plan-field-test-",
  "tests/personal-plan-",
]

const PERSONAL_PLAN_JOURNEY_EXACT = [
  "playwright.config.ts",
  "src/app/chat/layout.tsx",
  "src/app/profile/layout.tsx",
  "src/app/welcome/page.tsx",
  "src/components/layout/authenticated-app-shell.tsx",
  "src/components/layout/personal-plan-navigation.tsx",
  "src/components/routine/routine-page-client.tsx",
  "src/middleware.ts",
  "next.config.ts",
  "package.json",
  "package-lock.json",
  ".github/workflows/ci.yml",
]

function matches(file, prefixes, exact) {
  return exact.includes(file) || prefixes.some((prefix) => file.startsWith(prefix))
}

export function hasFullCiMarker({ prTitle = "", prBody = "" } = {}) {
  return /\[full-ci\]/i.test(`${prTitle}\n${prBody}`)
}

export function classifyCiScope(files, prContext = {}) {
  const fullCi = hasFullCiMarker(prContext) || prContext.forceFullCi === true
  const chatFiles = files.filter(
    (file) =>
      !CHAT_EXCLUDE.includes(file) &&
      !CHAT_EXCLUDE_PREFIXES.some((prefix) => file.startsWith(prefix)),
  )
  return {
    chat_eval: fullCi || chatFiles.some((file) => matches(file, CHAT_PREFIXES, CHAT_EXACT)),
    retrieval_eval:
      fullCi || files.some((file) => matches(file, RETRIEVAL_PREFIXES, RETRIEVAL_EXACT)),
    playwright_smoke:
      fullCi || files.some((file) => matches(file, PLAYWRIGHT_PREFIXES, PLAYWRIGHT_EXACT)),
    security_scan: fullCi || files.some((file) => matches(file, SECURITY_PREFIXES, SECURITY_EXACT)),
    personal_plan_journey:
      fullCi ||
      files.some((file) =>
        matches(file, PERSONAL_PLAN_JOURNEY_PREFIXES, PERSONAL_PLAN_JOURNEY_EXACT),
      ),
    full_ci: fullCi,
  }
}
