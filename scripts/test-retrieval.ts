/**
 * Quick test: send a query to the vector DB and print matching chunks.
 *
 * Usage: npx tsx scripts/test-retrieval.ts "Wie pflege ich Locken?"
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

async function main() {
  const query = process.argv[2] || "Wie pflege ich Locken richtig?"
  console.log(`\nQuery: "${query}"\n`)

  // Generate embedding
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
  const embeddingRes = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: query,
  })
  const embedding = embeddingRes.data[0].embedding

  // Search via match_content_chunks RPC
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await supabase.rpc("match_content_chunks", {
    query_embedding: embedding,
    match_count: 5,
    match_threshold: 0.3,
  })

  if (error) {
    console.error("RPC error:", error.message)
    return
  }

  for (const chunk of data) {
    const sim = (chunk.similarity * 100).toFixed(1)
    const preview = chunk.content.slice(0, 200).replace(/\n/g, " ")
    console.log(`[${sim}%] ${chunk.source_type} — ${chunk.source_name}`)
    console.log(`  ${preview}...\n`)
  }
}

main().catch(console.error)
