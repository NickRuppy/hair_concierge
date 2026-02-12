/**
 * @deprecated Superseded by ingest-markdown.ts with --source book.
 * The markdown pipeline reads structured chapter files from data/markdown-cleaned/book/
 * with header-aware chunking, rich metadata, and context prepending.
 *
 * Original: Book PDF Ingestion Script
 * Usage: npx tsx scripts/ingest-book.ts
 * Expects: data/book.pdf
 */

import { createClient } from "@supabase/supabase-js"
import OpenAI from "openai"
import fs from "fs"
import path from "path"
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse")

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

const CHUNK_SIZE = 1500
const CHUNK_OVERLAP = 200
const EMBEDDING_BATCH_SIZE = 100

function chunkText(text: string, chunkSize: number, overlap: number): string[] {
  const chunks: string[] = []
  let start = 0

  while (start < text.length) {
    let end = start + chunkSize

    // Try to break at sentence boundary
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

  return chunks.filter((c) => c.length > 50)
}

function cleanText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .replace(/^\s+$/gm, "")
    .trim()
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
  const bookPath = path.join(process.cwd(), "data", "book.pdf")

  if (!fs.existsSync(bookPath)) {
    console.error("Error: data/book.pdf not found")
    process.exit(1)
  }

  console.log("Reading PDF...")
  const buffer = fs.readFileSync(bookPath)
  const pdf = await pdfParse(buffer)

  console.log(`Extracted ${pdf.numpages} pages, ${pdf.text.length} characters`)

  console.log("Cleaning text...")
  const cleanedText = cleanText(pdf.text)

  console.log("Chunking text...")
  const chunks = chunkText(cleanedText, CHUNK_SIZE, CHUNK_OVERLAP)
  console.log(`Created ${chunks.length} chunks`)

  console.log("Generating embeddings...")
  const embeddings = await generateEmbeddings(chunks)

  console.log("Storing in database...")
  // Delete existing book chunks
  await supabase
    .from("content_chunks")
    .delete()
    .eq("source_type", "book")

  // Insert in batches
  const batchSize = 50
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize).map((content, idx) => ({
      source_type: "book",
      source_name: "book.pdf",
      chunk_index: i + idx,
      content,
      token_count: Math.ceil(content.length / 4),
      metadata: { page_estimate: Math.floor(((i + idx) * CHUNK_SIZE) / 3000) + 1 },
      embedding: JSON.stringify(embeddings[i + idx]),
    }))

    const { error } = await supabase.from("content_chunks").insert(batch)
    if (error) {
      console.error(`Error inserting batch at index ${i}:`, error)
    } else {
      console.log(`  Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(chunks.length / batchSize)}`)
    }
  }

  console.log("Done! Book ingestion complete.")
}

main().catch(console.error)
