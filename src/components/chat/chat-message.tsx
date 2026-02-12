"use client"

import type { Message } from "@/lib/types"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

interface ChatMessageProps {
  message: Message
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user"

  return (
    <div
      className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}
    >
      {/* Avatar */}
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-primary text-primary-foreground"
        }`}
      >
        {isUser ? "Du" : "HC"}
      </div>

      {/* Content */}
      <div
        className={`max-w-[80%] space-y-2 ${isUser ? "items-end" : "items-start"}`}
      >
        {/* Image if present */}
        {message.image_url && (
          <div
            className={`overflow-hidden rounded-xl ${isUser ? "ml-auto" : ""}`}
          >
            <img
              src={message.image_url}
              alt="Hochgeladenes Bild"
              className="max-h-64 max-w-full rounded-xl object-cover"
            />
          </div>
        )}

        {/* Text content */}
        {message.content && (
          <div
            className={`rounded-2xl px-4 py-2.5 ${
              isUser
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-foreground"
            }`}
          >
            {isUser ? (
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
            ) : (
              <div className="prose prose-sm max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {message.content}
                </ReactMarkdown>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
