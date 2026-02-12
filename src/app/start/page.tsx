"use client"

import { Header } from "@/components/layout/header"
import { QuoteCard } from "@/components/start/quote-card"
import { ProductRow } from "@/components/start/product-row"
import { ArticleGrid } from "@/components/start/article-grid"
import type { DailyQuote, Product, Article } from "@/lib/types"
import { MessageCircle, Sparkles } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"

export default function StartPage() {
  const [quote, setQuote] = useState<DailyQuote | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch("/api/start")
        if (res.ok) {
          const data = await res.json()
          setQuote(data.quote)
          setProducts(data.products || [])
          setArticles(data.articles || [])
        }
      } catch (err) {
        console.error("Failed to load start page data:", err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  if (loading) {
    return (
      <>
        <Header />
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </>
    )
  }

  return (
    <>
      <Header />
      <main className="mx-auto max-w-5xl space-y-8 px-4 py-8">
        {/* Quote of the day */}
        <QuoteCard quote={quote} />

        {/* Recommended products */}
        <ProductRow products={products} />

        {/* Articles */}
        <ArticleGrid articles={articles} />

        {/* Chat CTA */}
        <section className="flex justify-center pb-8">
          <Link
            href="/chat"
            className="group inline-flex items-center gap-3 rounded-2xl bg-gradient-to-r from-pink-500 to-purple-600 px-8 py-4 text-lg font-bold text-white shadow-lg transition-all hover:scale-105 hover:shadow-xl"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="text-left">
              <p className="text-base font-bold">Frag deine Haar-Beraterin</p>
              <p className="text-sm font-normal opacity-80">
                Personalisierte Tipps & Empfehlungen
              </p>
            </div>
            <MessageCircle className="ml-2 h-6 w-6 transition-transform group-hover:translate-x-1" />
          </Link>
        </section>
      </main>
    </>
  )
}
