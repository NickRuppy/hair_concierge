"use client"

import { useAuth } from "@/providers/auth-provider"
import { Menu, MessageCircle, User, LogOut, Shield } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"

export function Header() {
  const { profile, signOut } = useAuth()
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)

  // Don't show header on auth or onboarding pages
  if (pathname.startsWith("/auth") || pathname.startsWith("/onboarding")) {
    return null
  }

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <Link href="/start" className="flex items-center gap-2">
          <span className="text-xl font-bold text-primary">Hair Concierge</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex">
          <NavLink href="/start" current={pathname}>
            Start
          </NavLink>
          <NavLink href="/chat" current={pathname}>
            <MessageCircle className="mr-1.5 h-4 w-4" />
            Chat
          </NavLink>
          <NavLink href="/profile" current={pathname}>
            <User className="mr-1.5 h-4 w-4" />
            Profil
          </NavLink>
          {profile?.is_admin && (
            <NavLink href="/admin" current={pathname}>
              <Shield className="mr-1.5 h-4 w-4" />
              Admin
            </NavLink>
          )}
          <button
            onClick={signOut}
            className="ml-2 inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <LogOut className="h-4 w-4" />
            Abmelden
          </button>
        </nav>

        {/* Mobile menu button */}
        <button
          className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent md:hidden"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="border-t bg-background p-4 md:hidden">
          <nav className="flex flex-col gap-1">
            <MobileNavLink
              href="/start"
              current={pathname}
              onClick={() => setMenuOpen(false)}
            >
              Start
            </MobileNavLink>
            <MobileNavLink
              href="/chat"
              current={pathname}
              onClick={() => setMenuOpen(false)}
            >
              <MessageCircle className="mr-2 h-4 w-4" />
              Chat
            </MobileNavLink>
            <MobileNavLink
              href="/profile"
              current={pathname}
              onClick={() => setMenuOpen(false)}
            >
              <User className="mr-2 h-4 w-4" />
              Profil
            </MobileNavLink>
            {profile?.is_admin && (
              <MobileNavLink
                href="/admin"
                current={pathname}
                onClick={() => setMenuOpen(false)}
              >
                <Shield className="mr-2 h-4 w-4" />
                Admin
              </MobileNavLink>
            )}
            <button
              onClick={() => {
                setMenuOpen(false)
                signOut()
              }}
              className="inline-flex items-center rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Abmelden
            </button>
          </nav>
        </div>
      )}
    </header>
  )
}

function NavLink({
  href,
  current,
  children,
}: {
  href: string
  current: string
  children: React.ReactNode
}) {
  const isActive = current === href || current.startsWith(href + "/")
  return (
    <Link
      href={href}
      className={`inline-flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors ${
        isActive
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      }`}
    >
      {children}
    </Link>
  )
}

function MobileNavLink({
  href,
  current,
  onClick,
  children,
}: {
  href: string
  current: string
  onClick: () => void
  children: React.ReactNode
}) {
  const isActive = current === href || current.startsWith(href + "/")
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`inline-flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors ${
        isActive
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      }`}
    >
      {children}
    </Link>
  )
}
