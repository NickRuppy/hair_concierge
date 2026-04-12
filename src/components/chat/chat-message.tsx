"use client"

import { useEffect, useMemo, useRef, type ReactNode } from "react"
import posthog from "posthog-js"
import type { Message, CitationSource, Product, HairProfile } from "@/lib/types"
import type { Components } from "react-markdown"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { CitationBadge } from "./citation-badge"
import { ProductPopover } from "./product-popover"

/**
 * Renumbers [N] citation markers in content so they appear as [1], [2], [3]
 * in order of first appearance in the text, and remaps sources to match.
 */
function renumberCitations(
  content: string,
  sources: CitationSource[],
): { content: string; sources: CitationSource[] } {
  if (sources.length === 0) return { content, sources }

  const validIndices = new Set(sources.map((s) => s.index))
  const sourceByOldIndex = new Map(sources.map((s) => [s.index, s]))

  // Collect first-appearance order of valid citation indices
  const seen = new Set<number>()
  const appearanceOrder: number[] = []
  const regex = /\[(\d+)\]/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(content)) !== null) {
    const idx = parseInt(match[1], 10)
    if (validIndices.has(idx) && !seen.has(idx)) {
      seen.add(idx)
      appearanceOrder.push(idx)
    }
  }

  if (appearanceOrder.length === 0) return { content, sources }

  // Check if already in order
  const isAlreadyOrdered = appearanceOrder.every((idx, i) => idx === i + 1)
  if (isAlreadyOrdered && appearanceOrder.length === sources.length) {
    return { content, sources }
  }

  // Build old -> new mapping
  const oldToNew = new Map<number, number>()
  appearanceOrder.forEach((oldIdx, i) => oldToNew.set(oldIdx, i + 1))

  // Replace citations in content
  const renumberedContent = content.replace(/\[(\d+)\]/g, (full, d) => {
    const oldIdx = parseInt(d, 10)
    const newIdx = oldToNew.get(oldIdx)
    return newIdx !== undefined ? `[${newIdx}]` : full
  })

  // Remap referenced sources, then append unreferenced ones
  const remappedSources: CitationSource[] = appearanceOrder.map((oldIdx, i) => ({
    ...sourceByOldIndex.get(oldIdx)!,
    index: i + 1,
  }))
  let nextIndex = remappedSources.length + 1
  for (const s of sources) {
    if (!oldToNew.has(s.index)) {
      remappedSources.push({ ...s, index: nextIndex++ })
    }
  }

  return { content: renumberedContent, sources: remappedSources }
}

interface ChatMessageProps {
  message: Message
  hairProfile: HairProfile | null
  onProductClick?: (product: Product) => void
  /** True for messages appended during this session (not history loads) */
  isNew?: boolean
}

/**
 * Splits a text string on [N] markers and interleaves CitationBadge components
 * for any N that exists in the sourceMap.
 */
function renderWithCitations(text: string, sourceMap: Map<number, CitationSource>): ReactNode[] {
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
 * Scans text nodes for product name matches and wraps them in clickable buttons.
 */
function renderWithProductMentions(
  nodes: ReactNode[],
  productMap: Map<string, Product>,
  hairProfile: HairProfile | null,
  onProductClick?: (product: Product) => void,
): ReactNode[] {
  if (productMap.size === 0 || !onProductClick) return nodes

  const result: ReactNode[] = []

  for (const node of nodes) {
    if (typeof node !== "string") {
      result.push(node)
      continue
    }

    // Try to find product names in text, sorted by length (longest first to avoid partial matches)
    const names = Array.from(productMap.keys()).sort((a, b) => b.length - a.length)
    let remaining = node
    let key = 0

    while (remaining.length > 0) {
      let earliest = -1
      let matchedName = ""

      for (const name of names) {
        const idx = remaining.indexOf(name)
        if (idx !== -1 && (earliest === -1 || idx < earliest)) {
          earliest = idx
          matchedName = name
        }
      }

      if (earliest === -1) {
        result.push(remaining)
        break
      }

      // Push text before the match
      if (earliest > 0) {
        result.push(remaining.slice(0, earliest))
      }

      // Push the clickable product mention wrapped in popover
      const product = productMap.get(matchedName)!
      result.push(
        <ProductPopover
          key={`pm-${key++}`}
          product={product}
          hairProfile={hairProfile}
          onProductClick={onProductClick}
        >
          <button
            type="button"
            onClick={() => onProductClick(product)}
            className="inline font-semibold text-primary underline decoration-primary/30 underline-offset-2 transition-colors hover:text-primary/80 hover:decoration-primary/60"
          >
            {matchedName}
          </button>
        </ProductPopover>,
      )

      remaining = remaining.slice(earliest + matchedName.length)
    }
  }

  return result
}

/**
 * Recursively processes React children, replacing string segments that contain
 * [N] citation markers with CitationBadge components, then product mentions.
 * Also recurses into React elements (e.g. <strong>, <em>) so product names
 * inside bold/italic markdown formatting are still matched.
 */
function processChildren(
  children: ReactNode,
  sourceMap: Map<number, CitationSource>,
  productMap: Map<string, Product>,
  hairProfile: HairProfile | null,
  onProductClick?: (product: Product) => void,
): ReactNode {
  if (typeof children === "string") {
    const cited = renderWithCitations(children, sourceMap)
    return renderWithProductMentions(cited, productMap, hairProfile, onProductClick)
  }
  if (Array.isArray(children)) {
    return children.map((child, i) => {
      const processed = processChildren(child, sourceMap, productMap, hairProfile, onProductClick)
      // Wrap arrays in a span for valid React keys
      if (Array.isArray(processed)) {
        return <span key={i}>{processed}</span>
      }
      return processed
    })
  }
  // Recurse into React elements (e.g. <strong>, <em>, <a>)
  if (children !== null && typeof children === "object" && "props" in children) {
    const element = children as React.ReactElement<{ children?: ReactNode }>
    if (element.props.children) {
      const processed = processChildren(
        element.props.children,
        sourceMap,
        productMap,
        hairProfile,
        onProductClick,
      )
      // Clone the element with processed children
      return { ...element, props: { ...element.props, children: processed } }
    }
  }
  return children
}

export function ChatMessage({ message, hairProfile, onProductClick, isNew }: ChatMessageProps) {
  const isUser = message.role === "user"

  const { content: renumberedContent, sources } = useMemo(
    () => renumberCitations(message.content ?? "", message.rag_context?.sources ?? []),
    [message.content, message.rag_context?.sources],
  )

  const sourceMap = new Map(sources.map((s) => [s.index, s]))

  // Build product name -> Product map for inline mentions
  const products: Product[] = message.product_recommendations ?? []
  const productMap = new Map(products.map((p) => [p.name, p]))

  // Track product recommendation shown event (fire once per message)
  const trackedRef = useRef(false)
  useEffect(() => {
    if (products.length > 0 && !trackedRef.current) {
      trackedRef.current = true
      posthog.capture("chat_product_recommendation_shown", {
        productCount: products.length,
      })
    }
  }, [products.length])

  const hasEnhancements = sources.length > 0 || productMap.size > 0

  // Build custom markdown components that inject citation badges + product mentions
  const markdownComponents: Components = hasEnhancements
    ? {
        p({ children }) {
          return (
            <p>{processChildren(children, sourceMap, productMap, hairProfile, onProductClick)}</p>
          )
        },
        li({ children }) {
          return (
            <li>{processChildren(children, sourceMap, productMap, hairProfile, onProductClick)}</li>
          )
        },
        strong({ children }) {
          return (
            <strong>
              {processChildren(children, sourceMap, productMap, hairProfile, onProductClick)}
            </strong>
          )
        },
        em({ children }) {
          return (
            <em>{processChildren(children, sourceMap, productMap, hairProfile, onProductClick)}</em>
          )
        },
      }
    : {}

  return (
    <div
      data-testid={isUser ? "message-user" : "message-assistant"}
      className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}${isNew ? " animate-fade-in-up-fast" : ""}`}
    >
      {/* Avatar */}
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
          isUser ? "bg-primary text-primary-foreground" : "bg-primary text-primary-foreground"
        }`}
      >
        {isUser ? "Du" : "HC"}
      </div>

      {/* Content */}
      <div className={`max-w-[80%] space-y-2 ${isUser ? "items-end" : "items-start"}`}>
        {/* Text content */}
        {message.content && (
          <div
            className={`rounded-2xl px-4 py-2.5 ${
              isUser ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
            }`}
          >
            {isUser ? (
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
            ) : (
              <div className="prose prose-sm max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                  {renumberedContent}
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
