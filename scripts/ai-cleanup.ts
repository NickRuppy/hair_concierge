/**
 * Phase 2: AI-Assisted Deep Transcript Rewrite
 *
 * Processes each pre-cleaned transcript through OpenAI GPT-4o to:
 * - Add ## section headers at topic transitions
 * - Fix remaining context-dependent transcription errors
 * - Trim conversational filler (also, halt, eben, quasi, repeated false starts)
 * - Merge fragmented sentences into complete ones
 * - Preserve Tom's teaching voice and personality
 * - For live calls: preserve Q&A structure (each caller's question = a section)
 *
 * Usage: npx tsx scripts/ai-cleanup.ts [--dry-run] [--file <path>] [--start-from <path>] [--only-failed]
 *
 * Options:
 *   --dry-run       Show what would be processed without calling the API
 *   --file <path>   Only process a single file (relative to markdown-cleaned/)
 *   --start-from    Resume processing from this file (skips earlier ones)
 *   --only-failed   Re-process only the known-broken files (all live calls + 4 course transcripts)
 */

import fs from "fs"
import path from "path"
import OpenAI from "openai"

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const ROOT = process.cwd()
const INPUT_BASE = path.join(ROOT, "data", "markdown-cleaned")
const INPUT_DIRS = [
  path.join(INPUT_BASE, "course-transcripts"),
  path.join(INPUT_BASE, "live-calls"),
]

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

const MODEL = "gpt-4o"
const MAX_TOKENS = 16384
const RATE_LIMIT_DELAY_MS = 2000

// Split thresholds: course files process as single-pass (all <50K),
// live calls use full-context multi-pass strategy
const COURSE_SPLIT_THRESHOLD = 50000
const LIVE_CALL_SEGMENT_SIZE = 8000

// The 17 files with known Phase 2 quality issues (4 course + 13 live calls)
const FAILED_COURSE_FILES = [
  "course-transcripts/styling-basics/01-haarstyling-basics.md",
  "course-transcripts/basics-2/03-haarfarben-guide-toenung-direktzieher-permanente-farbe.md",
  "course-transcripts/advanced/02-bond-builder.md",
  "course-transcripts/advanced/01-hair-oiling.md",
]

let _openai: OpenAI | null = null
function getOpenAI() {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
  }
  return _openai
}

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

const COURSE_TRANSCRIPT_PROMPT = `Du bist ein professioneller Redakteur für deutschsprachige Bildungsinhalte zum Thema Haarpflege.

Deine Aufgabe: Bereinige und strukturiere dieses automatisch transkribierte Kursmodul. Der Sprecher ist Tom Hannemann, ein Haarpflege-Experte.

## Regeln

1. **Abschnittsüberschriften hinzufügen**: Füge \`## Überschrift\` bei jedem Themenwechsel ein. Wähle kurze, beschreibende Überschriften auf Deutsch.

2. **Transkriptionsfehler korrigieren**: Korrigiere offensichtliche Fehler bei Produkt-, Chemie- und Fachbegriffen. Häufige Fehler:
   - Haar-Komposita (Harbpflege→Haarpflege, Kopfholt→Kopfhaut)
   - Chemische Begriffe (Hefepils→Hefepilz, Dieselfiedbrücken→Disulfidbrücken, Karatien→Keratin)
   - Produktnamen (Schampo→Shampoo, Oklaplex→Olaplex, K8C→K18)
   - Englische Lehnwörter (Lieven/Liven→Leave-in, Bond-Bilding→Bond-Building)

3. **Gesprochene Sprache glätten**:
   - Entferne Füllwörter (also, halt, eben, quasi, im Endeffekt, im Grunde, tatsächlich) wo sie keinen Mehrwert haben
   - Verschmelze fragmentierte Sätze zu vollständigen Sätzen
   - Entferne Wiederholungen und Fehlstarts
   - Behalte aber Toms lockeren, persönlichen Unterrichtsstil bei

4. **Absätze bilden**: Jeder Absatz sollte ein zusammenhängendes Thema behandeln (ca. 200-400 Wörter). Zwischen Absätzen eine Leerzeile.

5. **NICHT verändern**:
   - Keine neuen Informationen hinzufügen
   - Toms Persönlichkeit, Humor und Metaphern beibehalten ("eierlegende Wollmilchsau", "Freunde der Nacht" etc.)
   - Faktische Aussagen, Produktempfehlungen und technische Erklärungen nicht verändern
   - YAML-Frontmatter unverändert lassen
   - Die \`# Hauptüberschrift\` beibehalten

6. **Format**: Gib AUSSCHLIESSLICH das bereinigte Markdown-Dokument aus. KEINE einleitenden Sätze wie "Hier ist die bereinigte Version". KEINE Erklärungen oder Kommentare. Starte direkt mit der # Überschrift.

7. **WICHTIG - Verbote**:
   - Gib NIEMALS Code-Blöcke (\`\`\`) aus. Deine Ausgabe IST Markdown, sie wird nicht in Code-Blöcke eingeschlossen.
   - Erfinde KEINE neuen Inhalte. Jeder Satz muss auf der Eingabe basieren.
   - Gib die \`# Hauptüberschrift\` nur EINMAL am Anfang aus, niemals wiederholen.`

const LIVE_CALL_PROMPT = `Du bist ein professioneller Redakteur für deutschsprachige Bildungsinhalte zum Thema Haarpflege.

Deine Aufgabe: Bereinige und strukturiere dieses automatisch transkribierte Live-Call-Protokoll. Der Hauptsprecher ist Tom Hannemann, ein Haarpflege-Experte. Teilnehmer stellen Fragen.

## Regeln

1. **Q&A-Struktur herstellen**: Jedes Thema/jede Teilnehmer-Frage wird ein eigener Abschnitt mit \`## Überschrift\`. Die Überschrift soll das Thema beschreiben, z.B.:
   - "## Silvias Routine - Haare verhaken sich"
   - "## L'Oreal Elvital Midnight Oil Magic - Bewertung"
   - "## Nicoles Conditioner-Frage"

2. **Sprecherkennzeichnung beibehalten**: Behalte \`**Name:**\` für Sprecherwechsel bei. Bei langen Monologen von Tom kann die Kennzeichnung entfallen.

3. **Transkriptionsfehler korrigieren**: (gleiche Regeln wie für Kursmodule)
   - Haar-Komposita, chemische Begriffe, Produktnamen, englische Lehnwörter

4. **Gesprochene Sprache glätten**:
   - Entferne Füllwörter wo sie keinen Mehrwert haben
   - Verschmelze fragmentierte Sätze
   - Entferne Wiederholungen und Fehlstarts
   - Kurzantworten der Teilnehmer zusammenfassen oder entfernen wenn sie keinen Inhalt haben
   - Behalte Toms lockeren Unterrichtsstil bei

5. **Empfehlungen hervorheben**: Wenn Tom eine klare Empfehlung gibt, formatiere sie als:
   \`**Empfehlung:** ...\`

6. **NICHT verändern**:
   - Keine neuen Informationen hinzufügen
   - Faktische Aussagen und Produktempfehlungen nicht verändern
   - YAML-Frontmatter unverändert lassen
   - Die \`# Hauptüberschrift\` beibehalten

7. **Format**: Gib AUSSCHLIESSLICH das bereinigte Markdown-Dokument aus. KEINE einleitenden Sätze wie "Hier ist die bereinigte Version". KEINE Erklärungen oder Kommentare. Starte direkt mit der # Überschrift.

8. **WICHTIG - Verbote**:
   - Gib NIEMALS Code-Blöcke (\`\`\`) aus. Deine Ausgabe IST Markdown, sie wird nicht in Code-Blöcke eingeschlossen.
   - Erfinde KEINE neuen Inhalte oder Sprecher. Jeder Satz und jeder Name muss auf der Eingabe basieren.
   - Gib die \`# Hauptüberschrift\` nur EINMAL am Anfang aus, niemals wiederholen.`

const LIVE_CALL_SEGMENT_PROMPT = `Du bist ein professioneller Redakteur für deutschsprachige Bildungsinhalte zum Thema Haarpflege.

Du erhältst ein vollständiges Live-Call-Transkript. Ein Abschnitt ist mit >>>START<<< und <<<END>>> markiert.

Deine Aufgabe: Bereinige NUR den markierten Abschnitt. Gib NUR den bereinigten markierten Abschnitt aus — NICHTS davor oder danach.

## Regeln für den markierten Abschnitt

1. **Q&A-Struktur**: Jedes Thema/jede Teilnehmer-Frage = eigener Abschnitt mit \`## Überschrift\`.
2. **Sprecherkennzeichnung**: Behalte \`**Name:**\` für Sprecherwechsel bei.
3. **Transkriptionsfehler korrigieren**: Haar-Komposita, chemische Begriffe, Produktnamen, englische Lehnwörter.
4. **Gesprochene Sprache glätten**: Füllwörter entfernen, fragmentierte Sätze verschmelzen, Wiederholungen entfernen.
5. **Empfehlungen**: Klare Empfehlungen als \`**Empfehlung:** ...\` formatieren.

## WICHTIG - Verbote
- Gib NIEMALS Code-Blöcke (\`\`\`) aus. Deine Ausgabe IST Markdown.
- Erfinde KEINE neuen Inhalte oder Sprecher. Jeder Satz und jeder Name muss auf der Eingabe basieren.
- Gib KEINE # Hauptüberschrift aus (die kommt nur einmal am Anfang des Gesamtdokuments).
- Gib NUR den bereinigten markierten Abschnitt aus, NICHTS anderes.`

// ---------------------------------------------------------------------------
// Post-processing safety net
// ---------------------------------------------------------------------------

function postProcess(text: string): string {
  let result = text.trim()

  // 1. Strip outermost code fence wrapper only (```markdown ... ``` or ``` ... ```)
  const fenceMatch = result.match(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```\s*$/)
  if (fenceMatch) {
    result = fenceMatch[1]
  }

  // 2. Remove duplicate # Title headings (keep only the first)
  const lines = result.split("\n")
  let firstH1Found = false
  const filtered = lines.filter((line) => {
    if (/^# /.test(line)) {
      if (!firstH1Found) {
        firstH1Found = true
        return true
      }
      return false // remove duplicate # headings
    }
    return true
  })
  result = filtered.join("\n")

  // 3. Collapse triple+ blank lines to double
  result = result.replace(/\n{3,}/g, "\n\n")

  return result.trim()
}

// ---------------------------------------------------------------------------
// File processing
// ---------------------------------------------------------------------------

function splitFrontMatter(raw: string): { frontMatter: string; body: string } {
  if (!raw.startsWith("---")) {
    return { frontMatter: "", body: raw }
  }
  const endIdx = raw.indexOf("\n---", 3)
  if (endIdx === -1) {
    return { frontMatter: "", body: raw }
  }
  return {
    frontMatter: raw.slice(0, endIdx + 4),
    body: raw.slice(endIdx + 4).trim(),
  }
}

function isLiveCall(filePath: string): boolean {
  return filePath.includes("/live-calls/")
}

function discoverMarkdownFiles(dirs: string[]): string[] {
  const files: string[] = []
  function walk(d: string) {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.name.endsWith(".md")) files.push(full)
    }
  }
  for (const dir of dirs) {
    if (fs.existsSync(dir)) walk(dir)
  }
  return files.sort()
}

// ---------------------------------------------------------------------------
// AI Processing
// ---------------------------------------------------------------------------

async function processFileWithAI(
  filePath: string,
  body: string,
  liveCall: boolean,
  retries = 3
): Promise<string> {
  const systemPrompt = liveCall ? LIVE_CALL_PROMPT : COURSE_TRANSCRIPT_PROMPT

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await getOpenAI().chat.completions.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        temperature: 0.3,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Hier ist das Transkript zum Bereinigen:\n\n${body}`,
          },
        ],
      })

      const result = response.choices[0]?.message?.content
      if (!result) {
        throw new Error(`Empty response from API for ${filePath}`)
      }

      let cleaned = result.trim()

      // Strip any wrapper text the model may have added
      if (cleaned.startsWith("Hier ist") || cleaned.startsWith("Here is")) {
        const firstHeading = cleaned.indexOf("\n#")
        if (firstHeading > 0) {
          cleaned = cleaned.slice(firstHeading + 1)
        }
      }

      // Sanity check: output shouldn't be suspiciously short
      // AI cleanup compresses heavily (40-75% is normal), so threshold is low
      if (cleaned.length < body.length * 0.12) {
        throw new Error(
          `Output too short (${cleaned.length} vs ${body.length} input chars) - possible truncation`
        )
      }

      return cleaned
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)

      // Retry on rate limits with exponential backoff
      if (msg.includes("429") && attempt < retries - 1) {
        const delay = (attempt + 1) * 10000
        process.stdout.write(`\n    Rate limited, waiting ${delay / 1000}s...`)
        await new Promise((r) => setTimeout(r, delay))
        continue
      }

      // Fatal auth errors - stop immediately
      if (msg.includes("401") || msg.includes("403")) {
        console.error(`\nFatal: API authentication error. Check OPENAI_API_KEY.`)
        process.exit(1)
      }

      throw err
    }
  }

  throw new Error(`Failed after ${retries} retries for ${filePath}`)
}

/**
 * Split body into segments at paragraph boundaries, targeting segmentSize chars.
 */
function splitIntoSegments(body: string, segmentSize: number): string[] {
  if (body.length <= segmentSize) return [body]

  const segments: string[] = []
  let current = ""
  const paragraphs = body.split(/\n\n+/)

  for (const para of paragraphs) {
    if (current.length + para.length > segmentSize && current.length > 2000) {
      segments.push(current.trim())
      current = ""
    }
    current += (current ? "\n\n" : "") + para
  }

  if (current.trim()) {
    segments.push(current.trim())
  }

  return segments
}

/**
 * Process a live call using full-context multi-pass strategy.
 * Each segment is sent with the FULL document as context, but only the
 * marked segment is cleaned. This prevents hallucination.
 */
async function processLiveCallMultiPass(
  filePath: string,
  body: string,
): Promise<string> {
  const segments = splitIntoSegments(body, LIVE_CALL_SEGMENT_SIZE)

  if (segments.length === 1) {
    // Short enough for single-pass
    const result = await processFileWithAI(filePath, body, true)
    return postProcess(result)
  }

  console.log(`\n    Multi-pass: ${segments.length} segments (full-context)`)
  const processedSegments: string[] = []

  // Extract the # heading from body to handle it specially
  const headingMatch = body.match(/^(# .+)\n/)
  const heading = headingMatch ? headingMatch[1] : null

  for (let i = 0; i < segments.length; i++) {
    process.stdout.write(`    Segment ${i + 1}/${segments.length}...`)

    // Build the full document with markers around this segment
    const before = segments.slice(0, i).join("\n\n")
    const marked = segments[i]
    const after = segments.slice(i + 1).join("\n\n")

    const markedDocument = [
      before ? before + "\n\n" : "",
      ">>>START<<<\n",
      marked,
      "\n<<<END>>>",
      after ? "\n\n" + after : "",
    ].join("")

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await getOpenAI().chat.completions.create({
          model: MODEL,
          max_tokens: MAX_TOKENS,
          temperature: 0.3,
          messages: [
            { role: "system", content: LIVE_CALL_SEGMENT_PROMPT },
            {
              role: "user",
              content: `Hier ist das vollständige Live-Call-Transkript. Bereinige NUR den Abschnitt zwischen >>>START<<< und <<<END>>>.\n\n${markedDocument}`,
            },
          ],
        })

        const result = response.choices[0]?.message?.content
        if (!result) throw new Error("Empty response from API")

        let cleaned = postProcess(result.trim())

        // Strip any wrapper text
        if (cleaned.startsWith("Hier ist") || cleaned.startsWith("Here is")) {
          const firstContent = cleaned.indexOf("\n")
          if (firstContent > 0) cleaned = cleaned.slice(firstContent + 1).trim()
        }

        // For segments after the first, remove any # heading the model might add
        if (i > 0) {
          cleaned = cleaned.replace(/^# .+\n+/, "")
        }

        processedSegments.push(cleaned)
        console.log(" done")
        break
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        if (msg.includes("429") && attempt < 2) {
          const delay = (attempt + 1) * 10000
          process.stdout.write(` rate limited, waiting ${delay / 1000}s...`)
          await new Promise((r) => setTimeout(r, delay))
          continue
        }
        if (msg.includes("401") || msg.includes("403")) {
          console.error(`\nFatal: API authentication error.`)
          process.exit(1)
        }
        throw err
      }
    }

    if (i < segments.length - 1) {
      await new Promise((r) => setTimeout(r, RATE_LIMIT_DELAY_MS))
    }
  }

  // Stitch: first segment keeps heading, rest are body
  let result = processedSegments.join("\n\n")

  // Ensure heading is present at the top
  if (heading && !result.startsWith("# ")) {
    result = heading + "\n\n" + result
  }

  return result
}

async function processFile(filePath: string, dryRun: boolean): Promise<{ inputChars: number; outputChars: number }> {
  const raw = fs.readFileSync(filePath, "utf-8")
  const { frontMatter, body } = splitFrontMatter(raw)
  const liveCall = isLiveCall(filePath)

  if (dryRun) {
    return { inputChars: body.length, outputChars: 0 }
  }

  let cleanedBody: string

  if (liveCall) {
    // Live calls: full-context multi-pass strategy
    cleanedBody = await processLiveCallMultiPass(filePath, body)
  } else if (body.length > COURSE_SPLIT_THRESHOLD) {
    // Very long course transcripts: split and process independently
    const segments = splitIntoSegments(body, COURSE_SPLIT_THRESHOLD)
    const processedSegments: string[] = []

    for (let i = 0; i < segments.length; i++) {
      if (segments.length > 1) {
        process.stdout.write(`    Section ${i + 1}/${segments.length}...`)
      }
      const processed = await processFileWithAI(filePath, segments[i], false)
      processedSegments.push(postProcess(processed))
      if (segments.length > 1) console.log(" done")
      if (i < segments.length - 1) {
        await new Promise((r) => setTimeout(r, RATE_LIMIT_DELAY_MS))
      }
    }

    cleanedBody = processedSegments.join("\n\n")
  } else {
    // Course transcripts under threshold: single-pass
    const result = await processFileWithAI(filePath, body, false)
    cleanedBody = postProcess(result)
  }

  const output = frontMatter ? `${frontMatter}\n${cleanedBody}\n` : `${cleanedBody}\n`

  // Overwrite the pre-cleaned file
  fs.writeFileSync(filePath, output, "utf-8")

  return { inputChars: body.length, outputChars: cleanedBody.length }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes("--dry-run")
  const onlyFailed = args.includes("--only-failed")
  const fileIdx = args.indexOf("--file")
  const singleFile = fileIdx !== -1 ? args[fileIdx + 1] : null
  const startFromIdx = args.indexOf("--start-from")
  const startFrom = startFromIdx !== -1 ? args[startFromIdx + 1] : null

  console.log("=".repeat(60))
  console.log("Phase 2: AI-Assisted Deep Transcript Rewrite")
  console.log(dryRun ? "(DRY RUN)" : `Model: ${MODEL}`)
  if (onlyFailed) console.log("MODE: --only-failed (all live calls + 4 course files)")
  console.log("=".repeat(60))

  // Validate API key early
  if (!dryRun && !process.env.OPENAI_API_KEY) {
    console.error("Error: OPENAI_API_KEY not found. Check .env.local file.")
    process.exit(1)
  }

  // Check input directory exists
  if (!fs.existsSync(INPUT_BASE)) {
    console.error(`Error: ${INPUT_BASE} not found. Run clean-transcripts.ts first (Phase 1).`)
    process.exit(1)
  }

  let files: string[]

  if (singleFile) {
    const full = path.join(INPUT_BASE, singleFile)
    if (!fs.existsSync(full)) {
      console.error(`Error: File not found: ${full}`)
      process.exit(1)
    }
    files = [full]
  } else if (onlyFailed) {
    // Collect the 17 known-broken files: all live calls + 4 specific course transcripts
    const liveCallDir = path.join(INPUT_BASE, "live-calls")
    const liveCallFiles = fs.existsSync(liveCallDir)
      ? fs.readdirSync(liveCallDir)
          .filter((f) => f.endsWith(".md"))
          .map((f) => path.join(liveCallDir, f))
          .sort()
      : []

    const courseFiles = FAILED_COURSE_FILES.map((f) => path.join(INPUT_BASE, f)).filter((f) => {
      if (!fs.existsSync(f)) {
        console.warn(`Warning: Failed course file not found: ${f}`)
        return false
      }
      return true
    })

    files = [...courseFiles, ...liveCallFiles]
    console.log(`\nFound ${courseFiles.length} failed course files + ${liveCallFiles.length} live calls = ${files.length} total`)
  } else {
    files = discoverMarkdownFiles(INPUT_DIRS)
  }

  // Handle --start-from
  if (startFrom) {
    const startIdx = files.findIndex((f) => f.includes(startFrom))
    if (startIdx === -1) {
      console.error(`Error: --start-from file not found: ${startFrom}`)
      process.exit(1)
    }
    files = files.slice(startIdx)
    console.log(`Resuming from: ${startFrom} (${files.length} files remaining)`)
  }

  console.log(`\nProcessing ${files.length} files\n`)

  let processed = 0
  let totalInput = 0
  let totalOutput = 0
  let errors = 0

  for (const filePath of files) {
    const relPath = path.relative(INPUT_BASE, filePath)
    process.stdout.write(`  [${processed + 1}/${files.length}] ${relPath}...`)

    try {
      const { inputChars, outputChars } = await processFile(filePath, dryRun)
      totalInput += inputChars
      totalOutput += outputChars

      if (dryRun) {
        console.log(` ${inputChars} chars`)
      } else {
        const ratio = ((outputChars / inputChars) * 100).toFixed(0)
        console.log(` ${inputChars} → ${outputChars} chars (${ratio}%)`)
      }

      processed++
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.log(` ERROR: ${msg}`)
      errors++
    }

    // Rate limit delay between files
    if (!dryRun && processed < files.length) {
      await new Promise((r) => setTimeout(r, RATE_LIMIT_DELAY_MS))
    }
  }

  // Summary
  console.log(`\n${"=".repeat(60)}`)
  console.log("SUMMARY")
  console.log("=".repeat(60))
  console.log(`Files processed: ${processed}`)
  console.log(`Errors:          ${errors}`)

  if (!dryRun) {
    console.log(`Total input:     ${totalInput} chars`)
    console.log(`Total output:    ${totalOutput} chars`)
    console.log(`Compression:     ${((totalOutput / totalInput) * 100).toFixed(0)}%`)
    const estimatedCost = (totalInput / 4 / 1_000_000) * 2.5 + (totalOutput / 4 / 1_000_000) * 10
    console.log(`Est. API cost:   ~$${estimatedCost.toFixed(2)}`)
  } else {
    console.log(`Total chars:     ${totalInput}`)
    const estimatedTokens = Math.ceil(totalInput / 3) // German ~3 chars/token
    const estimatedCost = (estimatedTokens / 1_000_000) * 2.5 + (estimatedTokens / 1_000_000) * 10
    console.log(`Est. tokens:     ~${estimatedTokens}`)
    console.log(`Est. API cost:   ~$${estimatedCost.toFixed(2)}`)
    console.log("\n(Dry run - no API calls made)")
  }

  console.log("=".repeat(60))
}

main().catch(console.error)
