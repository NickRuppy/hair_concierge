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

const CHAT_EXACT = [
  "docs/langfuse-quality-loop.md",
]
const CHAT_EXCLUDE = ["src/lib/product-matching/product-list-chunks.ts"]

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

const PERSONAL_PLAN_DB_PREFIXES = [
  "supabase/migrations/",
  "supabase/tests/",
  "src/lib/personal-plan/",
  "src/lib/product-intake/",
  "src/app/api/personal-plan/",
  "src/app/anwendung/",
  "src/app/plan-bereit/",
  "src/app/plan-start/",
  "src/app/routine/",
  "src/components/application/",
  "src/components/personal-plan-products/",
  "src/components/personal-plan-refinement/",
  "src/components/personal-plan-start/",
  "src/components/routine/personal-plan/",
]

const PERSONAL_PLAN_DB_EXACT = [
  "scripts/ci/prepare-personal-plan-db-transition.mjs",
  "scripts/test-personal-plan-db.sh",
  "scripts/test-personal-plan-stage1-5-browser.sh",
  "scripts/test-personal-plan-stage4-browser.sh",
  "scripts/test-personal-plan-stage5-browser.sh",
  "tests/personal-plan-stage1-5.spec.ts",
  "tests/personal-plan-stage4-routine.spec.ts",
  "tests/personal-plan-stage5-application.spec.ts",
  "src/app/chat/layout.tsx",
  "src/app/profile/layout.tsx",
  "src/app/welcome/page.tsx",
  "src/components/layout/authenticated-app-shell.tsx",
  "src/components/layout/personal-plan-navigation.tsx",
  "src/components/routine/routine-page-client.tsx",
  "package.json",
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
  const chatFiles = files.filter((file) => !CHAT_EXCLUDE.includes(file))
  return {
    chat_eval: fullCi || chatFiles.some((file) => matches(file, CHAT_PREFIXES, CHAT_EXACT)),
    retrieval_eval:
      fullCi || files.some((file) => matches(file, RETRIEVAL_PREFIXES, RETRIEVAL_EXACT)),
    playwright_smoke:
      fullCi || files.some((file) => matches(file, PLAYWRIGHT_PREFIXES, PLAYWRIGHT_EXACT)),
    security_scan:
      fullCi || files.some((file) => matches(file, SECURITY_PREFIXES, SECURITY_EXACT)),
    personal_plan_db:
      fullCi || files.some((file) => matches(file, PERSONAL_PLAN_DB_PREFIXES, PERSONAL_PLAN_DB_EXACT)),
    full_ci: fullCi,
  }
}
