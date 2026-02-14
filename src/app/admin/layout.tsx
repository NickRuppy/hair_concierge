"use client"

import { Header } from "@/components/layout/header"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Quote,
  FileText,
  Package,
  Users,
  MessageCircle,
} from "lucide-react"

const adminNav = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/quotes", label: "Zitate", icon: Quote },
  { href: "/admin/articles", label: "Artikel", icon: FileText },
  { href: "/admin/products", label: "Produkte", icon: Package },
  { href: "/admin/users", label: "Nutzer", icon: Users },
  { href: "/admin/conversations", label: "Chats", icon: MessageCircle },
]

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  return (
    <>
      <Header />
      <div className="flex min-h-[calc(100vh-3.5rem)]">
        {/* Sidebar */}
        <aside className="hidden w-56 shrink-0 border-r bg-sidebar p-4 md:block">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Admin
          </p>
          <nav className="space-y-1">
            {adminNav.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/admin" && pathname.startsWith(item.href))
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </aside>

        {/* Mobile nav */}
        <div className="border-b p-2 md:hidden">
          <div className="flex gap-1 overflow-x-auto">
            {adminNav.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/admin" && pathname.startsWith(item.href))
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                </Link>
              )
            })}
          </div>
        </div>

        {/* Content */}
        <main className="flex-1 p-6">{children}</main>
      </div>
    </>
  )
}
