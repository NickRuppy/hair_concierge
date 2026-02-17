import type { QuizQuestion } from "./types"

export const quizQuestions: QuizQuestion[] = [
  {
    step: 2,
    questionNumber: 1,
    title: "WAS IST DEINE NATUERLICHE HAARTEXTUR?",
    instruction:
      "Mach eine Straehne richtig nass \u2013 sie muss tropfnass sein. Halte sie am Ansatz fest, druecke sie oben zusammen und lass los. Schau, was passiert:",
    options: [
      { value: "glatt", label: "Glatt", description: "Es passiert nichts \u2013 die Straehne haengt einfach glatt runter", emoji: "\u3030\uFE0F" },
      { value: "wellig", label: "Wellig", description: "Es bildet sich eine S-Kurve, aber keine richtige 3D-Windung", emoji: "\uD83C\uDF0A" },
      { value: "lockig", label: "Lockig", description: "Die Straehne formt sich zu einer deutlichen 3D-Locke", emoji: "\uD83D\uDD04" },
      { value: "kraus", label: "Kraus", description: "Enge Windungen, die sich zusaetzlich in sich selbst drehen", emoji: "\uD83C\uDF00" },
    ],
    selectionMode: "single",
    motivation: "Super, du bist gerade erst gestartet. Noch 6 kurze Fragen.",
  },
  {
    step: 3,
    questionNumber: 2,
    title: "WIE DICK SIND DEINE EINZELNEN HAARE?",
    instruction:
      "Nimm ein einzelnes Haar und halte es zwischen Daumen und Zeigefinger. Vergleiche es mit einem Naehfaden \u2013 das ist der beste Referenzpunkt.",
    options: [
      { value: "fein", label: "Fein", description: "Kaum spuerbar \u2013 viel duenner als ein Naehfaden", emoji: "\uD83E\uDEB6" },
      { value: "mittel", label: "Mittel", description: "Spuerbar, aber nicht grob \u2013 aehnlich wie ein Naehfaden", emoji: "\u270B" },
      { value: "dick", label: "Dick", description: "Fuehlt sich an wie Naehgarn \u2013 deutlich spuerbar und fest", emoji: "\uD83D\uDCAA" },
    ],
    selectionMode: "single",
    motivation: "Top, schon ein gutes Stueck geschafft.",
  },
  {
    step: 4,
    questionNumber: 3,
    title: "DER OBERFLAECHENTEST",
    instruction:
      "Nimm ein gewaschenes, trockenes Haar aus deiner Buerste \u2013 es darf kein Produkt mehr drauf sein. Schliesse die Augen und fahre ganz langsam mit zwei Fingern von der Wurzel zur Spitze. Konzentrier dich darauf, was du fuehlst:",
    options: [
      { value: "glatt", label: "Glatt wie Glas", description: "Keine Unebenheiten \u2013 die Finger gleiten gleichmaessig durch", emoji: "\u2728" },
      { value: "leicht_uneben", label: "Leicht uneben", description: "Kleine Huegel spuerbar, aber nicht durchgehend rau", emoji: "\u303D\uFE0F" },
      { value: "rau", label: "Richtig rau und huckelig", description: "Deutliche Hoehen und Tiefen \u2013 die Oberflaeche fuehlt sich kaputt an", emoji: "\uD83C\uDFD4\uFE0F" },
    ],
    selectionMode: "single",
    motivation: "Klasse \u2013 du hilfst TomBot, deine Haare richtig einzuschaetzen.",
  },
  {
    step: 5,
    questionNumber: 4,
    title: "DER ZUGTEST",
    instruction:
      "Nimm dasselbe Haar. Klemm es zwischen Ringfinger und Zeigefinger auf der einen Seite und zwischen Ringfinger und Mittelfinger auf der anderen. Zieh jetzt vorsichtig \u2013 wirklich mit Gefuehl, nicht reissen. Beobachte genau, was passiert:",
    options: [
      { value: "elastisch", label: "Dehnt sich und geht zurueck", description: "Es gibt nach, federt aber in den Ursprungszustand zurueck \u2013 dein Haar ist gut balanciert", emoji: "\uD83C\uDFAF" },
      { value: "ueberdehnt", label: "Dehnt sich, bleibt ausgeleiert", description: "Es gibt nach, kommt aber nicht mehr zurueck \u2013 wie ein ausgeleiertes Gummiband. Zeichen fuer Proteinmangel", emoji: "\uD83D\uDCCF" },
      { value: "bricht", label: "Reisst sofort", description: "Es bricht bei leichtem Zug direkt ab \u2013 kaum Dehnung moeglich. Zeichen fuer Feuchtigkeitsmangel", emoji: "\u26A1" },
    ],
    selectionMode: "single",
    motivation: "Jetzt sind wir mitten in der Profi-Analyse.",
  },
  {
    step: 7,
    questionNumber: 6,
    title: "SIND DEINE HAARE CHEMISCH BEHANDELT?",
    instruction:
      "Chemische Prozesse wie Blondieren oder Faerben veraendern die innere Struktur deiner Haare grundlegend. Blondieren bricht Brueckenverbindungen auf und entzieht Protein \u2013 das muss in der Pflege ausgeglichen werden.",
    options: [
      { value: "natur", label: "Naturhaar", description: "Keine Farbe, kein Blondieren \u2013 unbehandelt", emoji: "\uD83C\uDF3F" },
      { value: "gefaerbt", label: "Gefaerbt / Getoent", description: "Farbveraenderung, aber kein Aufhellen", emoji: "\uD83C\uDFA8" },
      { value: "blondiert", label: "Blondiert / Aufgehellt", description: "Gebleacht, Straehnchen oder Balayage", emoji: "\u2600\uFE0F" },
    ],
    selectionMode: "multi",
    motivation: "Noch eine Frage \u2013 gleich siehst du dein Profil.",
  },
  {
    step: 8,
    questionNumber: 7,
    title: "WAS NERVT DICH AM MEISTEN?",
    instruction: "Waehle bis zu 3 Punkte \u2013 TomBot richtet deinen Plan danach aus, was dich wirklich stoert.",
    options: [
      { value: "spliss", label: "Spliss / Haarbruch", emoji: "\uD83D\uDC94" },
      { value: "frizz", label: "Frizz / fliegende Haare", emoji: "\uD83C\uDF2B\uFE0F" },
      { value: "kein_volumen", label: "Kein Volumen", emoji: "\uD83D\uDCC9" },
      { value: "zu_viel_volumen", label: "Zu viel Volumen", emoji: "\uD83D\uDCC8" },
      { value: "glanzlos", label: "Glanzlos", emoji: "\uD83C\uDF11" },
      { value: "kopfhaut", label: "Kopfhautprobleme", emoji: "\uD83E\uDDF4" },
      { value: "haarausfall", label: "Haarausfall / Ausduennen", emoji: "\uD83D\uDC87\u200D\u2640\uFE0F" },
    ],
    selectionMode: "multi",
    maxSelections: 3,
    motivation: "Letzte Frage \u2013 gleich siehst du dein persoenliches Haarprofil.",
  },
]

export function getQuestionByStep(step: number): QuizQuestion | undefined {
  return quizQuestions.find((q) => q.step === step)
}
