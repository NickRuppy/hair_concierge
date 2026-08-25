"use client"

import { createElement, useEffect, useState } from "react"
import Script from "next/script"

const WISTIA_MEDIA_ID = "nwrpfub965"
const WISTIA_ASPECT_RATIO = "1.7777777777777777"
const WISTIA_PLAYER_SCRIPT = "https://fast.wistia.com/player.js"
const WISTIA_MEDIA_SCRIPT = `https://fast.wistia.com/embed/${WISTIA_MEDIA_ID}.js`

export function WistiaVideo() {
  const [loadFailed, setLoadFailed] = useState(false)

  useEffect(() => {
    if (window.customElements.get("wistia-player")) return

    const timeout = window.setTimeout(() => {
      if (!window.customElements.get("wistia-player")) setLoadFailed(true)
    }, 12_000)

    void window.customElements.whenDefined("wistia-player").then(() => {
      window.clearTimeout(timeout)
    })

    return () => window.clearTimeout(timeout)
  }, [])

  const player = createElement("wistia-player", {
    "aria-label": "Video zu deinem persönlichen Haarplan",
    aspect: WISTIA_ASPECT_RATIO,
    autoplay: "true",
    "media-id": WISTIA_MEDIA_ID,
    preload: "auto",
    "silent-autoplay": "true",
  })

  return (
    <>
      <div
        className="mx-auto mt-4 max-w-[720px] overflow-hidden rounded-[1.25rem] bg-[#eee8f6] shadow-[0_18px_48px_-30px_rgba(var(--brand-plum-rgb),0.55)] sm:mt-5 sm:rounded-[1.5rem]"
        data-organic-offer-video=""
        data-organic-offer-video-state={loadFailed ? "error" : "loading_or_ready"}
      >
        {loadFailed ? (
          <div className="grid aspect-video place-items-center px-6 py-8 text-center" role="status">
            <div>
              <p className="font-semibold">Das Video konnte nicht geladen werden.</p>
              <button
                className="mt-3 text-sm font-semibold text-[var(--brand-plum)] underline underline-offset-4"
                onClick={() => window.location.reload()}
                type="button"
              >
                Seite neu laden
              </button>
            </div>
          </div>
        ) : (
          player
        )}
      </div>

      <style>{`
        wistia-player[media-id='${WISTIA_MEDIA_ID}'] {
          display: block;
          width: 100%;
        }

        wistia-player[media-id='${WISTIA_MEDIA_ID}']:not(:defined) {
          background: center / contain no-repeat url('https://fast.wistia.com/embed/medias/${WISTIA_MEDIA_ID}/swatch');
          filter: blur(5px);
          padding-top: 56.25%;
        }
      `}</style>

      <Script
        onError={() => setLoadFailed(true)}
        src={WISTIA_PLAYER_SCRIPT}
        strategy="afterInteractive"
      />
      <Script
        onError={() => setLoadFailed(true)}
        src={WISTIA_MEDIA_SCRIPT}
        strategy="afterInteractive"
        type="module"
      />
    </>
  )
}
