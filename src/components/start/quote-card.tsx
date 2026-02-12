"use client"

import type { DailyQuote } from "@/lib/types"
import { Quote } from "lucide-react"

export function QuoteCard({ quote }: { quote: DailyQuote | null }) {
  if (!quote) return null

  return (
    <div className="relative overflow-hidden rounded-xl bg-secondary/10 p-6">
      <Quote className="absolute right-4 top-4 h-8 w-8 text-primary/20" />
      <blockquote className="relative">
        <p className="text-lg font-medium italic leading-relaxed text-foreground">
          &ldquo;{quote.quote_text}&rdquo;
        </p>
        {quote.author && (
          <footer className="mt-3 text-sm text-muted-foreground">
            — {quote.author}
          </footer>
        )}
      </blockquote>
    </div>
  )
}
