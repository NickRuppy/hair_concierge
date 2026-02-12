/**
 * Backfill NULL Embeddings
 *
 * Finds all content_chunks rows where embedding IS NULL,
 * generates embeddings using text-embedding-3-large (384 dims),
 * and updates each row.
 *
 * Usage: npx tsx scripts/backfill-null-embeddings.ts [--dry-run]
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

const EMBEDDING_MODEL = "text-embedding-3-large"
const EMBEDDING_DIMENSIONS = 384
const BATCH_SIZE = 10

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

async function main() {
  const dryRun = process.argv.includes("--dry-run")

  console.log("=".repeat(60))
  console.log("Backfill NULL Embeddings")
  if (dryRun) console.log("(DRY RUN)")
  console.log("=".repeat(60))

  // Fetch all chunks with NULL embeddings
  const { data: chunks, error } = await supabase
    .from("content_chunks")
    .select("id, content, source_type, source_name, chunk_index")
    .is("embedding", null)
    .order("source_type")
    .order("chunk_index")

  if (error || !chunks) {
    console.error("Failed to fetch chunks:", error?.message)
    process.exit(1)
  }

  console.log(`\nFound ${chunks.length} chunks with NULL embeddings`)

  // Group by source_type for summary
  const byType = new Map<string, number>()
  for (const c of chunks) {
    byType.set(c.source_type, (byType.get(c.source_type) || 0) + 1)
  }
  for (const [type, count] of byType) {
    console.log(`  ${type}: ${count}`)
  }

  if (chunks.length === 0) {
    console.log("Nothing to backfill!")
    return
  }

  if (dryRun) {
    console.log("\nDry run — no embeddings generated or stored.")
    return
  }

  // Process in batches
  let updated = 0
  let failed = 0

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE)
    const batchNum = Math.floor(i / BATCH_SIZE) + 1
    const totalBatches = Math.ceil(chunks.length / BATCH_SIZE)

    process.stdout.write(`  Batch ${batchNum}/${totalBatches} (${updated} updated, ${failed} failed)...\r`)

    try {
      // Generate embeddings for the batch
      const response = await openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: batch.map((c) => c.content),
        dimensions: EMBEDDING_DIMENSIONS,
      })

      const sorted = response.data.sort((a, b) => a.index - b.index)
      const embeddings = sorted.map((d) => d.embedding)

      // Update each chunk
      for (let j = 0; j < batch.length; j++) {
        const { error: updateError } = await supabase
          .from("content_chunks")
          .update({ embedding: JSON.stringify(embeddings[j]) })
          .eq("id", batch[j].id)

        if (updateError) {
          console.error(`\n  Error updating ${batch[j].id}: ${updateError.message}`)
          failed++
        } else {
          updated++
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`\n  Embedding error at batch ${batchNum}: ${msg}`)
      failed += batch.length
    }
  }

  console.log(`\n\n${"=".repeat(60)}`)
  console.log(`DONE: ${updated} updated, ${failed} failed out of ${chunks.length} total`)
  console.log("=".repeat(60))
}

main().catch(console.error)
