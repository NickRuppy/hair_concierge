/**
 * Community DM Chat Processing Pipeline
 *
 * Parses Tom's Skool DM conversations, classifies hair-care relevance,
 * cleans exchanges, extracts metadata, and outputs structured markdown
 * files ready for the ingest-markdown.ts pipeline.
 *
 * Usage: npx tsx scripts/process-community-qa.ts [--dry-run] [--chat <N>]
 *
 * Options:
 *   --dry-run   Parse and show stats without calling AI APIs or writing files
 *   --chat <N>  Only process chat N (for debugging)
 */

import fs from "fs"
import path from "path"
import OpenAI from "openai"

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const ROOT = process.cwd()
const INPUT_FILE = path.join(ROOT, "data", "markdown", "community_qa.md")
const OUTPUT_DIR = path.join(ROOT, "data", "markdown-cleaned", "community-qa")
const MODEL = "gpt-4o-mini"
const RATE_LIMIT_DELAY_MS = 1500
const CLASSIFICATION_BATCH_SIZE = 5

// Load .env.local
const envPath = path.join(ROOT, ".env.local")
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").replace(/\r/g, "").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/)
    if (match && !process.env[match[1].trim()]) {
      process.env[match[1].trim()] = match[2].trim()
    }
  }
}

let _openai: OpenAI | null = null
function getOpenAI() {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
  }
  return _openai
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RawMessage {
  sender: string
  senderUrl: string | null
  time: string
  text: string
  date: string | null
  isTom: boolean
}

interface Chat {
  chatId: number
  memberName: string
  messages: RawMessage[]
}

interface Exchange {
  chatId: number
  exchangeIndex: number
  memberMessages: RawMessage[]
  tomMessages: RawMessage[]
  dateRange: string
}

interface ClassificationResult {
  relevant: boolean
  category: string
  reasoning: string
}

interface ProcessedExchange {
  contextHeader: string
  question: string
  answer: string
  metadata: {
    topics: string[]
    concerns: string[]
    thickness: string | null
    products_mentioned: string[]
    has_photo_reference: boolean
  }
}

// ---------------------------------------------------------------------------
// Step 1: Parse Raw Markdown
// ---------------------------------------------------------------------------

const CHAT_HEADER_RE = /^#{1,2}\s+Chat\s+(\d+)\s*$/
const SENDER_RE = /^\[([^\]]+)\]\((https:\/\/www\.skool\.com\/@[^)]+)\)\s*$/
const TIME_RE = /^\d{1,2}:\d{2}(?:am|pm)\s*$/
const DATE_RE = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}(?:st|nd|rd|th)\s+\d{4}\s*$/
const EMOJI_ONLY_RE = /^[🔥⭐💎👋🏼✨🫶🏼🎉🍀👍🏼]+\s*$/

function parseChats(raw: string): Chat[] {
  const lines = raw.split("\n")
  const chats: Chat[] = []
  let currentChat: Chat | null = null
  let currentSender: string | null = null
  let currentSenderUrl: string | null = null
  let currentTime: string | null = null
  let currentDate: string | null = null
  let bodyLines: string[] = []
  let pendingFirstMessage = false
  let bareTextLines: string[] = []

  function flushMessage() {
    if (currentChat && currentSender && currentTime) {
      const text = bodyLines.join("\n").trim()
      if (text) {
        currentChat.messages.push({
          sender: currentSender,
          senderUrl: currentSenderUrl,
          time: currentTime,
          text,
          date: currentDate,
          isTom: currentSender.includes("Tom Hannemann"),
        })
      }
      bodyLines = []
      currentTime = null
    }
  }

  function flushBareText() {
    if (currentChat && bareTextLines.length > 0) {
      const text = bareTextLines.join("\n").trim()
      if (text && !EMOJI_ONLY_RE.test(text)) {
        currentChat.messages.push({
          sender: currentChat.memberName || "Unknown",
          senderUrl: null,
          time: "unknown",
          text,
          date: currentDate,
          isTom: false,
        })
      }
      bareTextLines = []
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    // Chat header
    const chatMatch = trimmed.match(CHAT_HEADER_RE)
    if (chatMatch) {
      // Flush previous
      flushMessage()
      flushBareText()

      currentChat = {
        chatId: parseInt(chatMatch[1]),
        memberName: "",
        messages: [],
      }
      chats.push(currentChat)
      currentSender = null
      currentSenderUrl = null
      currentTime = null
      pendingFirstMessage = true
      bareTextLines = []
      continue
    }

    if (!currentChat) continue

    // Date marker
    if (DATE_RE.test(trimmed)) {
      flushMessage()
      flushBareText()
      currentDate = trimmed
      continue
    }

    // Sender line
    const senderMatch = trimmed.match(SENDER_RE)
    if (senderMatch) {
      flushMessage()
      flushBareText()
      pendingFirstMessage = false

      currentSender = senderMatch[1]
      currentSenderUrl = senderMatch[2]

      // Track member name (first non-Tom sender)
      if (!currentSender.includes("Tom Hannemann") && !currentChat.memberName) {
        currentChat.memberName = currentSender
      }

      continue
    }

    // Time line
    if (TIME_RE.test(trimmed)) {
      // If we already have a time set (consecutive message from same sender), flush first
      if (currentTime && currentSender) {
        flushMessage()
      }
      currentTime = trimmed
      bodyLines = []
      continue
    }

    // Skip empty lines
    if (!trimmed) continue

    // Skip title line
    if (trimmed === "# Chats Tom") continue

    // If we're right after a chat header and haven't seen a sender yet, this is bare text
    if (pendingFirstMessage && !currentSender) {
      bareTextLines.push(trimmed)
      continue
    }

    // Body text
    if (currentSender && currentTime) {
      bodyLines.push(trimmed)
    } else if (currentSender && !currentTime) {
      // Text between sender changes without a time (e.g., continuation)
      bodyLines.push(trimmed)
    } else {
      // Bare text (no sender identified yet in this chat)
      bareTextLines.push(trimmed)
    }
  }

  // Flush last message
  flushMessage()
  flushBareText()

  // Post-process: merge consecutive messages from the same sender
  for (const chat of chats) {
    chat.messages = mergeConsecutiveMessages(chat.messages)

    // If memberName wasn't set (bare text start), try to find from messages
    if (!chat.memberName) {
      const firstMember = chat.messages.find((m) => !m.isTom)
      if (firstMember) {
        chat.memberName = firstMember.sender
      }
    }
  }

  return chats
}

function mergeConsecutiveMessages(messages: RawMessage[]): RawMessage[] {
  if (messages.length <= 1) return messages

  const merged: RawMessage[] = [messages[0]]

  for (let i = 1; i < messages.length; i++) {
    const prev = merged[merged.length - 1]
    const curr = messages[i]

    // Merge if same sender and same date
    if (prev.sender === curr.sender && prev.date === curr.date) {
      prev.text = prev.text + "\n" + curr.text
    } else {
      merged.push(curr)
    }
  }

  return merged
}

// ---------------------------------------------------------------------------
// Step 2: Group into Q&A Exchanges
// ---------------------------------------------------------------------------

function groupExchanges(chat: Chat): Exchange[] {
  const exchanges: Exchange[] = []
  let memberMsgs: RawMessage[] = []
  let exchangeIdx = 0

  for (const msg of chat.messages) {
    if (msg.isTom) {
      // Tom is responding — pair with accumulated member messages
      if (memberMsgs.length > 0 || exchanges.length === 0) {
        const exchange: Exchange = {
          chatId: chat.chatId,
          exchangeIndex: exchangeIdx++,
          memberMessages: [...memberMsgs],
          tomMessages: [msg],
          dateRange: buildDateRange(memberMsgs, [msg]),
        }
        exchanges.push(exchange)
        memberMsgs = []
      } else {
        // Tom sends another message without new member question — append to last exchange
        const lastExchange = exchanges[exchanges.length - 1]
        lastExchange.tomMessages.push(msg)
        lastExchange.dateRange = buildDateRange(
          lastExchange.memberMessages,
          lastExchange.tomMessages
        )
      }
    } else {
      memberMsgs.push(msg)
    }
  }

  // Remaining member messages with no Tom response — skip
  // (unanswered questions aren't useful without Tom's answer)

  return exchanges
}

function buildDateRange(memberMsgs: RawMessage[], tomMsgs: RawMessage[]): string {
  const allDates = [...memberMsgs, ...tomMsgs]
    .map((m) => m.date)
    .filter((d): d is string => d !== null)

  if (allDates.length === 0) return ""

  const unique = [...new Set(allDates)]
  if (unique.length === 1) return unique[0]
  return `${unique[0]} - ${unique[unique.length - 1]}`
}

// ---------------------------------------------------------------------------
// Step 3: AI Classification
// ---------------------------------------------------------------------------

const CLASSIFICATION_PROMPT = `Du bist ein Klassifikator für Haarpflege-Inhalte. Bewerte den folgenden Chat-Austausch zwischen einem Community-Mitglied und Tom Hannemann (Haarpflege-Experte).

Klassifiziere als RELEVANT wenn der Austausch mindestens eines enthält:
- Haarpflege-Ratschläge oder -Tipps
- Produktempfehlungen oder -bewertungen
- Haarprobleme und deren Lösung (Spliss, Haarbruch, Schuppen, etc.)
- Routinen-Optimierung
- Kopfhautpflege
- Styling-Tipps
- Haarfarbe / Färbung / Elumen
- Haarschnitt- oder Friseur-Empfehlungen mit fachlichem Inhalt
- Inhaltsstoff-Bewertungen (INCI)
- Follow-up zu vorherigen Haarpflege-Empfehlungen (z.B. "Update: es hat funktioniert")

Klassifiziere als NICHT RELEVANT wenn der Austausch NUR enthält:
- Terminplanung / Zoom-Links / Logistik
- Soziale Grüße / Weihnachtswünsche / Danksagungen ohne Haarinhalt
- Geschäftsideen / Community-Meta-Diskussion
- Gewinnspiele / Rabattcodes ohne Produktkontext
- Rein persönliche Updates ohne Haarbezug

Bei GEMISCHTEN Nachrichten (z.B. soziale Grüße + Haarfrage): Klassifiziere als RELEVANT.

Antwort AUSSCHLIESSLICH im JSON-Format:
{"relevant": true/false, "category": "routine|product_question|diagnosis|styling|scalp_issue|color|haircut|logistics|social|other", "reasoning": "kurze Begründung"}`

async function classifyExchange(exchange: Exchange): Promise<ClassificationResult> {
  const exchangeText = formatExchangeForAI(exchange)

  try {
    const response = await getOpenAI().chat.completions.create({
      model: MODEL,
      temperature: 0,
      max_tokens: 200,
      messages: [
        { role: "system", content: CLASSIFICATION_PROMPT },
        { role: "user", content: exchangeText },
      ],
    })

    const raw = response.choices[0]?.message?.content?.trim() || ""
    // Extract JSON from response (handle possible markdown wrapping)
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      return {
        relevant: Boolean(parsed.relevant),
        category: parsed.category || "other",
        reasoning: parsed.reasoning || "",
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    process.stderr.write(`  Warning: classification failed for chat ${exchange.chatId}[${exchange.exchangeIndex}]: ${msg}\n`)
  }

  // Default to relevant on failure (safer to keep than to drop)
  return { relevant: true, category: "other", reasoning: "classification failed" }
}

async function classifyBatch(exchanges: Exchange[]): Promise<Map<string, ClassificationResult>> {
  const results = new Map<string, ClassificationResult>()

  for (let i = 0; i < exchanges.length; i += CLASSIFICATION_BATCH_SIZE) {
    const batch = exchanges.slice(i, i + CLASSIFICATION_BATCH_SIZE)
    const promises = batch.map(async (ex) => {
      const key = `${ex.chatId}-${ex.exchangeIndex}`
      const result = await classifyExchange(ex)
      results.set(key, result)
    })
    await Promise.all(promises)

    process.stdout.write(`  Classified: ${Math.min(i + CLASSIFICATION_BATCH_SIZE, exchanges.length)}/${exchanges.length}\r`)

    if (i + CLASSIFICATION_BATCH_SIZE < exchanges.length) {
      await delay(RATE_LIMIT_DELAY_MS)
    }
  }

  console.log(`  Classified: ${exchanges.length}/${exchanges.length} done`)
  return results
}

// ---------------------------------------------------------------------------
// Step 4: AI Cleaning + Context Header + Metadata Extraction
// ---------------------------------------------------------------------------

const PROCESSING_PROMPT = `Du erhältst einen Chat-Austausch zwischen einem Community-Mitglied und Tom Hannemann (Haarpflege-Experte), zusammen mit dem bisherigen Gesprächsverlauf für Kontext.

WICHTIG: Verwende "Das Mitglied" statt des Namens der Person. Nenne niemals den echten Namen des Mitglieds.

Aufgaben:

1. KONTEXT-HEADER: Schreibe 1-3 kurze Sätze auf Deutsch, die die Haarsituation des Mitglieds zusammenfassen (Haartyp, Textur, bekannte Probleme, bisherige Routine) basierend auf dem Gesprächsverlauf. Wenn keine Informationen vorliegen, schreibe "Keine Vorinformationen zum Haarprofil."

2. FRAGE BEREINIGEN: Bereinige die Mitglied-Nachricht(en):
   - Entferne Verweise auf Fotos/Bilder ("Anbei ein Foto", "Bild schick ich dir", "Hier noch das Bild")
   - Korrigiere offensichtliche Tippfehler
   - Entferne reine Grußformeln am Anfang/Ende wenn sie keinen Kontext liefern
   - Behalte Produktnamen, Links und fachliche Details bei
   - Bewahre den natürlichen Gesprächston
   - Entferne Emojis

3. ANTWORT BEREINIGEN: Bereinige Toms Antwort:
   - Gleiche Regeln wie oben
   - Behalte Produkt-Links (dm.de, Amazon etc.) bei
   - Entferne Rabattcodes und Affiliate-Hinweise (z.B. "mit meinem Code")
   - Behalte Toms persönlichen Stil bei

4. METADATEN EXTRAHIEREN als JSON:
   - topics: Array von Themen-Stichworten auf Deutsch (z.B. ["Spliss", "Kolaplex", "Haarschnitt"])
   - concerns: Array aus diesen Werten wenn zutreffend: ["Haarausfall", "Schuppen", "Trockenheit", "Fettige Kopfhaut", "Haarschaeden", "Coloriert", "Spliss", "Frizz", "Duenner werdendes Haar"]
   - thickness: "fine" oder "normal" oder "coarse" oder null (nur wenn explizit erwähnt oder klar ableitbar)
   - products_mentioned: Array aller erwähnten Produktnamen
   - has_photo_reference: true wenn der Austausch auf ein Foto verweist das wir nicht haben

Antwort EXAKT in diesem Format (jede Sektion muss vorhanden sein):
---CONTEXT---
[context header text]
---QUESTION---
[cleaned question]
---ANSWER---
[cleaned answer]
---METADATA---
{"topics":[],"concerns":[],"thickness":null,"products_mentioned":[],"has_photo_reference":false}`

async function processExchange(
  exchange: Exchange,
  priorContext: string
): Promise<ProcessedExchange | null> {
  const exchangeText = formatExchangeForAI(exchange)

  const userMessage = priorContext
    ? `<bisheriger_kontext>\n${priorContext}\n</bisheriger_kontext>\n\n<aktueller_austausch>\n${exchangeText}\n</aktueller_austausch>`
    : `<aktueller_austausch>\n${exchangeText}\n</aktueller_austausch>`

  try {
    const response = await getOpenAI().chat.completions.create({
      model: MODEL,
      temperature: 0.1,
      max_tokens: 2000,
      messages: [
        { role: "system", content: PROCESSING_PROMPT },
        { role: "user", content: userMessage },
      ],
    })

    const raw = response.choices[0]?.message?.content?.trim() || ""
    return parseProcessingResponse(raw)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    process.stderr.write(`  Warning: processing failed for chat ${exchange.chatId}[${exchange.exchangeIndex}]: ${msg}\n`)
    return null
  }
}

function parseProcessingResponse(raw: string): ProcessedExchange | null {
  const contextMatch = raw.match(/---CONTEXT---\s*([\s\S]*?)---QUESTION---/)
  const questionMatch = raw.match(/---QUESTION---\s*([\s\S]*?)---ANSWER---/)
  const answerMatch = raw.match(/---ANSWER---\s*([\s\S]*?)---METADATA---/)
  const metadataMatch = raw.match(/---METADATA---\s*([\s\S]*)$/)

  if (!contextMatch || !questionMatch || !answerMatch || !metadataMatch) {
    return null
  }

  const context = contextMatch[1].trim()
  const question = questionMatch[1].trim()
  const answer = answerMatch[1].trim()

  // Parse metadata JSON
  let metadata = {
    topics: [] as string[],
    concerns: [] as string[],
    thickness: null as string | null,
    products_mentioned: [] as string[],
    has_photo_reference: false,
  }

  try {
    const jsonStr = metadataMatch[1].trim()
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      metadata = {
        topics: Array.isArray(parsed.topics) ? parsed.topics : [],
        concerns: Array.isArray(parsed.concerns) ? parsed.concerns : [],
        thickness: parsed.thickness || null,
        products_mentioned: Array.isArray(parsed.products_mentioned) ? parsed.products_mentioned : [],
        has_photo_reference: Boolean(parsed.has_photo_reference),
      }
    }
  } catch {
    // Use defaults on parse failure
  }

  if (!question || !answer) return null

  return { contextHeader: context, question, answer, metadata }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatExchangeForAI(exchange: Exchange): string {
  const parts: string[] = []

  if (exchange.memberMessages.length > 0) {
    const memberText = exchange.memberMessages.map((m) => m.text).join("\n")
    parts.push(`[Mitglied]:\n${memberText}`)
  }

  if (exchange.tomMessages.length > 0) {
    const tomText = exchange.tomMessages.map((m) => m.text).join("\n")
    parts.push(`[Tom Hannemann]:\n${tomText}`)
  }

  return parts.join("\n\n")
}

function buildCumulativeContext(
  processedSoFar: ProcessedExchange[],
  maxLength: number = 600
): string {
  if (processedSoFar.length === 0) return ""

  // Build a summary from context headers and key topics of prior exchanges
  const summaryParts: string[] = []

  for (const pe of processedSoFar) {
    if (pe.contextHeader && pe.contextHeader !== "Keine Vorinformationen zum Haarprofil.") {
      summaryParts.push(pe.contextHeader)
    }
    // Add a brief Q&A hint
    const qSnippet = pe.question.slice(0, 80)
    const aSnippet = pe.answer.slice(0, 80)
    summaryParts.push(`Frage: ${qSnippet}... → Antwort: ${aSnippet}...`)
  }

  let result = summaryParts.join("\n")
  if (result.length > maxLength) {
    // Keep the latest context, trim older
    result = result.slice(result.length - maxLength)
    // Clean up to start at a sentence boundary
    const firstNewline = result.indexOf("\n")
    if (firstNewline > 0 && firstNewline < 100) {
      result = result.slice(firstNewline + 1)
    }
  }

  return result
}

// ---------------------------------------------------------------------------
// Step 5: Output Markdown Files
// ---------------------------------------------------------------------------

function writeOutputFile(
  chat: Chat,
  processedExchanges: { exchange: Exchange; processed: ProcessedExchange }[]
): void {
  const chatNum = String(chat.chatId).padStart(2, "0")
  const filePath = path.join(OUTPUT_DIR, `chat-${chatNum}.md`)

  const frontMatter = [
    "---",
    `source_type: "community_qa"`,
    `chat_id: "${chat.chatId}"`,
    `exchange_count: "${processedExchanges.length}"`,
    `speaker: "Tom"`,
    `language: "de"`,
    "---",
  ].join("\n")

  const title = `# Community Q&A: Chat ${chatNum}`

  const exchangeBlocks = processedExchanges.map(({ processed }) => {
    const metadataJson = JSON.stringify(processed.metadata)
    return [
      `**Kontext:** ${processed.contextHeader}`,
      "",
      `**Frage:** ${processed.question}`,
      "",
      `**Antwort:** ${processed.answer}`,
      "",
      `<!-- metadata: ${metadataJson} -->`,
    ].join("\n")
  })

  const content = [frontMatter, "", title, "", "---", "", exchangeBlocks.join("\n\n---\n\n"), ""].join("\n")

  fs.writeFileSync(filePath, content, "utf-8")
}

// ---------------------------------------------------------------------------
// Main Pipeline
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes("--dry-run")
  const chatFilterIdx = args.indexOf("--chat")
  const chatFilter = chatFilterIdx !== -1 ? parseInt(args[chatFilterIdx + 1]) : null

  console.log("=".repeat(60))
  console.log("Community DM Chat Processing Pipeline")
  if (dryRun) console.log("(DRY RUN - no API calls, no file writes)")
  if (chatFilter !== null) console.log(`(FILTER: only Chat ${chatFilter})`)
  console.log("=".repeat(60))

  // Read input
  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`Error: ${INPUT_FILE} not found.`)
    process.exit(1)
  }

  const raw = fs.readFileSync(INPUT_FILE, "utf-8")
  console.log(`\nInput: ${INPUT_FILE} (${raw.length} chars)`)

  // Step 1: Parse
  console.log("\n--- Step 1: Parsing chats ---")
  let chats = parseChats(raw)
  console.log(`Parsed ${chats.length} chats`)

  if (chatFilter !== null) {
    chats = chats.filter((c) => c.chatId === chatFilter)
    if (chats.length === 0) {
      console.error(`No chat found with ID ${chatFilter}`)
      process.exit(1)
    }
  }

  // Step 2: Group exchanges
  console.log("\n--- Step 2: Grouping exchanges ---")
  const allExchanges: { chat: Chat; exchange: Exchange }[] = []

  for (const chat of chats) {
    const exchanges = groupExchanges(chat)
    for (const ex of exchanges) {
      allExchanges.push({ chat, exchange: ex })
    }
    console.log(`  Chat ${chat.chatId} (${chat.memberName}): ${chat.messages.length} messages → ${exchanges.length} exchanges`)
  }

  const totalExchanges = allExchanges.length
  console.log(`Total: ${totalExchanges} exchanges across ${chats.length} chats`)

  if (dryRun) {
    console.log("\n--- Dry Run Summary ---")
    console.log(`${"Chat".padEnd(6)} ${"Member".padEnd(25)} ${"Messages".padStart(8)} ${"Exchanges".padStart(10)}`)
    console.log("-".repeat(55))
    for (const chat of chats) {
      const exchanges = groupExchanges(chat)
      console.log(
        `${String(chat.chatId).padEnd(6)} ${chat.memberName.padEnd(25)} ${String(chat.messages.length).padStart(8)} ${String(exchanges.length).padStart(10)}`
      )
    }
    console.log("-".repeat(55))
    console.log(`Total: ${chats.length} chats, ${totalExchanges} exchanges`)
    console.log(`\nEstimated API cost: ~$${(totalExchanges * 0.0006).toFixed(2)}`)
    console.log("=".repeat(60))
    return
  }

  // Create output directory
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })

  // Step 3: Classify all exchanges
  console.log("\n--- Step 3: Classifying exchanges ---")
  const classifications = await classifyBatch(
    allExchanges.map((e) => e.exchange)
  )

  let relevantCount = 0
  let filteredCount = 0
  const categoryStats: Record<string, number> = {}

  for (const [key, result] of classifications) {
    categoryStats[result.category] = (categoryStats[result.category] || 0) + 1
    if (result.relevant) {
      relevantCount++
    } else {
      filteredCount++
    }
  }

  console.log(`  Relevant: ${relevantCount}, Filtered out: ${filteredCount}`)
  console.log(`  Categories: ${JSON.stringify(categoryStats, null, 0)}`)

  await delay(RATE_LIMIT_DELAY_MS)

  // Step 4: Process relevant exchanges per chat
  console.log("\n--- Step 4: Processing relevant exchanges ---")
  let processedTotal = 0

  for (const chat of chats) {
    const chatExchanges = allExchanges
      .filter((e) => e.chat.chatId === chat.chatId)
      .filter((e) => {
        const key = `${e.exchange.chatId}-${e.exchange.exchangeIndex}`
        return classifications.get(key)?.relevant !== false
      })

    if (chatExchanges.length === 0) {
      console.log(`  Chat ${chat.chatId} (${chat.memberName}): no relevant exchanges, skipping`)
      continue
    }

    console.log(`  Chat ${chat.chatId} (${chat.memberName}): processing ${chatExchanges.length} exchanges...`)

    const processedExchanges: { exchange: Exchange; processed: ProcessedExchange }[] = []
    const processedSoFar: ProcessedExchange[] = []

    for (const { exchange } of chatExchanges) {
      const priorContext = buildCumulativeContext(processedSoFar)
      const result = await processExchange(exchange, priorContext)

      if (result) {
        processedExchanges.push({ exchange, processed: result })
        processedSoFar.push(result)
        processedTotal++
      }

      await delay(RATE_LIMIT_DELAY_MS)
    }

    // Step 5: Write output file
    if (processedExchanges.length > 0) {
      writeOutputFile(chat, processedExchanges)
      const chatNum = String(chat.chatId).padStart(2, "0")
      console.log(`    → Written: community-qa/chat-${chatNum}.md (${processedExchanges.length} exchanges)`)
    }
  }

  // Summary
  console.log(`\n${"=".repeat(60)}`)
  console.log("SUMMARY")
  console.log("=".repeat(60))
  console.log(`Chats processed:     ${chats.length}`)
  console.log(`Total exchanges:     ${totalExchanges}`)
  console.log(`Classified relevant: ${relevantCount}`)
  console.log(`Filtered out:        ${filteredCount}`)
  console.log(`Successfully processed: ${processedTotal}`)
  console.log(`Output: ${OUTPUT_DIR}/`)
  console.log("=".repeat(60))
}

main().catch(console.error)
