"use client"

import { createClient } from "@/lib/supabase/client"
import { Users, MessageCircle, Package, FileText } from "lucide-react"
import { useEffect, useState } from "react"

interface Stats {
  userCount: number
  messageCount: number
  productCount: number
  articleCount: number
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({
    userCount: 0,
    messageCount: 0,
    productCount: 0,
    articleCount: 0,
  })
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function loadStats() {
      const [
        { count: userCount },
        { count: messageCount },
        { count: productCount },
        { count: articleCount },
      ] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("messages").select("*", { count: "exact", head: true }),
        supabase.from("products").select("*", { count: "exact", head: true }),
        supabase.from("articles").select("*", { count: "exact", head: true }),
      ])

      setStats({
        userCount: userCount || 0,
        messageCount: messageCount || 0,
        productCount: productCount || 0,
        articleCount: articleCount || 0,
      })
      setLoading(false)
    }
    loadStats()
  }, [supabase])

  const cards = [
    {
      label: "Nutzer",
      value: stats.userCount,
      icon: Users,
      color: "text-blue-500",
    },
    {
      label: "Nachrichten",
      value: stats.messageCount,
      icon: MessageCircle,
      color: "text-green-500",
    },
    {
      label: "Produkte",
      value: stats.productCount,
      icon: Package,
      color: "text-secondary",
    },
    {
      label: "Artikel",
      value: stats.articleCount,
      icon: FileText,
      color: "text-orange-500",
    },
  ]

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Dashboard</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <div
              key={card.label}
              className="rounded-xl border bg-card p-6 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{card.label}</p>
                  <p className="mt-1 text-3xl font-bold">
                    {loading ? "—" : card.value}
                  </p>
                </div>
                <Icon className={`h-8 w-8 ${card.color} opacity-80`} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
