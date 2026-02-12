import { getOpenAI } from "@/lib/openai/client"

const EMBEDDING_MODEL = "text-embedding-3-small"

/**
 * Generates an embedding vector for a single text string.
 *
 * @param text - The text to embed
 * @returns A number array representing the embedding vector
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await getOpenAI().embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
  })

  return response.data[0].embedding
}

/**
 * Generates embedding vectors for multiple text strings in a single API call.
 *
 * @param texts - Array of texts to embed
 * @returns Array of number arrays, each representing an embedding vector
 */
export async function generateEmbeddings(
  texts: string[]
): Promise<number[][]> {
  if (texts.length === 0) {
    return []
  }

  const response = await getOpenAI().embeddings.create({
    model: EMBEDDING_MODEL,
    input: texts,
  })

  // Sort by index to ensure consistent ordering with the input
  const sorted = response.data.sort((a, b) => a.index - b.index)
  return sorted.map((item) => item.embedding)
}
