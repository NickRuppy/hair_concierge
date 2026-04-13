import { getObservedOpenAI } from "@/lib/openai/client"
import type OpenAI from "openai"
import type { LangfuseConfig as LangfuseOpenAIConfig } from "@langfuse/openai"

export const DEFAULT_CHAT_COMPLETION_MODEL = "gpt-4o"
export const DEFAULT_CHAT_COMPLETION_TEMPERATURE = 0.7

export interface StreamChatCompletionParams {
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]
  model?: string
  temperature?: number
  langfuseConfig?: LangfuseOpenAIConfig
}

/**
 * Creates a streaming chat completion and returns a ReadableStream of text deltas.
 *
 * The returned stream yields UTF-8 encoded text chunks as they arrive from the
 * OpenAI API, suitable for piping directly into a Response or SSE transport.
 */
export async function streamChatCompletion({
  messages,
  model = DEFAULT_CHAT_COMPLETION_MODEL,
  temperature = DEFAULT_CHAT_COMPLETION_TEMPERATURE,
  langfuseConfig,
}: StreamChatCompletionParams): Promise<ReadableStream<Uint8Array>> {
  const response = await getObservedOpenAI(langfuseConfig).chat.completions.create({
    model,
    messages,
    temperature,
    stream: true,
  })

  const encoder = new TextEncoder()

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of response) {
          const delta = chunk.choices[0]?.delta?.content
          if (delta) {
            controller.enqueue(encoder.encode(delta))
          }
        }
        controller.close()
      } catch (error) {
        controller.error(error)
      }
    },
  })
}
