import OpenAI from "openai"

let instance: OpenAI | null = null

export function getOpenAI(): OpenAI {
  if (!instance) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error(
        "Missing OPENAI_API_KEY – set it in your .env.local file."
      )
    }
    instance = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }
  return instance
}
