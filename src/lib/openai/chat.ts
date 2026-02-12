import { getOpenAI } from "@/lib/openai/client"
import type OpenAI from "openai"

export interface StreamChatCompletionParams {
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]
  model?: string
  temperature?: number
}

/**
 * Creates a streaming chat completion and returns a ReadableStream of text deltas.
 *
 * The returned stream yields UTF-8 encoded text chunks as they arrive from the
 * OpenAI API, suitable for piping directly into a Response or SSE transport.
 */
export async function streamChatCompletion({
  messages,
  model = "gpt-4o",
  temperature = 0.7,
}: StreamChatCompletionParams): Promise<ReadableStream<Uint8Array>> {
  const response = await getOpenAI().chat.completions.create({
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
