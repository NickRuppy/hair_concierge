const CHAT_PREFIXES = [
  "src/lib/agent/",
  "src/lib/agent-v2/",
  "src/lib/langfuse/",
  "src/lib/openai/",
  "src/lib/recommendation-engine/",
  "src/lib/rag/",
  "src/lib/routines/",
  "src/app/api/chat/",
  "data/agent-guidance/",
  "data/agent-v2/",
  "scripts/eval-chat/",
]

const CHAT_EXACT = ["docs/langfuse-quality-loop.md"]

const RETRIEVAL_PREFIXES = [
  "src/lib/rag/retrieval/",
  "src/lib/rag/retriever.ts",
  "src/lib/rag/product-list-chunks.ts",
  "src/lib/rag/retrieval-telemetry.ts",
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

function matches(file, prefixes, exact) {
  return exact.includes(file) || prefixes.some((prefix) => file.startsWith(prefix))
}

export function hasFullCiMarker({ prTitle = "", prBody = "" } = {}) {
  return /\[full-ci\]/i.test(`${prTitle}\n${prBody}`)
}

export function classifyCiScope(files, prContext = {}) {
  const fullCi = hasFullCiMarker(prContext)
  return {
    chat_eval: fullCi || files.some((file) => matches(file, CHAT_PREFIXES, CHAT_EXACT)),
    retrieval_eval:
      fullCi || files.some((file) => matches(file, RETRIEVAL_PREFIXES, RETRIEVAL_EXACT)),
    playwright_smoke:
      fullCi || files.some((file) => matches(file, PLAYWRIGHT_PREFIXES, PLAYWRIGHT_EXACT)),
    security_scan:
      fullCi || files.some((file) => matches(file, SECURITY_PREFIXES, SECURITY_EXACT)),
    full_ci: fullCi,
  }
}
