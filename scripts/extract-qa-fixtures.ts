/**
 * Extract Q&A fixtures from community-qa markdown files.
 * Parses Kontext/Frage/Antwort structure and metadata comments.
 * Output: tests/fixtures/qa-pairs.json
 */

import fs from "fs"
import path from "path"

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

const QA_DIR = path.resolve("data/markdown-cleaned/community-qa")
const OUTPUT = path.resolve("tests/fixtures/qa-pairs.json")

// Patterns that indicate a follow-up question (not standalone)
const FOLLOW_UP_PREFIXES = [
  /^Auch\b/i,
  /^Und noch\b/i,
  /^Dazu noch\b/i,
  /^Noch eine/i,
  /^Dazu /i,
]

function parseExchanges(content: string, chatId: string): QAFixture[] {
  const fixtures: QAFixture[] = []

  // Strip YAML frontmatter
  const withoutFrontmatter = content.replace(/^---[\s\S]*?---\n/, "")

  // Split by `---` separator (exchange boundaries)
  const blocks = withoutFrontmatter
    .split(/\n---\n/)
    .map((b) => b.trim())
    .filter((b) => b.length > 0)

  let qIndex = 0

  for (const block of blocks) {
    // Skip the title line (# Community Q&A: Chat NN)
    if (/^#\s+Community Q&A/.test(block) && !block.includes("**Kontext:**")) {
      continue
    }

    // Extract fields via regex
    const contextMatch = block.match(/\*\*Kontext:\*\*\s*([\s\S]*?)(?=\n\n\*\*Frage:\*\*)/s)
    const questionMatch = block.match(/\*\*Frage:\*\*\s*([\s\S]*?)(?=\n\n\*\*Antwort:\*\*)/s)
    const answerMatch = block.match(/\*\*Antwort:\*\*\s*([\s\S]*?)(?=\n\n<!--\s*metadata:|$)/s)
    const metadataMatch = block.match(/<!--\s*metadata:\s*(\{[\s\S]*?\})\s*-->/)

    if (!questionMatch || !answerMatch) continue

    const context = contextMatch?.[1]?.trim() ?? ""
    const question = questionMatch[1].trim()
    const tomAnswer = answerMatch[1].trim()

    // Parse metadata
    let hairTexture: string | null = null
    let topics: string[] = []
    if (metadataMatch) {
      try {
        const meta = JSON.parse(metadataMatch[1])
        hairTexture = meta.hair_texture ?? null
        topics = meta.topics ?? []
      } catch {
        // skip malformed metadata
      }
    }

    // Determine standalone status
    const isFollowUp = FOLLOW_UP_PREFIXES.some((re) => re.test(question))
    const isTooShort = question.length <= 40
    const isStandalone = !isFollowUp && !isTooShort

    qIndex++
    const paddedChat = chatId.padStart(2, "0")
    const paddedQ = String(qIndex).padStart(2, "0")

    fixtures.push({
      id: `chat-${paddedChat}-q${paddedQ}`,
      chat_id: chatId,
      context,
      question,
      tom_answer: tomAnswer,
      hair_texture: hairTexture,
      topics,
      is_standalone: isStandalone,
    })
  }

  return fixtures
}

function main() {
  const files = fs
    .readdirSync(QA_DIR)
    .filter((f) => f.startsWith("chat-") && f.endsWith(".md"))
    .sort()

  const allFixtures: QAFixture[] = []

  for (const file of files) {
    const chatId = file.replace("chat-", "").replace(".md", "")
    const content = fs.readFileSync(path.join(QA_DIR, file), "utf-8")
    const fixtures = parseExchanges(content, chatId)
    allFixtures.push(...fixtures)
  }

  const standalone = allFixtures.filter((f) => f.is_standalone)

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true })
  fs.writeFileSync(OUTPUT, JSON.stringify(allFixtures, null, 2), "utf-8")

  console.log(`Extracted ${allFixtures.length} Q&A pairs from ${files.length} files`)
  console.log(`  Standalone: ${standalone.length}`)
  console.log(`  Follow-up/short: ${allFixtures.length - standalone.length}`)
  console.log(`Written to ${OUTPUT}`)
}

main()
