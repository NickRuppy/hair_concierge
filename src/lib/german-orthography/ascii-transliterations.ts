export interface AsciiGermanOrthographyMatch {
  id: string
  match: string
  index: number
}

export interface AsciiGermanOrthographyPattern {
  id: string
  source: string
}

const GERMAN_WORD_START = String.raw`(?<![\p{L}\p{N}_])`
const GERMAN_WORD_END = String.raw`(?![\p{L}\p{N}_])`

function germanWordSource(source: string): string {
  return `${GERMAN_WORD_START}(?:${source})${GERMAN_WORD_END}`
}

// This detector is a curated heuristic for common user-facing German transliteration leaks,
// not a complete German spelling engine. Add new stems explicitly when source copy introduces them.
// Pattern convention:
// - Use exact forms for closed function words or auxiliaries where a broad stem would overmatch.
// - Use stem forms for ordinary inflectable adjectives, verbs, and nouns.
// - Use curated compounds only when the compound is a real product/domain spelling we expect to police.
export const ASCII_GERMAN_ORTHOGRAPHY_PATTERNS: ReadonlyArray<AsciiGermanOrthographyPattern> = [
  { id: "aendern", source: germanWordSource(String.raw`aender(?:n|e|st|t)?`) },
  { id: "abklaerung", source: germanWordSource(String.raw`abklaer(?:ung|en|t|te|ter|tes)?`) },
  { id: "aerztlich", source: germanWordSource(String.raw`aerztlich[\p{L}]*`) },
  { id: "aetherisch", source: germanWordSource(String.raw`aetherisch[\p{L}]*`) },
  { id: "ansaetze", source: germanWordSource(String.raw`ansaetz[\p{L}]*`) },
  { id: "anschliessend", source: germanWordSource(String.raw`anschliess[\p{L}]*`) },
  { id: "anfuehlen", source: germanWordSource(String.raw`anfuehl[\p{L}]*`) },
  { id: "abgekuerzt", source: germanWordSource(String.raw`abgekuerzt[\p{L}]*`) },
  { id: "ausspuelen", source: germanWordSource(String.raw`ausspuel[\p{L}]*`) },
  { id: "ausdruecklich", source: germanWordSource(String.raw`ausdruecklich[\p{L}]*`) },
  { id: "buersten", source: germanWordSource(String.raw`buerst[\p{L}]*`) },
  { id: "entzuendung", source: germanWordSource(String.raw`entzuend[\p{L}]*`) },
  { id: "ergaenzen", source: germanWordSource(String.raw`ergaenz[\p{L}]*`) },
  { id: "erklaeren", source: germanWordSource(String.raw`erklaer[\p{L}]*`) },
  { id: "foehnen", source: germanWordSource(String.raw`foehn[\p{L}]*`) },
  { id: "fuer", source: germanWordSource(String.raw`(?:da|hier)?fuer`) },
  { id: "fuegen", source: germanWordSource(String.raw`fueg[\p{L}]*`) },
  { id: "fuelle", source: germanWordSource(String.raw`fuell[\p{L}]*`) },
  { id: "gefuehl", source: germanWordSource(String.raw`(?:haar)?gefuehl[\p{L}]*`) },
  { id: "klaeren", source: germanWordSource(String.raw`klaer[\p{L}]*`) },
  { id: "glaett", source: germanWordSource(String.raw`glaett[\p{L}]*`) },
  { id: "groesser", source: germanWordSource(String.raw`groesser[\p{L}]*`) },
  { id: "gruendlich", source: germanWordSource(String.raw`gruendlich[\p{L}]*`) },
  { id: "haeufig", source: germanWordSource(String.raw`haeufig[\p{L}]*`) },
  { id: "hinzufuegen", source: germanWordSource(String.raw`hinzufueg[\p{L}]*`) },
  { id: "hoeher", source: germanWordSource(String.raw`hoeher[\p{L}]*`) },
  { id: "gleichmaessig", source: germanWordSource(String.raw`gleichmaessig[\p{L}]*`) },
  { id: "intensitaet", source: germanWordSource(String.raw`[\p{L}]*intensitaet[\p{L}]*`) },
  { id: "koennen", source: germanWordSource(String.raw`koenn(?:en|te|ten|test|tet)`) },
  { id: "laengen", source: germanWordSource(String.raw`laengen(?:schutz)?`) },
  { id: "loesung", source: germanWordSource(String.raw`loes(?:ung|en|t|te|bar|lich)[\p{L}]*`) },
  { id: "moechte", source: germanWordSource(String.raw`moechte(?:st|n|t)?`) },
  { id: "moeglich", source: germanWordSource(String.raw`moeglich[\p{L}]*`) },
  { id: "natuerlich", source: germanWordSource(String.raw`natuerlich[\p{L}]*`) },
  { id: "naechst", source: germanWordSource(String.raw`naechst[\p{L}]*`) },
  { id: "noetig", source: germanWordSource(String.raw`noetig[\p{L}]*`) },
  { id: "nuetzlich", source: germanWordSource(String.raw`nuetzlich[\p{L}]*`) },
  { id: "oberflaeche", source: germanWordSource(String.raw`oberflaeche[\p{L}]*`) },
  {
    id: "oel",
    source: germanWordSource(
      String.raw`(?:oel(?:e|frei)?|(?:haar|styling|finish|trocken|pre-wash|kokos|glanz)-?oel(?:e)?|oel-[\p{L}\p{N}_-]+)`,
    ),
  },
  { id: "primaer", source: germanWordSource(String.raw`primaer[\p{L}]*`) },
  { id: "pruefen", source: germanWordSource(String.raw`pruef[\p{L}]*`) },
  { id: "rueck", source: germanWordSource(String.raw`(?:rueck[\p{L}]*|zurueck[\p{L}]*)`) },
  { id: "regelmaessig", source: germanWordSource(String.raw`regelmaessig[\p{L}]*`) },
  { id: "reissen", source: germanWordSource(String.raw`reiss[\p{L}]*`) },
  { id: "schaeden", source: germanWordSource(String.raw`schaed[\p{L}]*`) },
  { id: "schueppchen", source: germanWordSource(String.raw`schueppchen`) },
  { id: "schuetzen", source: germanWordSource(String.raw`schuetz[\p{L}]*`) },
  { id: "sensitivitaet", source: germanWordSource(String.raw`[\p{L}]*sensitivitaet[\p{L}]*`) },
  { id: "spuelung", source: germanWordSource(String.raw`spuel[\p{L}]*`) },
  { id: "staerk", source: germanWordSource(String.raw`staerk[\p{L}]*`) },
  { id: "stueck", source: germanWordSource(String.raw`stueck[\p{L}]*`) },
  { id: "taeglich", source: germanWordSource(String.raw`taeglich[\p{L}]*`) },
  { id: "ueber", source: germanWordSource(String.raw`(?:ueber|[\p{L}]+ueber)[\p{L}]*`) },
  { id: "unnoetig", source: germanWordSource(String.raw`unnoetig[\p{L}]*`) },
  { id: "unterstuetzen", source: germanWordSource(String.raw`unterstuetz[\p{L}]*`) },
  { id: "waere", source: germanWordSource(String.raw`waer(?:e|en|est|et)`) },
  { id: "waesche", source: germanWordSource(String.raw`(?:vor)?waesche`) },
  { id: "waeschst", source: germanWordSource(String.raw`waesch[\p{L}]*`) },
  { id: "verduennen", source: germanWordSource(String.raw`verduenn[\p{L}]*`) },
  { id: "verstaerken", source: germanWordSource(String.raw`verstaerk[\p{L}]*`) },
  { id: "vertraeglichkeit", source: germanWordSource(String.raw`vertraeg[\p{L}]*`) },
  { id: "waehlen", source: germanWordSource(String.raw`waehl[\p{L}]*`) },
  { id: "ausduennung", source: germanWordSource(String.raw`ausduenn[\p{L}]*`) },
  { id: "ungewoehnlich", source: germanWordSource(String.raw`ungewoehn[\p{L}]*`) },
  { id: "zusaetzlich", source: germanWordSource(String.raw`zusaetz[\p{L}]*`) },
  { id: "gespraech", source: germanWordSource(String.raw`gespraech[\p{L}]*`) },
  { id: "fuehren", source: germanWordSource(String.raw`fuehr[\p{L}]*`) },
  { id: "wuerde", source: germanWordSource(String.raw`wuerd(?:e|en|est|et)`) },
  { id: "heisst", source: germanWordSource(String.raw`heiss(?:t|en|e)?`) },
  { id: "gross", source: germanWordSource(String.raw`gross[\p{L}]*`) },
  { id: "ausser", source: germanWordSource(String.raw`ausser[\p{L}]*`) },
  { id: "weiss", source: germanWordSource(String.raw`weiss(?:t|e|en)?`) },
]

const COMPILED_ASCII_GERMAN_ORTHOGRAPHY_PATTERNS = ASCII_GERMAN_ORTHOGRAPHY_PATTERNS.map(
  ({ id, source }) => ({
    id,
    pattern: new RegExp(source, "giu"),
  }),
)

export function findAsciiGermanOrthography(text: string): AsciiGermanOrthographyMatch[] {
  const matches: AsciiGermanOrthographyMatch[] = []

  for (const { id, pattern } of COMPILED_ASCII_GERMAN_ORTHOGRAPHY_PATTERNS) {
    pattern.lastIndex = 0

    let match: RegExpExecArray | null
    while ((match = pattern.exec(text)) !== null) {
      matches.push({
        id,
        match: match[0],
        index: match.index,
      })
    }
  }

  return matches.sort((left, right) => left.index - right.index || left.id.localeCompare(right.id))
}

export function hasAsciiGermanOrthography(text: string): boolean {
  for (const { pattern } of COMPILED_ASCII_GERMAN_ORTHOGRAPHY_PATTERNS) {
    pattern.lastIndex = 0

    if (pattern.test(text)) {
      pattern.lastIndex = 0
      return true
    }
  }

  return false
}
