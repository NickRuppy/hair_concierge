/**
 * Q&A Validation Test
 *
 * Sends curated questions from Tom's community Q&A through the Hair Concierge
 * chat and captures AI responses for manual comparison.
 *
 * Usage:
 *   1. npm run dev  (start the dev server)
 *   2. npm run test:extract  (generate fixtures if not already done)
 *   3. npm run test:qa  (run this test)
 *   4. Review results in tests/results/qa-responses-{timestamp}.json
 */

import { test } from "@playwright/test"
import fs from "fs"
import path from "path"
import { authenticatePage } from "./helpers/auth"

interface QAFixture {
  id: string
  chat_id: string
  context: string
  question: string
  tom_answer: string
  hair_texture: string | null
  topics: string[]
  is_standalone: boolean
}

interface QATestResult {
  fixture_id: string
  question: string
  tom_answer: string
  ai_answer: string
  timestamp: string
  error?: string
}

// ------------------------------------------------------------------
// Hand-curated fixture IDs for good topic coverage.
// After running extract, review qa-pairs.json and update this list.
// ------------------------------------------------------------------
const CURATED_IDS = [
  "chat-01-q01", // Kolaplex gegen Haarbruch, Spliss, Olaplex timing
  "chat-03-q01", // Kopfhautprobleme (Schuppen, Jucken, Ketozolin)
  "chat-04-q01", // Feines Haar, Volumen, Pflegeroutine
  "chat-05-q01", // Weiches Wasser, Elumen Care, Leave-in
  "chat-06-q01", // Lockenpflege, Curly Girl Methode
  "chat-08-q01", // Haarausfall, mögliche Ursachen
  "chat-09-q01", // Blondierung, Haarpflege danach
  "chat-10-q01", // Graue Haare, Silbershampoo
  "chat-12-q01", // Frizz, Haarstruktur verbessern
  "chat-14-q01", // Spliss + Blondierung Vorbereitung
  "chat-14-q04", // Feines Haar, Leave-in Empfehlungen (Lipide)
  "chat-15-q01", // Trockene Kopfhaut, Schuppen
  "chat-18-q01", // Haarausfall nach Schwangerschaft
  "chat-20-q01", // Lockenstyling, Produkte
  "chat-22-q01", // Haarfarbe, Colorierung
  "chat-25-q01", // Hitze-Styling, Hitzeschutz
]

// Load fixtures
const FIXTURES_PATH = path.resolve("tests/fixtures/qa-pairs.json")
const RESULTS_DIR = path.resolve("tests/results")

function loadFixtures(): QAFixture[] {
  if (!fs.existsSync(FIXTURES_PATH)) {
    throw new Error(
      `Fixtures not found at ${FIXTURES_PATH}. Run: npm run test:extract`
    )
  }
  return JSON.parse(fs.readFileSync(FIXTURES_PATH, "utf-8"))
}

function getCuratedFixtures(): QAFixture[] {
  const all = loadFixtures()
  const byId = new Map(all.map((f) => [f.id, f]))
  const curated: QAFixture[] = []

  for (const id of CURATED_IDS) {
    const fixture = byId.get(id)
    if (fixture) {
      curated.push(fixture)
    } else {
      console.warn(`Curated fixture ${id} not found — skipping`)
    }
  }

  return curated
}

// ------------------------------------------------------------------
// Test
// ------------------------------------------------------------------

test.describe("Q&A Validation", () => {
  const results: QATestResult[] = []
  let fixtures: QAFixture[] = []

  test.beforeAll(() => {
    fixtures = getCuratedFixtures()
    fs.mkdirSync(RESULTS_DIR, { recursive: true })
    console.log(`Loaded ${fixtures.length} curated fixtures for testing`)
  })

  test.afterAll(() => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
    const outPath = path.join(RESULTS_DIR, `qa-responses-${timestamp}.json`)
    fs.writeFileSync(outPath, JSON.stringify(results, null, 2), "utf-8")
    console.log(`\nResults written to ${outPath}`)
    console.log(`  Total: ${results.length}`)
    console.log(`  Errors: ${results.filter((r) => r.error).length}`)
  })

  test("send curated questions and capture AI responses", async ({ page }) => {
    // Authenticate
    await authenticatePage(page)

    for (let i = 0; i < fixtures.length; i++) {
      const fixture = fixtures[i]
      console.log(
        `\n[${i + 1}/${fixtures.length}] ${fixture.id}: ${fixture.question.slice(0, 60)}...`
      )

      const result: QATestResult = {
        fixture_id: fixture.id,
        question: fixture.question,
        tom_answer: fixture.tom_answer,
        ai_answer: "",
        timestamp: new Date().toISOString(),
      }

      try {
        // Navigate to /chat for a fresh conversation
        await page.goto("/chat", { waitUntil: "networkidle" })

        // Build the prompt: prepend context if available
        let prompt = fixture.question
        if (fixture.context) {
          prompt = `Kontext: ${fixture.context}\n\nFrage: ${fixture.question}`
        }

        // Fill and send
        const input = page.locator('[data-testid="chat-input"]')
        await input.waitFor({ state: "visible", timeout: 10_000 })
        await input.fill(prompt)

        const sendBtn = page.locator('[data-testid="chat-send"]')
        await sendBtn.click()

        // Wait for the assistant message to appear and stabilize
        const assistantMsg = page.locator(
          '[data-testid="message-assistant"]'
        ).last()
        await assistantMsg.waitFor({ state: "visible", timeout: 30_000 })

        // Poll until content stabilizes (no changes for 1.5s) or timeout at 90s
        let previousText = ""
        let stableCount = 0
        const maxWaitMs = 90_000
        const pollIntervalMs = 500
        const stableThreshold = 3 // 3 polls x 500ms = 1.5s stable
        const startTime = Date.now()

        while (Date.now() - startTime < maxWaitMs) {
          const currentText =
            (await assistantMsg.textContent()) ?? ""

          if (currentText === previousText && currentText.length > 0) {
            stableCount++
            if (stableCount >= stableThreshold) break
          } else {
            stableCount = 0
          }

          previousText = currentText
          await page.waitForTimeout(pollIntervalMs)
        }

        result.ai_answer = previousText.trim()
        console.log(
          `  AI response (${result.ai_answer.length} chars): ${result.ai_answer.slice(0, 100)}...`
        )
      } catch (err) {
        result.error =
          err instanceof Error ? err.message : String(err)
        console.error(`  ERROR: ${result.error}`)
      }

      results.push(result)

      // Rate limit pause between questions (2.5s)
      if (i < fixtures.length - 1) {
        await page.waitForTimeout(2_500)
      }
    }
  })
})
