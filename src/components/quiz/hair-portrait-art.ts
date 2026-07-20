import type {
  PortraitDensity,
  PortraitHairPattern,
  PortraitLength,
  PortraitMarkerPreset,
  PortraitTreatmentState,
} from "@/lib/quiz/portrait-config"

export const PORTRAIT_VIEW_BOX = "0 0 360 440"
export const PORTRAIT_VIEW_BOX_WIDTH = 360
export const PORTRAIT_VIEW_BOX_HEIGHT = 440

export const PORTRAIT_STATIC_PATHS = {
  shoulders: "M88 426 C103 383 137 365 154 354 L154 307 M206 307 L206 354 C223 365 257 383 272 426",
  nape: "M151 209 C155 239 146 263 128 276 M209 209 C205 239 214 263 232 276",
  rearHead: "M134 152 C137 190 155 214 180 214 C205 214 223 190 226 152",
} as const

export interface PortraitPoint {
  x: number
  y: number
}

export interface PortraitMarkerAnchor {
  button: PortraitPoint
  lineEnd: PortraitPoint
}

export interface PortraitMarkerPresetData {
  scalp: PortraitMarkerAnchor
  lengths: PortraitMarkerAnchor
  ends: PortraitMarkerAnchor
}

interface LengthPreset {
  endY: number
  rootEndY: number
  lengthSpread: number
  markers: PortraitMarkerPresetData
}

export const PORTRAIT_LENGTH_PRESETS: Record<PortraitMarkerPreset, LengthPreset> = {
  very_short: {
    endY: 210,
    rootEndY: 150,
    lengthSpread: 8,
    markers: {
      scalp: { button: { x: 180, y: 66 }, lineEnd: { x: 180, y: 40 } },
      lengths: { button: { x: 266, y: 176 }, lineEnd: { x: 312, y: 176 } },
      ends: { button: { x: 111, y: 198 }, lineEnd: { x: 72, y: 205 } },
    },
  },
  short: {
    endY: 248,
    rootEndY: 150,
    lengthSpread: 12,
    markers: {
      scalp: { button: { x: 180, y: 66 }, lineEnd: { x: 180, y: 40 } },
      lengths: { button: { x: 274, y: 194 }, lineEnd: { x: 318, y: 194 } },
      ends: { button: { x: 104, y: 232 }, lineEnd: { x: 64, y: 239 } },
    },
  },
  medium: {
    endY: 304,
    rootEndY: 150,
    lengthSpread: 20,
    markers: {
      scalp: { button: { x: 180, y: 66 }, lineEnd: { x: 180, y: 40 } },
      lengths: { button: { x: 280, y: 220 }, lineEnd: { x: 320, y: 220 } },
      ends: { button: { x: 104, y: 282 }, lineEnd: { x: 62, y: 288 } },
    },
  },
  long: {
    endY: 360,
    rootEndY: 150,
    lengthSpread: 24,
    markers: {
      scalp: { button: { x: 180, y: 66 }, lineEnd: { x: 180, y: 40 } },
      lengths: { button: { x: 282, y: 248 }, lineEnd: { x: 322, y: 248 } },
      ends: { button: { x: 101, y: 336 }, lineEnd: { x: 60, y: 342 } },
    },
  },
  very_long: {
    endY: 410,
    rootEndY: 150,
    lengthSpread: 27,
    markers: {
      scalp: { button: { x: 180, y: 66 }, lineEnd: { x: 180, y: 40 } },
      lengths: { button: { x: 284, y: 270 }, lineEnd: { x: 324, y: 270 } },
      ends: { button: { x: 101, y: 386 }, lineEnd: { x: 60, y: 392 } },
    },
  },
  generic: {
    endY: 304,
    rootEndY: 150,
    lengthSpread: 18,
    markers: {
      scalp: { button: { x: 180, y: 66 }, lineEnd: { x: 180, y: 40 } },
      lengths: { button: { x: 280, y: 220 }, lineEnd: { x: 320, y: 220 } },
      ends: { button: { x: 104, y: 282 }, lineEnd: { x: 62, y: 288 } },
    },
  },
}

const DENSITY_SLOTS: Record<PortraitDensity, number[]> = {
  low: [-0.9, -0.45, 0, 0.45, 0.9],
  medium: [-0.95, -0.68, -0.4, -0.14, 0.14, 0.4, 0.68, 0.95],
  high: [-1, -0.82, -0.64, -0.45, -0.27, -0.09, 0.09, 0.27, 0.45, 0.64, 0.82, 1],
}

const PATTERN_SETTINGS: Record<PortraitHairPattern, { amplitude: number; frequency: number }> = {
  straight: { amplitude: 0.9, frequency: 0.04 },
  wavy: { amplitude: 7, frequency: 0.065 },
  curly: { amplitude: 12, frequency: 0.115 },
  coily: { amplitude: 10, frequency: 0.18 },
}

export function getDensitySlots(density: PortraitDensity): readonly number[] {
  return DENSITY_SLOTS[density]
}

export function getPortraitLengthPreset(markerPreset: PortraitMarkerPreset): LengthPreset {
  return PORTRAIT_LENGTH_PRESETS[markerPreset]
}

export function isTreatedLengthState(treatmentState: PortraitTreatmentState): boolean {
  return treatmentState === "perm" || treatmentState === "straightened"
}

function patternOffset(pattern: PortraitHairPattern, y: number, phase: number): number {
  const settings = PATTERN_SETTINGS[pattern]
  return Math.sin(y * settings.frequency + phase) * settings.amplitude
}

function pointsPath(points: readonly PortraitPoint[]): string {
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join(" ")
}

export function buildPortraitStrandPaths(params: {
  length: PortraitLength | "generic"
  naturalPattern: PortraitHairPattern
  treatedPattern: PortraitHairPattern
  slot: number
  index: number
}): { root: string; length: string } {
  const preset = getPortraitLengthPreset(params.length)
  const phase = params.index * 0.78
  const startY = 54 + Math.abs(params.slot) * 30
  const rootSteps = Math.max(4, Math.round((preset.rootEndY - startY) / 10))
  const rootPoints: PortraitPoint[] = []

  for (let step = 0; step <= rootSteps; step += 1) {
    const progress = step / rootSteps
    const y = startY + (preset.rootEndY - startY) * progress
    const spread = 48 + progress * 38
    rootPoints.push({
      x: 180 + params.slot * spread + patternOffset(params.naturalPattern, y, phase),
      y,
    })
  }

  const lengthSteps = Math.max(4, Math.round((preset.endY - preset.rootEndY) / 10))
  const lengthPoints: PortraitPoint[] = []

  for (let step = 0; step <= lengthSteps; step += 1) {
    const progress = step / lengthSteps
    const y = preset.rootEndY + (preset.endY - preset.rootEndY) * progress
    const spread = 86 + progress * preset.lengthSpread
    lengthPoints.push({
      x: 180 + params.slot * spread + patternOffset(params.treatedPattern, y, phase + 0.45),
      y,
    })
  }

  return {
    root: pointsPath(rootPoints),
    length: pointsPath(lengthPoints),
  }
}
