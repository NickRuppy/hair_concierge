/**
 * Content-Type-Aware Markdown Ingestion Pipeline
 *
 * Reads all structured Markdown files from data/markdown/,
 * chunks them with content-type-specific strategies, generates
 * embeddings, and stores in Supabase content_chunks.
 *
 * Usage: npx tsx scripts/ingest-markdown.ts [--dry-run] [--source <type>]
 *
 * Options:
 *   --dry-run        Show chunking stats without embedding or storing
 *   --source         Only process a specific source type (book, transcript, qa, etc.)
 *   --skip-context   Skip contextual prefix generation (fast re-ingestion)
 */

import { createClient } from "@supabase/supabase-js"
import OpenAI from "openai"
import fs from "fs"
import path from "path"

// Load .env.local for standalone script execution
const envPath = path.join(process.cwd(), ".env.local")
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").replace(/\r/g, "").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/)
    if (match && !process.env[match[1].trim()]) {
      process.env[match[1].trim()] = match[2].trim()
    }
  }
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const EMBEDDING_MODEL = "text-embedding-3-large"
const EMBEDDING_BATCH_SIZE = 10
const DB_INSERT_BATCH_SIZE = 50
const CONTEXT_CONCURRENCY = 10
const MD_DIR = path.join(process.cwd(), "data", "markdown-cleaned")

// Source types that benefit from contextual prefix generation (Anthropic technique).
// QA chunks are self-contained; product_list/product_links already have cell context.
const CONTEXTUAL_SOURCE_TYPES = new Set([
  "book",
  "transcript",
  "live_call_transcript",
  "live_call",
  "narrative",
])

let _supabase: ReturnType<typeof createClient> | null = null
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  }
  return _supabase
}

let _openai: OpenAI | null = null
function getOpenAI() {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
  }
  return _openai
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FrontMatter {
  [key: string]: string | string[]
}

interface ParsedFile {
  frontMatter: FrontMatter
  content: string
  filePath: string
}

interface Chunk {
  content: string
  sourceType: string
  sourceName: string
  chunkIndex: number
  tokenCount: number
  metadata: Record<string, unknown>
}

// Chunking config per source type
const CHUNK_CONFIG: Record<
  string,
  { size: number; overlap: number; strategy: "recursive" | "qa" | "natural" | "structured" }
> = {
  book: { size: 2000, overlap: 200, strategy: "structured" },
  transcript: { size: 1600, overlap: 200, strategy: "recursive" },
  qa: { size: 0, overlap: 0, strategy: "qa" },
  live_call: { size: 1600, overlap: 200, strategy: "recursive" },
  live_call_transcript: { size: 1600, overlap: 200, strategy: "recursive" },
  product_links: { size: 800, overlap: 0, strategy: "natural" },
  product_list: { size: 800, overlap: 0, strategy: "natural" },
  narrative: { size: 2400, overlap: 400, strategy: "recursive" },
}

// Map source_type from front matter to DB source_type
function mapSourceType(fmType: string): string {
  const mapping: Record<string, string> = {
    book: "book",
    transcript: "transcript",
    qa: "qa",
    live_call_transcript: "live_call",
    product_links: "product_links",
    product_list: "product_list",
    narrative: "narrative",
  }
  return mapping[fmType] || fmType
}

// ---------------------------------------------------------------------------
// YAML Front Matter Parser
// ---------------------------------------------------------------------------

function parseFrontMatter(raw: string): { frontMatter: FrontMatter; body: string } {
  const fm: FrontMatter = {}

  if (!raw.startsWith("---")) {
    return { frontMatter: fm, body: raw }
  }

  const endIdx = raw.indexOf("\n---", 3)
  if (endIdx === -1) {
    return { frontMatter: fm, body: raw }
  }

  const fmBlock = raw.slice(4, endIdx)
  const body = raw.slice(endIdx + 4).trim()

  let currentKey = ""
  let inArray = false

  for (const line of fmBlock.split("\n")) {
    const trimmed = line.trim()

    // Array item
    if (inArray && trimmed.startsWith("- ")) {
      const val = trimmed.slice(2).replace(/^"|"$/g, "")
      const arr = fm[currentKey]
      if (Array.isArray(arr)) {
        arr.push(val)
      }
      continue
    }

    inArray = false

    // Key: value pair
    const match = trimmed.match(/^(\w[\w_]*)\s*:\s*(.*)$/)
    if (match) {
      currentKey = match[1]
      const val = match[2].trim()

      if (val === "") {
        // Array start
        fm[currentKey] = []
        inArray = true
      } else {
        fm[currentKey] = val.replace(/^"|"$/g, "")
      }
    }
  }

  return { frontMatter: fm, body }
}

// ---------------------------------------------------------------------------
// File Discovery
// ---------------------------------------------------------------------------

function discoverMarkdownFiles(dir: string): string[] {
  const files: string[] = []

  function walk(d: string) {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name)
      if (entry.isDirectory()) {
        walk(full)
      } else if (entry.name.endsWith(".md")) {
        files.push(full)
      }
    }
  }

  walk(dir)
  return files.sort()
}

function readMarkdownFile(filePath: string): ParsedFile {
  const raw = fs.readFileSync(filePath, "utf-8")
  const { frontMatter, body } = parseFrontMatter(raw)
  return { frontMatter, content: body, filePath }
}

// ---------------------------------------------------------------------------
// Chunking Strategies
// ---------------------------------------------------------------------------

/**
 * Recursive character-based chunking with sentence-boundary awareness.
 * Used for book chapters, transcripts, and narrative content.
 */
function chunkRecursive(text: string, chunkSize: number, overlap: number): string[] {
  const chunks: string[] = []
  let start = 0
  const minAdvance = Math.max(chunkSize - overlap, 100)

  while (start < text.length) {
    let end = Math.min(start + chunkSize, text.length)

    // Try to break at paragraph or sentence boundary (only within the current window)
    if (end < text.length) {
      const window = text.slice(start, end)
      // Try paragraph break
      const lastDoubleNewline = window.lastIndexOf("\n\n")
      if (lastDoubleNewline > chunkSize * 0.4) {
        end = start + lastDoubleNewline + 2
      } else {
        // Try sentence break
        const lastPeriod = window.lastIndexOf(". ")
        const lastQuestion = window.lastIndexOf("? ")
        const lastExclaim = window.lastIndexOf("! ")
        const breakPoint = Math.max(lastPeriod, lastQuestion, lastExclaim)
        if (breakPoint > chunkSize * 0.4) {
          end = start + breakPoint + 2
        }
      }
    }

    const chunk = text.slice(start, end).trim()
    if (chunk.length > 30) {
      chunks.push(chunk)
    }

    // Ensure we always advance by at least minAdvance to prevent infinite loops
    const nextStart = end - overlap
    start = Math.max(nextStart, start + minAdvance)
  }

  return chunks
}

/**
 * Structure-aware chunking for book chapters.
 * Splits on H2 boundaries first, then applies recursive chunking within each section.
 * Prepends hierarchical context (H1 > H2) to each chunk for embedding.
 */
function chunkStructured(
  text: string,
  chunkSize: number,
  overlap: number,
  frontMatter: FrontMatter
): string[] {
  const chapterTitle = (frontMatter.chapter_title as string) || ""
  const chapterNum = (frontMatter.chapter as string) || ""
  const h1Prefix = chapterNum
    ? `Kapitel ${chapterNum}: ${chapterTitle}`
    : chapterTitle

  // Split text into sections by H2 headers
  const h2Pattern = /\n## (.+)\n/g
  const sections: { heading: string; body: string }[] = []
  let match: RegExpExecArray | null

  // Collect all H2 positions
  const matches: { heading: string; index: number; fullMatchLength: number }[] = []
  while ((match = h2Pattern.exec(text)) !== null) {
    matches.push({
      heading: match[1].trim(),
      index: match.index,
      fullMatchLength: match[0].length,
    })
  }

  if (matches.length === 0) {
    // No H2 headers found — fall back to recursive chunking with H1 context
    const chunks = chunkRecursive(text, chunkSize, overlap)
    if (h1Prefix) {
      return chunks.map((c) => `${h1Prefix}\n\n${c}`)
    }
    return chunks
  }

  // Text before first H2
  const preH2 = text.slice(0, matches[0].index).trim()
  if (preH2) {
    // Strip the H1 line from intro text
    const introBody = preH2.replace(/^# .+\n*/, "").trim()
    if (introBody) {
      sections.push({ heading: "", body: introBody })
    }
  }

  // Each H2 section
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index + matches[i].fullMatchLength
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length
    const body = text.slice(start, end).trim()
    if (body) {
      sections.push({ heading: matches[i].heading, body })
    }
  }

  // Chunk each section independently, prepending context
  const allChunks: string[] = []

  for (const section of sections) {
    const contextLine = section.heading
      ? `${h1Prefix} > ${section.heading}`
      : h1Prefix

    const sectionChunks = chunkRecursive(section.body, chunkSize, overlap)
    for (const chunk of sectionChunks) {
      allChunks.push(`${contextLine}\n\n${chunk}`)
    }
  }

  return allChunks
}

/**
 * Q&A chunking: each question block (## Frage N ... ---) becomes one chunk.
 * Never splits a question from its content.
 */
function chunkQA(text: string): string[] {
  // Split on the "---" separators between questions
  const blocks = text.split(/\n---\n/)
  const chunks: string[] = []

  for (const block of blocks) {
    const cleaned = block.trim()
    if (!cleaned || cleaned === "# Häufige Fragen") continue

    // Remove the ## Frage N header for cleaner embedding
    // but keep the actual content
    const withoutHeader = cleaned.replace(/^## Frage \d+\s*\n+/, "").trim()
    if (withoutHeader.length > 20) {
      chunks.push(withoutHeader)
    }
  }

  return chunks
}

/**
 * Natural chunking: split on paragraph boundaries, no overlap.
 * Used for product links and short structured content.
 */
function chunkNatural(text: string, maxSize: number): string[] {
  const paragraphs = text.split(/\n\n+/)
  const chunks: string[] = []
  let current = ""

  for (const para of paragraphs) {
    const trimmed = para.trim()
    if (!trimmed) continue

    // Skip markdown headers when they're alone
    if (trimmed.startsWith("# ") && trimmed.length < 80) continue

    if (current.length + trimmed.length + 2 > maxSize && current.length > 30) {
      chunks.push(current.trim())
      current = ""
    }

    current += (current ? "\n\n" : "") + trimmed
  }

  if (current.trim().length > 30) {
    chunks.push(current.trim())
  }

  return chunks
}

/**
 * Apply content-type-specific chunking strategy.
 */
function chunkContent(text: string, sourceType: string, frontMatter?: FrontMatter): string[] {
  const config = CHUNK_CONFIG[sourceType] || CHUNK_CONFIG["transcript"]

  switch (config.strategy) {
    case "qa":
      return chunkQA(text)
    case "natural":
      return chunkNatural(text, config.size)
    case "structured":
      return chunkStructured(text, config.size, config.overlap, frontMatter || {})
    case "recursive":
    default:
      return chunkRecursive(text, config.size, config.overlap)
  }
}

// ---------------------------------------------------------------------------
// Contextual Retrieval Prefix Generation
// ---------------------------------------------------------------------------

/**
 * Generates a short document-level context prefix for each chunk using GPT-4o-mini.
 * Prepends the prefix to the chunk content so embeddings carry document-level signal.
 * Based on Anthropic's contextual retrieval technique.
 */
async function addContextualPrefixes(
  chunks: Chunk[],
  sourceDocuments: Map<string, string>
): Promise<void> {
  let completed = 0

  async function processChunk(chunk: Chunk): Promise<void> {
    const docContent = sourceDocuments.get(chunk.sourceName)
    if (!docContent) return

    // Truncate document to ~6,000 chars to fit in context window cheaply
    const truncatedDoc = docContent.slice(0, 6000)

    try {
      const response = await getOpenAI().chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0,
        max_tokens: 150,
        messages: [
          {
            role: "system",
            content:
              "Du bist ein Assistent für die Aufbereitung von Haarpflege-Wissensinhalten. " +
              "Gib 1–2 kurze Sätze auf Deutsch zurück, die den Kontext dieses Textabschnitts " +
              "innerhalb des Gesamtdokuments beschreiben. Ziel ist es, die Suche in einer " +
              "Vektordatenbank zu verbessern. Antworte NUR mit dem Kontexttext, ohne Anführungszeichen.",
          },
          {
            role: "user",
            content:
              `<document>\n${truncatedDoc}\n</document>\n\n` +
              `<chunk>\n${chunk.content}\n</chunk>\n\n` +
              "Beschreibe kurz den Kontext dieses Abschnitts im Gesamtdokument.",
          },
        ],
      })

      const prefix = response.choices[0]?.message?.content?.trim()
      if (prefix) {
        chunk.content = `${prefix}\n\n${chunk.content}`
        chunk.tokenCount = Math.ceil(chunk.content.length / 4)
      }
    } catch (err) {
      // Graceful: chunk proceeds without prefix on failure
      const msg = err instanceof Error ? err.message : String(err)
      process.stderr.write(`  Warning: context generation failed for ${chunk.sourceName}[${chunk.chunkIndex}]: ${msg}\n`)
    }

    completed++
    process.stdout.write(`  Context prefixes: ${completed}/${chunks.length}\r`)
  }

  // Process in batches of CONTEXT_CONCURRENCY for throughput
  for (let i = 0; i < chunks.length; i += CONTEXT_CONCURRENCY) {
    const batch = chunks.slice(i, i + CONTEXT_CONCURRENCY)
    await Promise.all(batch.map(processChunk))
  }

  console.log(`  Context prefixes: ${completed}/${chunks.length} done`)
}

// ---------------------------------------------------------------------------
// Embedding
// ---------------------------------------------------------------------------

async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const embeddings: number[][] = []

  for (let i = 0; i < texts.length; i += EMBEDDING_BATCH_SIZE) {
    const batch = texts.slice(i, i + EMBEDDING_BATCH_SIZE)
    const batchNum = Math.floor(i / EMBEDDING_BATCH_SIZE) + 1
    const totalBatches = Math.ceil(texts.length / EMBEDDING_BATCH_SIZE)
    process.stdout.write(`  Embedding batch ${batchNum}/${totalBatches}...\r`)

    const response = await getOpenAI().embeddings.create({
      model: EMBEDDING_MODEL,
      input: batch,
      dimensions: 384,
    })

    const sorted = response.data.sort((a, b) => a.index - b.index)
    embeddings.push(...sorted.map((d) => d.embedding))
  }

  console.log(`  Embedded ${texts.length} chunks                    `)
  return embeddings
}

// ---------------------------------------------------------------------------
// Database Storage
// ---------------------------------------------------------------------------

async function storeChunks(chunks: Chunk[], embeddings: number[][]): Promise<number> {
  let stored = 0

  for (let i = 0; i < chunks.length; i += DB_INSERT_BATCH_SIZE) {
    const batch = chunks.slice(i, i + DB_INSERT_BATCH_SIZE).map((chunk, idx) => ({
      source_type: chunk.sourceType,
      source_name: chunk.sourceName,
      chunk_index: chunk.chunkIndex,
      content: chunk.content,
      token_count: chunk.tokenCount,
      metadata: chunk.metadata,
      embedding: JSON.stringify(embeddings[i + idx]),
    }))

    const { error } = await getSupabase().from("content_chunks").insert(batch)
    if (error) {
      console.error(`  Error inserting batch at index ${i}:`, error.message)
    } else {
      stored += batch.length
    }
  }

  return stored
}

async function clearSourceType(sourceType: string): Promise<void> {
  const { error } = await getSupabase()
    .from("content_chunks")
    .delete()
    .eq("source_type", sourceType)

  if (error) {
    console.error(`  Warning: could not clear ${sourceType}:`, error.message)
  }
}

// ---------------------------------------------------------------------------
// Main Pipeline
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes("--dry-run")
  const skipContext = args.includes("--skip-context")
  const sourceFilterIdx = args.indexOf("--source")
  const sourceFilter = sourceFilterIdx !== -1 ? args[sourceFilterIdx + 1] : null

  console.log("=" .repeat(60))
  console.log("RAG Markdown Ingestion Pipeline")
  console.log(dryRun ? "(DRY RUN - no embedding or storage)" : "")
  if (skipContext) console.log("(SKIP CONTEXT - no contextual prefix generation)")
  console.log("=".repeat(60))

  if (!fs.existsSync(MD_DIR)) {
    console.error(`Error: ${MD_DIR} not found. Run clean-transcripts.ts and ai-cleanup.ts first.`)
    process.exit(1)
  }

  // Discover files
  const allFiles = discoverMarkdownFiles(MD_DIR)
  console.log(`\nFound ${allFiles.length} Markdown files`)

  // Parse all files and group by source type
  const filesByType: Record<string, ParsedFile[]> = {}

  for (const filePath of allFiles) {
    const parsed = readMarkdownFile(filePath)
    const fmSourceType = (parsed.frontMatter.source_type as string) || "unknown"

    if (sourceFilter && mapSourceType(fmSourceType) !== sourceFilter) continue

    if (!filesByType[fmSourceType]) {
      filesByType[fmSourceType] = []
    }
    filesByType[fmSourceType].push(parsed)
  }

  // Process each source type
  let totalChunks = 0
  let totalStored = 0
  const stats: { type: string; files: number; chunks: number; chars: number }[] = []

  for (const [fmSourceType, files] of Object.entries(filesByType)) {
    const dbSourceType = mapSourceType(fmSourceType)
    console.log(`\n--- ${dbSourceType} (${files.length} files) ---`)

    // Clear existing chunks for this source type
    if (!dryRun) {
      await clearSourceType(dbSourceType)
    }

    const allChunks: Chunk[] = []
    const sourceDocuments = new Map<string, string>()

    for (const file of files) {
      const relPath = path.relative(MD_DIR, file.filePath)
      const textChunks = chunkContent(file.content, fmSourceType, file.frontMatter)

      // Track full document content for contextual prefix generation
      sourceDocuments.set(relPath, file.content)

      // Build metadata from front matter
      const metadata: Record<string, unknown> = { ...file.frontMatter }
      delete metadata.source_type // already a column
      metadata.file = relPath

      // Create Chunk objects
      for (let i = 0; i < textChunks.length; i++) {
        allChunks.push({
          content: textChunks[i],
          sourceType: dbSourceType,
          sourceName: relPath,
          chunkIndex: i,
          tokenCount: Math.ceil(textChunks[i].length / 4),
          metadata: { ...metadata },
        })
      }

      if (textChunks.length > 0) {
        const totalChars = textChunks.reduce((sum, c) => sum + c.length, 0)
        const avgChars = Math.round(totalChars / textChunks.length)
        console.log(`  ${relPath}: ${textChunks.length} chunks (avg ${avgChars} chars)`)
      }
    }

    // Add contextual prefixes for eligible source types
    if (!skipContext && !dryRun && CONTEXTUAL_SOURCE_TYPES.has(fmSourceType) && allChunks.length > 0) {
      await addContextualPrefixes(allChunks, sourceDocuments)
    }

    totalChunks += allChunks.length
    const totalChars = allChunks.reduce((sum, c) => sum + c.content.length, 0)
    stats.push({
      type: dbSourceType,
      files: files.length,
      chunks: allChunks.length,
      chars: totalChars,
    })

    if (!dryRun && allChunks.length > 0) {
      // Generate embeddings for all chunks of this type
      const texts = allChunks.map((c) => c.content)
      const embeddings = await generateEmbeddings(texts)

      // Store in Supabase
      const stored = await storeChunks(allChunks, embeddings)
      totalStored += stored
      console.log(`  Stored ${stored} chunks in Supabase`)
    }
  }

  // Summary
  console.log(`\n${"=".repeat(60)}`)
  console.log("SUMMARY")
  console.log("=".repeat(60))
  console.log(
    `${"Source Type".padEnd(18)} ${"Files".padStart(5)} ${"Chunks".padStart(7)} ${"Chars".padStart(9)} ${"~Tokens".padStart(9)}`
  )
  console.log("-".repeat(52))
  for (const s of stats) {
    console.log(
      `${s.type.padEnd(18)} ${String(s.files).padStart(5)} ${String(s.chunks).padStart(7)} ${String(s.chars).padStart(9)} ${String(Math.ceil(s.chars / 4)).padStart(9)}`
    )
  }
  console.log("-".repeat(52))
  const grandChars = stats.reduce((sum, s) => sum + s.chars, 0)
  console.log(
    `${"TOTAL".padEnd(18)} ${String(stats.reduce((s, x) => s + x.files, 0)).padStart(5)} ${String(totalChunks).padStart(7)} ${String(grandChars).padStart(9)} ${String(Math.ceil(grandChars / 4)).padStart(9)}`
  )

  if (dryRun) {
    console.log("\n(Dry run - nothing was embedded or stored)")
    const embeddingCost = (grandChars / 4 / 1_000_000) * 0.02
    // Estimate contextual prefix cost: ~6K input + ~150 output tokens per eligible chunk
    // Use DB-mapped types for matching
    const contextualDbTypes = new Set(
      [...CONTEXTUAL_SOURCE_TYPES].map((t) => mapSourceType(t))
    )
    const eligibleChunks = stats
      .filter((s) => contextualDbTypes.has(s.type))
      .reduce((sum, s) => sum + s.chunks, 0)
    // gpt-4o-mini: $0.15/1M input, $0.60/1M output
    const contextInputCost = (eligibleChunks * 1600 / 1_000_000) * 0.15
    const contextOutputCost = (eligibleChunks * 50 / 1_000_000) * 0.60
    const contextCost = contextInputCost + contextOutputCost
    console.log(`Estimated embedding cost: ~$${embeddingCost.toFixed(4)}`)
    if (!skipContext) {
      console.log(`Estimated context generation cost: ~$${contextCost.toFixed(4)} (${eligibleChunks} chunks)`)
    }
    console.log(`Estimated total cost: ~$${(embeddingCost + (skipContext ? 0 : contextCost)).toFixed(4)}`)
  } else {
    console.log(`\nStored ${totalStored} chunks in Supabase content_chunks`)
  }
  console.log("=".repeat(60))
}

main().catch(console.error)
