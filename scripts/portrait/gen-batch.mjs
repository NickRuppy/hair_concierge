#!/usr/bin/env node
// Batch portrait generation via gpt-image-1 image edits.
// This is deliberately an explicit operator tool: it never assumes local secrets,
// temporary image caches, or a particular worktree path.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs"
import { join, dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const scriptDir = dirname(fileURLToPath(import.meta.url))
const defaultOut = join(scriptDir, "out")

const usage = () => {
  console.log(
    "Usage: OPENAI_API_KEY=... node scripts/portrait/gen-batch.mjs <variant|--all> --masters <directory> [--out <directory>] [--env-file <file>]",
  )
  console.log("Master directory must contain straight.png, wavy.png, curly.png, and coily.png.")
}

const args = process.argv.slice(2)
if (args.includes("--help") || args.includes("-h")) {
  usage()
  process.exit(0)
}

const variant = args[0]
const valueFor = (flag) => {
  const index = args.indexOf(flag)
  if (index === -1) return undefined
  if (!args[index + 1]) throw new Error(`${flag} requires a value.`)
  return args[index + 1]
}
const mastersArg = valueFor("--masters")
const outArg = valueFor("--out")
const envFile = valueFor("--env-file")
if (!variant || variant.startsWith("--") || !mastersArg) {
  usage()
  process.exit(1)
}

function keyFromEnvFile(path) {
  const match = readFileSync(path, "utf8").match(/^OPENAI_API_KEY=(.+)$/m)
  return match?.[1]?.trim()
}

// Prefer the explicit environment; an env file is opt-in for local operators.
const key = process.env.OPENAI_API_KEY || (envFile ? keyFromEnvFile(resolve(envFile)) : undefined)
if (!key) {
  console.error("Set OPENAI_API_KEY or pass --env-file <file>.")
  process.exit(1)
}

const out = resolve(outArg ?? defaultOut)
const mastersDir = resolve(mastersArg)
mkdirSync(out, { recursive: true })
const masters = Object.fromEntries(
  ["straight", "wavy", "curly", "coily"].map((texture) => [
    texture,
    join(mastersDir, `${texture}.png`),
  ]),
)
for (const [texture, path] of Object.entries(masters)) {
  if (!existsSync(path)) throw new Error(`Missing ${texture} master: ${path}`)
}

const STYLE = `Flat editorial vector illustration, back view of a woman's head and shoulders, seen exactly from behind. No face, no profile, no ears visible.
STYLE (follow exactly): minimalist premium beauty illustration, high-end salon brand aesthetic. Hair as ONE confident closed silhouette with clean flowing contour lines. Ink outline: very dark plum (#312a4a), even line weight. Hair fill: pale lilac (#efe9f7); one subtle lighter shine crescent on the upper crown following the dome curvature; optionally one soft deeper lilac shade (#e2d7f0) near the nape. 3-6 sparse interior flow lines following the hair's fall direction. Shoulders and neck: indicated ONLY by a single thin warm-beige outline stroke on each side — the body area itself stays completely EMPTY showing the plain background. Absolutely NO filled skin, NO skin color, NO flesh tones anywhere, NO clothing, NO torso shading. Background: plain solid uniform warm cream (#faf8f5), perfectly flat and even across the whole image, no vignette, no glow, no shadow, no texture. NO gradients, NO text, NO watermark, NO face, NO skin rendering.
COMPOSITION (identical across the series): head centered horizontally, crown at ~12% from the top edge, skull width exactly 1/3 of image width, framing ends just below the shoulder line.
Use the input image as the exact style reference — same line weight, colors, head size and position. Change ONLY the hair to: `

const VARIANTS = {
  "straight-very-short": [
    "straight",
    "a very short pixie cut, sleek hair hugging the skull and ending at the upper nape, NOT a bob, the entire neck and nape hairline exposed, visibly the shortest possible haircut",
  ],
  "straight-short": ["straight", "sleek straight hair ending at chin level, blunt soft hem"],
  "straight-medium": ["straight", "sleek straight hair ending at the shoulders, blunt soft hem"],
  "straight-long": [
    "straight",
    "sleek straight hair falling to mid-back, clearly LONGER than shoulder-length but clearly SHORTER than waist-length, the hem ending around the shoulder blades, visibly shorter than the longest version of this style",
  ],
  "straight-very-long": [
    "straight",
    "sleek straight hair falling far down the back, past the bottom framing",
  ],
  "wavy-very-short": [
    "wavy",
    "a very short cropped wavy pixie cut hugging the skull closely with LOW volume, ending at the upper nape, the entire neck exposed, NOT a bob, no volume below ear level, visibly the shortest possible wavy cut",
  ],
  "wavy-short": ["wavy", "soft waves ending at chin level"],
  "wavy-medium": ["wavy", "soft waves ending at the shoulders"],
  "wavy-long": [
    "wavy",
    "soft large S-waves falling past the shoulders to mid-back, waves growing toward the ends",
  ],
  "wavy-very-long": ["wavy", "soft large S-waves falling far down the back"],
  "curly-very-short": [
    "curly",
    "defined curls cropped close to the skull, springy short spirals, nape visible",
  ],
  "curly-short": ["curly", "defined curls ending at chin level, spiral hooks at the hem"],
  "curly-medium": [
    "curly",
    "defined curls ending at the shoulders, stacked curl ribbons, spiral hooks at the hem",
  ],
  "curly-long": [
    "curly",
    "defined curls falling past the shoulders, stacked curl ribbons, spiral hem, flat even pale lilac fill with no dark patches or blotchy shading",
  ],
  "curly-very-long": [
    "curly",
    "defined curls falling far down the back, the longest of the curly series",
  ],
  "coily-very-short": [
    "coily",
    "coily hair as a close-cropped cloud hugging the skull, cloud diameter about 40 percent of the image width, neck clearly visible, softly irregular organic edge bumps of varied size and spacing",
  ],
  "coily-short": [
    "coily",
    "small rounded coily cloud slightly lifted from the skull, cloud diameter about 50 percent of the image width, softly irregular organic edge bumps of varied size, short neck visible",
  ],
  "coily-medium": [
    "coily",
    "medium coily cloud, ball width about 58 percent of the image width, CLEARLY larger and fuller than a small short cloud, extending slightly below chin level, softly irregular edge bumps, 8-12 clearly visible short curved coil texture marks in darker lilac evenly distributed, short neck visible",
  ],
  "coily-long": [
    "coily",
    "large coily silhouette that elongates downward, slightly oval, volume draping below the ears toward the shoulders, ball width about 63 percent of the image width, softly irregular edge bumps, 8-12 coil texture marks in slightly darker lilac, short neck visible",
  ],
  "coily-very-long": [
    "coily",
    "the largest coily silhouette of the series, strongly elongated downward and draping toward the shoulders, oval not circular, ball width about 74 percent of the image width, the bottom of the hair reaching well below shoulder level, 8-12 clearly visible short curved coil texture marks in DARKER lilac distributed across the whole shape, a hint of neck visible",
  ],
  generic: [
    "wavy",
    "soft neutral shoulder-length hair with barely-suggested gentle texture, deliberately unspecific — neither clearly straight, wavy, curly nor coily",
  ],
}

if (!VARIANTS[variant] && variant !== "--all") {
  console.error(`Unknown variant: ${variant}`)
  process.exit(1)
}

async function generate(name, attempt = 1) {
  const [texture, description] = VARIANTS[name]
  const form = new FormData()
  form.append("model", "gpt-image-1")
  form.append("prompt", STYLE + description)
  form.append("size", "1024x1024")
  form.append("quality", "high")
  form.append("output_format", "png")
  form.append("n", "1")
  form.append(
    "image[]",
    new Blob([readFileSync(masters[texture])], { type: "image/png" }),
    `${texture}.png`,
  )

  const response = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  })
  if (!response.ok) {
    const text = (await response.text()).slice(0, 300)
    if ((response.status === 429 || response.status >= 500) && attempt < 3) {
      console.log(`  ${name}: HTTP ${response.status}, retry ${attempt + 1} in 20s`)
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 20_000))
      return generate(name, attempt + 1)
    }
    throw new Error(`${name}: HTTP ${response.status} ${text}`)
  }
  const bytes = Buffer.from((await response.json()).data?.[0]?.b64_json ?? "", "base64")
  if (!bytes.length) throw new Error(`${name}: no image in response`)
  writeFileSync(join(out, `${name}.png`), bytes)
  console.log(`  ${name}: saved (${Math.round(bytes.length / 1024)}KB)`)
}

const names = variant === "--all" ? Object.keys(VARIANTS) : [variant]
for (const name of names) {
  if (variant === "--all" && existsSync(join(out, `${name}.png`))) {
    console.log(`  ${name}: exists, skip`)
    continue
  }
  console.log(`generating ${name} ...`)
  try {
    await generate(name)
  } catch (error) {
    console.error(`  FAILED ${String(error.message).slice(0, 200)}`)
  }
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 3_000))
}
console.log("done")
