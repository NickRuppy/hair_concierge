"use client"

import * as React from "react"
import Link from "next/link"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { COOKIE_CONSENT_OPEN_SETTINGS_EVENT, loadConsent, saveConsent } from "@/lib/cookie-consent"

export function CookieConsent() {
  const [mounted, setMounted] = React.useState(false)
  const [bannerVisible, setBannerVisible] = React.useState(false)
  const [settingsOpen, setSettingsOpen] = React.useState(false)
  const [analytics, setAnalytics] = React.useState(false)
  const [marketing, setMarketing] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
    const existing = loadConsent()
    if (existing) {
      setAnalytics(existing.analytics)
      setMarketing(existing.marketing)
    } else {
      const timer = window.setTimeout(() => setBannerVisible(true), 800)
      return () => window.clearTimeout(timer)
    }
  }, [])

  React.useEffect(() => {
    const handleOpen = () => {
      const current = loadConsent()
      setAnalytics(current?.analytics ?? false)
      setMarketing(current?.marketing ?? false)
      setSettingsOpen(true)
    }
    window.addEventListener(COOKIE_CONSENT_OPEN_SETTINGS_EVENT, handleOpen)

    const handleTriggerClick = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return
      const trigger = target.closest("[data-cookie-settings-trigger]")
      if (trigger) {
        event.preventDefault()
        handleOpen()
      }
    }
    document.addEventListener("click", handleTriggerClick)

    return () => {
      window.removeEventListener(COOKIE_CONSENT_OPEN_SETTINGS_EVENT, handleOpen)
      document.removeEventListener("click", handleTriggerClick)
    }
  }, [])

  const persist = React.useCallback((next: { analytics: boolean; marketing: boolean }) => {
    saveConsent(next)
    setAnalytics(next.analytics)
    setMarketing(next.marketing)
    setBannerVisible(false)
    setSettingsOpen(false)
  }, [])

  const acceptAll = () => persist({ analytics: true, marketing: true })
  const rejectAll = () => persist({ analytics: false, marketing: false })
  const saveSelection = () => persist({ analytics, marketing })

  if (!mounted) return null

  return (
    <>
      {bannerVisible && (
        <div
          role="dialog"
          aria-label="Cookie-Einstellungen"
          className="fixed bottom-3 left-3 right-3 z-40 max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl sm:bottom-6 sm:left-6 sm:right-auto"
        >
          <h2 className="text-base font-semibold text-foreground">Wir verwenden Cookies</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Einige Cookies sind technisch notwendig, andere helfen uns, unseren Dienst zu verbessern
            oder dir personalisierte Inhalte zu zeigen. Du kannst frei wählen. Mehr in unserer{" "}
            <Link href="/datenschutz" className="underline">
              Datenschutzerklärung
            </Link>
            .
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={rejectAll}
              className="flex-1"
            >
              Nur essentielle
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSettingsOpen(true)}
              className="flex-1"
            >
              Einstellungen
            </Button>
            <Button type="button" size="sm" onClick={acceptAll} className="flex-1">
              Alle akzeptieren
            </Button>
          </div>
        </div>
      )}

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent>
          <div className="space-y-4">
            <div>
              <h3 className="font-header text-2xl text-foreground">Cookie-Einstellungen</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Entscheide selbst, welche Cookies du zulassen möchtest. Deine Auswahl gilt nur für
                diese Website.
              </p>
            </div>

            <div className="space-y-3 border-t border-border pt-4">
              <CategoryRow
                title="Essenziell"
                description="Notwendig für den Betrieb (Anmeldung, Speicherung deiner Cookie-Auswahl). Diese können nicht deaktiviert werden."
                locked
                value={true}
                onChange={() => {}}
              />
              <CategoryRow
                title="Analyse"
                description="PostHog. Hilft uns zu verstehen, wie Besucher die Website nutzen."
                value={analytics}
                onChange={setAnalytics}
              />
              <CategoryRow
                title="Marketing"
                description="Meta Pixel (Facebook / Instagram). Für personalisierte Werbung auf Drittplattformen."
                value={marketing}
                onChange={setMarketing}
              />
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <Button type="button" variant="outline" onClick={rejectAll} className="flex-1">
                Nur essentielle
              </Button>
              <Button type="button" onClick={saveSelection} className="flex-1">
                Auswahl speichern
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function CategoryRow({
  title,
  description,
  value,
  onChange,
  locked = false,
}: {
  title: string
  description: string
  value: boolean
  onChange: (next: boolean) => void
  locked?: boolean
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <Switch
        checked={value}
        disabled={locked}
        aria-label={`${title} ${value ? "deaktivieren" : "aktivieren"}`}
        onCheckedChange={(next) => {
          if (locked) return
          onChange(next)
        }}
      />
    </div>
  )
}
