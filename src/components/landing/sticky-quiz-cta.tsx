"use client"

import * as React from "react"
import Link from "next/link"

import { cn } from "@/lib/utils"

const CTA_OFFSET = "var(--landing-sticky-cta-clearance)"

export function StickyQuizCta() {
  const [isVisible, setIsVisible] = React.useState(false)

  React.useEffect(() => {
    const heroCta = document.querySelector("[data-landing-hero-cta]")

    if (!heroCta || !("IntersectionObserver" in window)) {
      const updateVisibility = () => setIsVisible(window.scrollY > 80)

      updateVisibility()
      window.addEventListener("scroll", updateVisibility, { passive: true })
      window.addEventListener("resize", updateVisibility)

      return () => {
        window.removeEventListener("scroll", updateVisibility)
        window.removeEventListener("resize", updateVisibility)
      }
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(!entry.isIntersecting)
      },
      { threshold: 0 },
    )

    observer.observe(heroCta)

    return () => observer.disconnect()
  }, [])

  React.useEffect(() => {
    const root = document.documentElement

    if (isVisible) {
      root.style.setProperty("--landing-sticky-cta-offset", CTA_OFFSET)
    } else {
      root.style.removeProperty("--landing-sticky-cta-offset")
    }

    return () => {
      root.style.removeProperty("--landing-sticky-cta-offset")
    }
  }, [isVisible])

  return (
    <div
      data-landing-sticky-cta
      aria-hidden={!isVisible}
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 border-t border-border bg-[rgba(253,251,249,0.92)] px-4 pb-[calc(10px+env(safe-area-inset-bottom))] pt-2.5 backdrop-blur-[10px] transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none md:hidden",
        isVisible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-full opacity-0",
      )}
    >
      <Link
        href="/quiz"
        prefetch={false}
        tabIndex={isVisible ? undefined : -1}
        className="mx-auto block max-w-[560px] rounded-[12px] bg-[var(--brand-coral)] py-3 text-center font-bold text-[15.5px] text-white transition-colors hover:bg-[var(--brand-coral-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-coral-dark)]"
      >
        Kostenlose Haaranalyse starten
        <span className="block text-[11.5px] font-normal text-white/85">
          2 Minuten · ohne Anmeldung
        </span>
      </Link>
    </div>
  )
}
