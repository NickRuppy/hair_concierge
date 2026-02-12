/**
 * Video Transcript Ingestion Script
 *
 * Usage: npx tsx scripts/ingest-transcripts.ts
 *
 * Expects: data/transcripts/*.srt or *.txt or *.vtt files
 */

import { createClient } from "@supabase/supabase-js"
import OpenAI from "openai"
import fs from "fs"
import path from "path"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

const CHUNK_SIZE = 1000
const CHUNK_OVERLAP = 150
const EMBEDDING_BATCH_SIZE = 100

function cleanSRT(text: string): string {
  return text
    .replace(/^\d+\s*$/gm, "") // Remove sequence numbers
    .replace(/\d{2}:\d{2}:\d{2}[.,]\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}[.,]\d{3}/g, "") // Remove timestamps
    .replace(/\r\n/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .replace(/<[^>]+>/g, "") // Remove HTML tags
    .trim()
}

function cleanVTT(text: string): string {
  return text
    .replace(/^WEBVTT.*$/m, "") // Remove WEBVTT header
    .replace(/\d{2}:\d{2}:\d{2}\.\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}\.\d{3}.*/g, "") // Remove timestamps
    .replace(/\r\n/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .replace(/<[^>]+>/g, "")
    .trim()
}

function chunkText(text: string, chunkSize: number, overlap: number): string[] {
  const chunks: string[] = []
  let start = 0

  while (start < text.length) {
    let end = start + chunkSize

    if (end < text.length) {
      const lastPeriod = text.lastIndexOf(".", end)
      const lastNewline = text.lastIndexOf("\n", end)
      const breakPoint = Math.max(lastPeriod, lastNewline)
      if (breakPoint > start + chunkSize / 2) {
        end = breakPoint + 1
      }
    }

    chunks.push(text.slice(start, end).trim())
    start = end - overlap
  }

  return chunks.filter((c) => c.length > 30)
}

async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const embeddings: number[][] = []

  for (let i = 0; i < texts.length; i += EMBEDDING_BATCH_SIZE) {
    const batch = texts.slice(i, i + EMBEDDING_BATCH_SIZE)
    console.log(
      `  Embedding batch ${Math.floor(i / EMBEDDING_BATCH_SIZE) + 1}/${Math.ceil(texts.length / EMBEDDING_BATCH_SIZE)}...`
    )

    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: batch,
    })

    embeddings.push(...response.data.map((d) => d.embedding))
  }

  return embeddings
}

async function main() {
  const transcriptsDir = path.join(process.cwd(), "data", "transcripts")

  if (!fs.existsSync(transcriptsDir)) {
    console.error("Error: data/transcripts/ directory not found")
    process.exit(1)
  }

  const files = fs
    .readdirSync(transcriptsDir)
    .filter((f) => [".srt", ".txt", ".vtt"].includes(path.extname(f).toLowerCase()))

  if (files.length === 0) {
    console.error("No transcript files found in data/transcripts/")
    process.exit(1)
  }

  console.log(`Found ${files.length} transcript files`)

  // Delete existing transcript chunks
  await supabase
    .from("content_chunks")
    .delete()
    .eq("source_type", "transcript")

  let totalChunks = 0

  for (const file of files) {
    console.log(`\nProcessing: ${file}`)
    const filePath = path.join(transcriptsDir, file)
    const raw = fs.readFileSync(filePath, "utf-8")
    const ext = path.extname(file).toLowerCase()

    let cleaned: string
    if (ext === ".srt") {
      cleaned = cleanSRT(raw)
    } else if (ext === ".vtt") {
      cleaned = cleanVTT(raw)
    } else {
      cleaned = raw.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim()
    }

    const videoTitle = path.basename(file, ext)

    console.log(`  Cleaned: ${cleaned.length} characters`)

    const chunks = chunkText(cleaned, CHUNK_SIZE, CHUNK_OVERLAP)
    console.log(`  Chunks: ${chunks.length}`)

    if (chunks.length === 0) continue

    console.log("  Generating embeddings...")
    const embeddings = await generateEmbeddings(chunks)

    console.log("  Storing in database...")
    const batchSize = 50
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize).map((content, idx) => ({
        source_type: "transcript",
        source_name: videoTitle,
        chunk_index: i + idx,
        content,
        token_count: Math.ceil(content.length / 4),
        metadata: { video_title: videoTitle, file_name: file },
        embedding: JSON.stringify(embeddings[i + idx]),
      }))

      const { error } = await supabase.from("content_chunks").insert(batch)
      if (error) {
        console.error(`  Error inserting batch:`, error)
      }
    }

    totalChunks += chunks.length
  }

  console.log(`\nDone! Ingested ${totalChunks} chunks from ${files.length} files.`)
}

main().catch(console.error)
