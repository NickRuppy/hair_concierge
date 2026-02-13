"use client"

import type { ReactNode } from "react"
import type { Message, CitationSource } from "@/lib/types"
import type { Components } from "react-markdown"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { CitationBadge } from "./citation-badge"

interface ChatMessageProps {
  message: Message
}

/**
 * Splits a text string on [N] markers and interleaves CitationBadge components
 * for any N that exists in the sourceMap.
 */
function renderWithCitations(
  text: string,
  sourceMap: Map<number, CitationSource>
): ReactNode[] {
  const parts = text.split(/\[(\d+)\]/g)
  const result: ReactNode[] = []

  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) {
      // Regular text segment
      if (parts[i]) result.push(parts[i])
    } else {
      // Captured digit — check if it's a known source
      const idx = parseInt(parts[i], 10)
      const source = sourceMap.get(idx)
      if (source) {
        result.push(<CitationBadge key={`cite-${i}`} source={source} />)
      } else {
        // Unknown index — render as plain text
        result.push(`[${parts[i]}]`)
      }
    }
  }

  return result
}

/**
 * Recursively processes React children, replacing string segments that contain
 * [N] citation markers with CitationBadge components.
 */
function processChildren(
  children: ReactNode,
  sourceMap: Map<number, CitationSource>
): ReactNode {
  if (typeof children === "string") {
    return renderWithCitations(children, sourceMap)
  }
  if (Array.isArray(children)) {
    return children.map((child, i) => {
      if (typeof child === "string") {
        const parts = renderWithCitations(child, sourceMap)
        return parts.length === 1 ? parts[0] : <span key={i}>{parts}</span>
      }
      return child
    })
  }
  return children
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user"
  const sources: CitationSource[] = message.rag_context?.sources ?? []
  const sourceMap = new Map(sources.map((s) => [s.index, s]))

  // Build custom markdown components that inject citation badges
  const markdownComponents: Components =
    sources.length > 0
      ? {
          p({ children }) {
            return <p>{processChildren(children, sourceMap)}</p>
          },
          li({ children }) {
            return <li>{processChildren(children, sourceMap)}</li>
          },
        }
      : {}

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
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={markdownComponents}
                >
                  {message.content}
                </ReactMarkdown>
              </div>
            )}
          </div>
        )}

        {/* Sources footer */}
        {sources.length > 0 && (
          <details className="text-xs text-muted-foreground px-1">
            <summary className="cursor-pointer hover:text-foreground transition-colors">
              {sources.length} {sources.length === 1 ? "Quelle" : "Quellen"}
            </summary>
            <ul className="mt-1.5 space-y-0.5 pl-4 list-disc">
              {sources.map((s) => (
                <li key={s.index}>
                  [{s.index}] {s.label}
                  {s.source_name ? ` \u2013 ${s.source_name}` : ""}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </div>
  )
}
