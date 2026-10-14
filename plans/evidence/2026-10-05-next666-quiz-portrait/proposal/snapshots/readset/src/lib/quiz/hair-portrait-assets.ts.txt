import type { PortraitConfig, PortraitHairPattern, PortraitLength } from "./portrait-config"

export const PORTRAIT_MARKER_KEYS = ["scalp", "lengths", "ends"] as const

export type PortraitMarkerKey = (typeof PORTRAIT_MARKER_KEYS)[number]

export interface PortraitMarkerPoint {
  x: number
  y: number
}

export interface HairPortraitAsset {
  src: string
  ownBody: boolean
  markers: Record<PortraitMarkerKey, PortraitMarkerPoint>
}

type PortraitAssetLength = "very-short" | "short" | "medium" | "long" | "very-long"
type PortraitAssetKey = `${PortraitHairPattern}-${PortraitAssetLength}`

const ASSET_DIRECTORY = "/images/quiz/hair-portrait"

const LENGTH_FILE_SEGMENTS: Record<PortraitLength, PortraitAssetLength> = {
  very_short: "very-short",
  short: "short",
  medium: "medium",
  long: "long",
  very_long: "very-long",
}

function asset(
  filename: string,
  markers: Record<PortraitMarkerKey, PortraitMarkerPoint>,
  ownBody = false,
): HairPortraitAsset {
  return { src: `${ASSET_DIRECTORY}/${filename}.webp`, ownBody, markers }
}

export const PORTRAIT_ASSET_MANIFEST = {
  "straight-very-short": asset(
    "straight-very-short",
    { scalp: { x: 50, y: 18 }, lengths: { x: 80, y: 43 }, ends: { x: 21, y: 61 } },
    true,
  ),
  "straight-short": asset("straight-short", {
    scalp: { x: 50, y: 20 },
    lengths: { x: 78, y: 53 },
    ends: { x: 22, y: 72 },
  }),
  "straight-medium": asset("straight-medium", {
    scalp: { x: 50, y: 20 },
    lengths: { x: 79, y: 56 },
    ends: { x: 21, y: 78 },
  }),
  "straight-long": asset("straight-long", {
    scalp: { x: 50, y: 18 },
    lengths: { x: 80, y: 59 },
    ends: { x: 20, y: 82 },
  }),
  "straight-very-long": asset("straight-very-long", {
    scalp: { x: 50, y: 18 },
    lengths: { x: 80, y: 64 },
    ends: { x: 20, y: 82 },
  }),
  "wavy-very-short": asset(
    "wavy-very-short",
    { scalp: { x: 48, y: 18 }, lengths: { x: 81, y: 44 }, ends: { x: 20, y: 64 } },
    true,
  ),
  "wavy-short": asset("wavy-short", {
    scalp: { x: 49, y: 20 },
    lengths: { x: 80, y: 53 },
    ends: { x: 20, y: 73 },
  }),
  "wavy-medium": asset("wavy-medium", {
    scalp: { x: 49, y: 20 },
    lengths: { x: 81, y: 56 },
    ends: { x: 20, y: 79 },
  }),
  "wavy-long": asset("wavy-long", {
    scalp: { x: 49, y: 18 },
    lengths: { x: 81, y: 59 },
    ends: { x: 19, y: 82 },
  }),
  "wavy-very-long": asset("wavy-very-long", {
    scalp: { x: 49, y: 18 },
    lengths: { x: 81, y: 64 },
    ends: { x: 19, y: 82 },
  }),
  "curly-very-short": asset(
    "curly-very-short",
    { scalp: { x: 50, y: 18 }, lengths: { x: 80, y: 48 }, ends: { x: 21, y: 65 } },
    true,
  ),
  "curly-short": asset("curly-short", {
    scalp: { x: 50, y: 20 },
    lengths: { x: 80, y: 54 },
    ends: { x: 20, y: 74 },
  }),
  "curly-medium": asset("curly-medium", {
    scalp: { x: 50, y: 20 },
    lengths: { x: 81, y: 57 },
    ends: { x: 19, y: 80 },
  }),
  "curly-long": asset("curly-long", {
    scalp: { x: 50, y: 18 },
    lengths: { x: 81, y: 60 },
    ends: { x: 19, y: 82 },
  }),
  "curly-very-long": asset("curly-very-long", {
    scalp: { x: 50, y: 18 },
    lengths: { x: 81, y: 65 },
    ends: { x: 19, y: 82 },
  }),
  "coily-very-short": asset("coily-very-short", {
    scalp: { x: 50, y: 18 },
    lengths: { x: 80, y: 46 },
    ends: { x: 20, y: 66 },
  }),
  "coily-short": asset("coily-short", {
    scalp: { x: 50, y: 20 },
    lengths: { x: 80, y: 54 },
    ends: { x: 20, y: 74 },
  }),
  "coily-medium": asset("coily-medium", {
    scalp: { x: 50, y: 20 },
    lengths: { x: 81, y: 58 },
    ends: { x: 19, y: 80 },
  }),
  "coily-long": asset("coily-long", {
    scalp: { x: 50, y: 18 },
    lengths: { x: 81, y: 62 },
    ends: { x: 19, y: 82 },
  }),
  "coily-very-long": asset("coily-very-long", {
    scalp: { x: 50, y: 18 },
    lengths: { x: 81, y: 67 },
    ends: { x: 19, y: 82 },
  }),
} as const satisfies Record<PortraitAssetKey, HairPortraitAsset>

export const GENERIC_PORTRAIT_ASSET = asset("generic", {
  scalp: { x: 50, y: 18 },
  lengths: { x: 80, y: 53 },
  ends: { x: 20, y: 78 },
})

export const PORTRAIT_BODY_VIEW_BOX = "0 0 1024 1024"

export const PORTRAIT_SHARED_BODY_PATHS = [
  "M448 560 C446 610 438 652 424 684",
  "M576 560 C578 610 586 652 600 684",
  "M424 684 C330 704 240 736 186 780 C160 802 140 836 128 880",
  "M600 684 C694 704 784 736 838 780 C864 802 884 836 896 880",
] as const

function getAssetKey(pattern: PortraitHairPattern, length: PortraitLength): PortraitAssetKey {
  return `${pattern}-${LENGTH_FILE_SEGMENTS[length]}`
}

export function resolveHairPortraitAsset(config: PortraitConfig): HairPortraitAsset {
  if (config.kind === "generic") return GENERIC_PORTRAIT_ASSET

  return PORTRAIT_ASSET_MANIFEST[getAssetKey(config.treatedLengthPattern, config.length)]
}
