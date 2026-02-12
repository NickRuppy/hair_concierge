/**
 * Backfill Context Prefixes for Live Call Chunks
 *
 * Identifies live_call chunks in content_chunks that are missing their
 * GPT-4o-mini contextual prefix, generates the prefix with rate limiting,
 * and updates the content + re-embeds.
 *
 * Usage: npx tsx scripts/backfill-context-prefixes.ts [--dry-run]
 */

import { createClient } from "@supabase/supabase-js"
import OpenAI from "openai"
import fs from "fs"
import path from "path"

// Load .env.local
const envPath = path.join(process.cwd(), ".env.local")
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").replace(/\r/g, "").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/)
    if (match && !process.env[match[1].trim()]) {
      process.env[match[1].trim()] = match[2].trim()
    }
  }
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

const EMBEDDING_MODEL = "text-embedding-3-small"
const MD_DIR = path.join(process.cwd(), "data", "markdown-cleaned")

// Rate limiting: ~3 requests/sec keeps us well under 200k TPM
const DELAY_MS = 350

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Detect whether a chunk already has a contextual prefix.
 *
 * GPT-4o-mini prefixes are meta-descriptions that always contain "Abschnitt"
 * (section) — e.g. "In diesem Abschnitt..." or "Dieser Abschnitt...".
 * They appear as the first paragraph (before \n\n), without markdown formatting.
 */
function hasPrefix(content: string): boolean {
  const trimmed = content.trimStart()

  // Quick reject: starts with markdown heading or bold speaker name
  if (trimmed.startsWith("#") || trimmed.startsWith("**")) return false

  // Find first paragraph boundary
  const firstBreak = trimmed.indexOf("\n\n")
  if (firstBreak === -1 || firstBreak > 600) return false

  const firstPara = trimmed.slice(0, firstBreak)

  // The GPT-generated context prefix is always a meta-description
  // containing "Abschnitt" (section), without markdown formatting
  return (
    firstPara.includes("Abschnitt") &&
    !firstPara.includes("#") &&
    !firstPara.includes("**")
  )
}

async function generatePrefix(
  chunkContent: string,
  docContent: string
): Promise<string | null> {
  const truncatedDoc = docContent.slice(0, 6000)

  const response = await openai.chat.completions.create({
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
          `<chunk>\n${chunkContent}\n</chunk>\n\n` +
          "Beschreibe kurz den Kontext dieses Abschnitts im Gesamtdokument.",
      },
    ],
  })

  return response.choices[0]?.message?.content?.trim() || null
}

async function main() {
  const dryRun = process.argv.includes("--dry-run")

  console.log("=" .repeat(60))
  console.log("Backfill Context Prefixes for Live Call Chunks")
  console.log(dryRun ? "(DRY RUN)" : "")
  console.log("=" .repeat(60))

  // 1. Fetch all live_call chunks
  const { data: chunks, error } = await supabase
    .from("content_chunks")
    .select("id, content, source_name, chunk_index")
    .eq("source_type", "live_call")
    .order("source_name")
    .order("chunk_index")

  if (error || !chunks) {
    console.error("Failed to fetch chunks:", error?.message)
    process.exit(1)
  }

  console.log(`Fetched ${chunks.length} live_call chunks`)

  // 2. Identify chunks missing prefix
  const missing = chunks.filter((c) => !hasPrefix(c.content))
  console.log(`${missing.length} chunks are missing contextual prefixes`)

  if (missing.length === 0) {
    console.log("Nothing to backfill!")
    return
  }

  // 3. Load source documents from disk
  const sourceDocCache = new Map<string, string>()
  for (const chunk of missing) {
    if (!sourceDocCache.has(chunk.source_name)) {
      const filePath = path.join(MD_DIR, chunk.source_name)
      if (fs.existsSync(filePath)) {
        sourceDocCache.set(chunk.source_name, fs.readFileSync(filePath, "utf-8"))
      } else {
        console.error(`  Source file not found: ${filePath}`)
      }
    }
  }

  if (dryRun) {
    console.log("\nWould backfill these chunks:")
    for (const chunk of missing) {
      console.log(`  ${chunk.source_name}[${chunk.chunk_index}]: ${chunk.content.slice(0, 80)}...`)
    }
    console.log(`\nEstimated cost: ~$${(missing.length * 1650 / 1_000_000 * 0.15 + missing.length * 50 / 1_000_000 * 0.60).toFixed(4)} (context) + ~$${(missing.length * 400 / 1_000_000 * 0.02).toFixed(4)} (embeddings)`)
    return
  }

  // 4. Generate prefixes with rate limiting, then re-embed and update
  let succeeded = 0
  let failed = 0
  const toUpdate: { id: string; newContent: string }[] = []

  for (let i = 0; i < missing.length; i++) {
    const chunk = missing[i]
    const docContent = sourceDocCache.get(chunk.source_name)
    if (!docContent) {
      console.error(`  Skipping ${chunk.source_name}[${chunk.chunk_index}]: no source doc`)
      failed++
      continue
    }

    try {
      const prefix = await generatePrefix(chunk.content, docContent)
      if (prefix) {
        toUpdate.push({
          id: chunk.id,
          newContent: `${prefix}\n\n${chunk.content}`,
        })
        succeeded++
      } else {
        console.error(`  Empty prefix for ${chunk.source_name}[${chunk.chunk_index}]`)
        failed++
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`  Error for ${chunk.source_name}[${chunk.chunk_index}]: ${msg}`)
      failed++
    }

    process.stdout.write(`  Prefixes: ${i + 1}/${missing.length} (${succeeded} ok, ${failed} failed)\r`)
    await sleep(DELAY_MS)
  }

  console.log(`\n  Prefix generation: ${succeeded} succeeded, ${failed} failed`)

  if (toUpdate.length === 0) {
    console.log("No chunks to update.")
    return
  }

  // 5. Re-embed updated chunks
  console.log(`\nEmbedding ${toUpdate.length} updated chunks...`)
  const BATCH_SIZE = 100
  const embeddings: number[][] = []

  for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
    const batch = toUpdate.slice(i, i + BATCH_SIZE)
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: batch.map((c) => c.newContent),
    })
    const sorted = response.data.sort((a, b) => a.index - b.index)
    embeddings.push(...sorted.map((d) => d.embedding))
    process.stdout.write(`  Embedded batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(toUpdate.length / BATCH_SIZE)}\r`)
  }
  console.log(`  Embedded ${embeddings.length} chunks`)

  // 6. Update each chunk in Supabase
  console.log(`\nUpdating ${toUpdate.length} chunks in Supabase...`)
  let updated = 0

  for (let i = 0; i < toUpdate.length; i++) {
    const { id, newContent } = toUpdate[i]
    const { error: updateError } = await supabase
      .from("content_chunks")
      .update({
        content: newContent,
        token_count: Math.ceil(newContent.length / 4),
        embedding: JSON.stringify(embeddings[i]),
      })
      .eq("id", id)

    if (updateError) {
      console.error(`  Error updating ${id}: ${updateError.message}`)
    } else {
      updated++
    }
  }

  console.log(`\n${"=".repeat(60)}`)
  console.log(`DONE: ${updated}/${toUpdate.length} chunks updated with prefixes`)
  console.log("=".repeat(60))
}

main().catch(console.error)
