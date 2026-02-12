"use client"

import type { Article } from "@/lib/types"
import Link from "next/link"
import { format } from "date-fns"
import { de } from "date-fns/locale"

export function ArticleGrid({ articles }: { articles: Article[] }) {
  if (articles.length === 0) return null

  return (
    <section>
      <h2 className="mb-4 text-lg font-bold">Neues aus der Haarwelt</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {articles.map((article) => (
          <Link
            key={article.id}
            href={`/articles/${article.slug}`}
            className="group overflow-hidden rounded-xl border bg-card shadow-sm transition-shadow hover:shadow-md"
          >
            {article.cover_image_url && (
              <img
                src={article.cover_image_url}
                alt={article.title}
                className="h-40 w-full object-cover transition-transform group-hover:scale-105"
              />
            )}
            <div className="p-4">
              {article.category && (
                <span className="text-xs font-medium text-primary">
                  {article.category}
                </span>
              )}
              <h3 className="mt-1 text-sm font-semibold leading-tight group-hover:text-primary">
                {article.title}
              </h3>
              {article.excerpt && (
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                  {article.excerpt}
                </p>
              )}
              {article.published_at && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {format(new Date(article.published_at), "dd. MMMM yyyy", {
                    locale: de,
                  })}
                </p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
