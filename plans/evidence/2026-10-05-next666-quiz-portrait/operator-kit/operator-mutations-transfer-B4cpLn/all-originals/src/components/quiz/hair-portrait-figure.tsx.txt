import Image from "next/image"

import {
  PORTRAIT_BODY_VIEW_BOX,
  PORTRAIT_SHARED_BODY_PATHS,
  resolveHairPortraitAsset,
} from "@/lib/quiz/hair-portrait-assets"
import type { PortraitConfig } from "@/lib/quiz/portrait-config"
import { cn } from "@/lib/utils"

interface HairPortraitFigureProps {
  config: PortraitConfig
  className?: string
  padded?: boolean
  priority?: boolean
}

/**
 * Canonical hair portrait asset plus the shared neck/shoulder outline.
 * The image is decorative: the surrounding button supplies the answer label.
 */
export function HairPortraitFigure({
  config,
  className,
  padded = false,
  priority = false,
}: HairPortraitFigureProps) {
  const asset = resolveHairPortraitAsset(config)

  return (
    <div className={cn("relative aspect-square w-full", padded && "p-2", className)}>
      {!asset.ownBody ? (
        <svg
          aria-hidden="true"
          className="absolute inset-0 h-full w-full overflow-visible"
          preserveAspectRatio="xMidYMid meet"
          viewBox={PORTRAIT_BODY_VIEW_BOX}
        >
          {PORTRAIT_SHARED_BODY_PATHS.map((path) => (
            <path
              className="fill-none stroke-[#8f84a8] stroke-[7] [stroke-linecap:round] [stroke-linejoin:round]"
              d={path}
              key={path}
            />
          ))}
        </svg>
      ) : null}
      <Image
        alt=""
        className="relative block h-full w-full object-contain"
        height={720}
        priority={priority}
        src={asset.src}
        unoptimized
        width={720}
      />
    </div>
  )
}
