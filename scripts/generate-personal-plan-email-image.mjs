import { mkdir } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

import sharp from "sharp"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const source = path.join(
  root,
  "public/images/funnels/personal-plan-offer/before-after-generic.webp",
)
const output = path.join(root, "public/images/emails/personal-plan-before-after.jpg")
const panelWidth = 552
const panelHeight = 736
const gap = 20
const width = panelWidth * 2 + gap

const roundedMask = Buffer.from(
  `<svg width="${panelWidth}" height="${panelHeight}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" rx="30" fill="white"/></svg>`,
)

async function panel(left) {
  const image = await sharp(source)
    .extract({ left, top: 0, width: 600, height: 900 })
    .resize(panelWidth, panelHeight, { fit: "cover", position: "centre" })
    .png()
    .toBuffer()
  return sharp(image).composite([{ input: roundedMask, blend: "dest-in" }]).png().toBuffer()
}

const [before, after] = await Promise.all([panel(0), panel(600)])
const overlay = Buffer.from(`
  <svg width="${width}" height="${panelHeight}" xmlns="http://www.w3.org/2000/svg">
    <style>
      .label { font: 700 28px Arial, sans-serif; fill: #35164f; }
      .goal { fill: #255f40; }
      .arrow { font: 700 46px Arial, sans-serif; fill: white; }
    </style>
    <rect x="24" y="24" width="116" height="52" rx="26" fill="white" fill-opacity=".94"/>
    <text x="47" y="59" class="label">Heute</text>
    <rect x="${panelWidth + gap + 24}" y="24" width="150" height="52" rx="26" fill="white" fill-opacity=".94"/>
    <text x="${panelWidth + gap + 46}" y="59" class="label goal">Dein Ziel</text>
    <circle cx="${width / 2}" cy="${panelHeight / 2}" r="48" fill="white"/>
    <circle cx="${width / 2}" cy="${panelHeight / 2}" r="39" fill="#7f4ca5"/>
    <text x="${width / 2}" y="${panelHeight / 2 + 16}" text-anchor="middle" class="arrow">→</text>
  </svg>
`)

await mkdir(path.dirname(output), { recursive: true })
await sharp({
  create: {
    width,
    height: panelHeight,
    channels: 3,
    background: "#ffffff",
  },
})
  .composite([
    { input: before, left: 0, top: 0 },
    { input: after, left: panelWidth + gap, top: 0 },
    { input: overlay, left: 0, top: 0 },
  ])
  .jpeg({ quality: 88, mozjpeg: true })
  .toFile(output)

console.log(path.relative(root, output))
