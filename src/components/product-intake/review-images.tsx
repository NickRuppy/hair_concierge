"use client"

import { useCallback, useState } from "react"
import type { ProductReviewImage } from "@/lib/product-intake/admin-review-repository"

function ReviewImage({
  image,
  label,
  reloadHref,
  onRendered,
}: {
  image?: ProductReviewImage
  label: string
  reloadHref: string
  onRendered?: (kind: string, available: boolean) => void
}) {
  const [failed, setFailed] = useState(false)
  const imageRef = useCallback(
    (node: HTMLImageElement | null) => {
      // A signed URL can fail before hydration attaches onError. Check the
      // already-loaded DOM image when React attaches, too.
      if (node?.complete) {
        const loaded = node.naturalWidth > 0
        if (!loaded) setFailed(true)
        if (image) onRendered?.(image.kind, loaded)
      }
    },
    [image, onRendered],
  )
  const available = image?.signed_url && !failed
  return (
    <figure className="min-w-0 rounded-lg border bg-muted/20 p-2">
      <figcaption className="mb-2 flex min-h-8 items-center justify-center text-center text-xs font-medium">
        {label}
      </figcaption>
      {available ? (
        <a
          href={image.signed_url!}
          target="_blank"
          rel="noreferrer"
          aria-label={`${label} groß ansehen`}
        >
          {/* Signed private URLs must be delivered directly, never cached by the Next image proxy. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imageRef}
            src={image.signed_url!}
            alt={label}
            referrerPolicy="no-referrer"
            onLoad={() => onRendered?.(image.kind, true)}
            onError={() => {
              setFailed(true)
              onRendered?.(image.kind, false)
            }}
            className="h-44 w-full rounded object-contain outline outline-1 outline-black/10"
          />
        </a>
      ) : (
        <div className="flex min-h-44 flex-col items-center justify-center gap-2 px-1 text-center text-xs text-muted-foreground">
          <p>
            {image
              ? "Bildansicht nicht verfügbar oder abgelaufen."
              : "Noch kein Bild für diese Version gespeichert."}
          </p>
          {image && (
            <a
              className="inline-flex min-h-11 items-center text-primary underline"
              href={reloadHref}
            >
              Neu laden
            </a>
          )}
        </div>
      )}
    </figure>
  )
}

export function ProductReviewImages({
  images = [],
  reloadHref,
  onRendered,
}: {
  images?: ProductReviewImage[]
  reloadHref: string
  onRendered?: (kind: string, available: boolean) => void
}) {
  return (
    <div className="mt-4 grid grid-cols-3 gap-2">
      {(
        [
          ["raw", "Rohbild"],
          ["magenta", "Magenta-Prüfung"],
          ["final", "Katalogbild"],
        ] as const
      ).map(([kind, label]) => (
        <ReviewImage
          key={`${kind}-${images.find((image) => image.kind === kind)?.signed_url ?? "missing"}`}
          image={images.find((image) => image.kind === kind)}
          label={label}
          reloadHref={reloadHref}
          onRendered={onRendered}
        />
      ))}
    </div>
  )
}
