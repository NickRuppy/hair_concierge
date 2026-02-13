/**
 * Maps internal source_name paths from the DB to user-friendly German display names.
 */

const BOOK_CHAPTERS: Record<string, string> = {
  "kapitel-01-wie-konnte-es-dazu-kommen": "Kap. 1: Wie konnte es dazu kommen?",
  "kapitel-02-wer-schoen-sein-will-muss-leiden": "Kap. 2: Wer schoen sein will, muss leiden",
  "kapitel-03-das-traegt-man-jetzt-so": "Kap. 3: Das traegt man jetzt so",
  "kapitel-04-schneiden-sie-auch-frauenhaare": "Kap. 4: Schneiden Sie auch Frauenhaare?",
  "kapitel-05-die-industrielle-haarrevolution": "Kap. 5: Die industrielle Haarrevolution",
  "kapitel-06-totes-zellmaterial": "Kap. 6: Totes Zellmaterial",
  "kapitel-07-das-haut-so-nicht-hin": "Kap. 7: Das haut so nicht hin",
  "kapitel-08-waechst-doch-wieder": "Kap. 8: Waechst doch wieder",
  "kapitel-09-wer-bin-ich-mufasa": "Kap. 9: Wer bin ich, Mufasa?",
  "kapitel-10-panthenol-pro-vitamin-b5": "Kap. 10: Panthenol & Pro-Vitamin B5",
  "kapitel-11-bis-zum-muskelversagen": "Kap. 11: Bis zum Muskelversagen",
  "kapitel-12-das-klingt-verlockend": "Kap. 12: Das klingt verlockend",
  "kapitel-13-ueber-diese-bruecken-musst-du-gehen": "Kap. 13: Ueber diese Bruecken musst du gehen",
  "kapitel-14-das-steht-wie-ne-1": "Kap. 14: Das steht wie 'ne 1",
  "kapitel-15-und-taeglich-gruesst-das-murmeltier": "Kap. 15: Und taeglich gruesst das Murmeltier",
  "kapitel-16-haben-wir-es-dann-jetzt": "Kap. 16: Haben wir es dann jetzt?",
  "ueber-den-autor": "Ueber den Autor",
}

const COURSE_NAMES: Record<string, string> = {
  basics: "Basics",
  "basics-2": "Basics 2",
  advanced: "Advanced",
  "styling-basics": "Styling Basics",
  "styling-advanced": "Styling Advanced",
}

const PRODUKTMATRIX_LABELS: Record<string, string> = {
  conditioner: "Conditioner",
  "conditioner-profi": "Conditioner (Profi)",
  "leave-in": "Leave-in",
  maske: "Maske",
  "maske-profi": "Maske (Profi)",
  "öle": "Oele",
  shampoo: "Shampoo",
  "shampoo-profi": "Shampoo (Profi)",
}

function formatDate(dateStr: string): string {
  // "2025-06-10" -> "10.06.2025"
  const [y, m, d] = dateStr.split("-")
  return `${d}.${m}.${y}`
}

function titleCase(slug: string): string {
  return slug
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export function formatSourceName(sourceName: string): string {
  // Book chapters: "book/kapitel-01-wie-konnte-es-dazu-kommen.md"
  if (sourceName.startsWith("book/")) {
    const key = sourceName.replace("book/", "").replace(".md", "")
    return BOOK_CHAPTERS[key] ?? `Buch: ${titleCase(key)}`
  }

  // Live calls: "live-calls/2025-06-10-live-call.md"
  if (sourceName.startsWith("live-calls/")) {
    const match = sourceName.match(/(\d{4}-\d{2}-\d{2})/)
    if (match) return `Live-Beratung, ${formatDate(match[1])}`
    return "Live-Beratung"
  }

  // Live call links: "live-call-links/links-2025-06-10.md"
  if (sourceName.startsWith("live-call-links/")) {
    const match = sourceName.match(/(\d{4}-\d{2}-\d{2})/)
    if (match) return `Live-Call Links, ${formatDate(match[1])}`
    return "Live-Call Links"
  }

  // Product matrix: "produktmatrix/conditioner-profi"
  if (sourceName.startsWith("produktmatrix/")) {
    const key = sourceName.replace("produktmatrix/", "")
    return PRODUKTMATRIX_LABELS[key] ?? `Produktmatrix: ${titleCase(key)}`
  }

  // Course transcripts: "course-transcripts/basics/02-kopfhaut.md"
  if (sourceName.startsWith("course-transcripts/")) {
    const parts = sourceName.replace("course-transcripts/", "").replace(".md", "").split("/")
    const courseName = COURSE_NAMES[parts[0]] ?? titleCase(parts[0])
    if (parts[1]) {
      const topic = parts[1].replace(/^\d+-/, "")
      return `Kurs ${courseName}: ${titleCase(topic)}`
    }
    return `Kurs: ${courseName}`
  }

  // QA: "qa/haeufige-fragen.md"
  if (sourceName.startsWith("qa/")) return "Haeufige Fragen (FAQ)"

  // Stories: "stories/story-tom.md"
  if (sourceName.startsWith("stories/")) return "Toms Geschichte"

  // Fallback: title-case the last path segment
  const lastSegment = sourceName.split("/").pop()?.replace(".md", "") ?? sourceName
  return titleCase(lastSegment)
}
