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
  Sparkles,
  PhoneCall,
} from "lucide-react"
import { AppRouteProviders } from "@/providers/route-providers"

const adminNav = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/quotes", label: "Zitate", icon: Quote },
  { href: "/admin/articles", label: "Artikel", icon: FileText },
  { href: "/admin/products", label: "Produkte", icon: Package },
  { href: "/admin/users", label: "Nutzer", icon: Users },
  { href: "/admin/partner-access", label: "Partnerzugänge", icon: Sparkles },
  { href: "/admin/beratung", label: "Beratungen", icon: PhoneCall },
  { href: "/admin/conversations", label: "Chats", icon: MessageCircle },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <AppRouteProviders>
      {/*
        Printing an admin page prints the page, not the tool around it — the discovery routine
        document (`/admin/beratung/<id>/pdf`) is an A4 sheet a participant receives.

        Two rules these wrappers obey:
          - `contents` generates NO box on screen, so the header keeps `body` as its sticky
            containing block and the sidebar/mobile-nav stay flex items of the row. A real
            wrapper div would collapse the header's sticky range to its own height.
          - the wrapper carries no responsive display utility. `print:hidden` on an element
            that also has `md:block` loses: Tailwind emits breakpoint variants after `print`,
            and an A4 portrait page (~794px at `@page { margin: 0 }`) matches `md`.
      */}
      <div className="contents print:hidden">
        <Header />
      </div>
      <div className="flex min-h-[calc(100vh-3.5rem)] print:block print:min-h-0">
        <div className="contents print:hidden">
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
                      isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {item.label}
                  </Link>
                )
              })}
            </div>
          </div>
        </div>

        {/* Content */}
        <main className="flex-1 p-6 print:p-0">{children}</main>
      </div>
    </AppRouteProviders>
  )
}
