import type { QuizQuestion } from "./types"

export const quizQuestions: QuizQuestion[] = [
  {
    step: 2,
    questionNumber: 1,
    title: "WAS IST DEINE NATUERLICHE HAARTEXTUR?",
    instruction:
      "Mach eine Straehne tropfnass, druecke sie oben zusammen und lass los \u2013 was passiert?",
    options: [
      { value: "straight", label: "Glatt", description: "Die Straehne haengt glatt runter", emoji: "\u3030\uFE0F" },
      { value: "wavy", label: "Wellig", description: "Bildet eine S-Kurve, keine 3D-Windung", emoji: "\uD83C\uDF0A" },
      { value: "curly", label: "Lockig", description: "Formt sich zu einer deutlichen 3D-Locke", emoji: "\uD83D\uDD04" },
      { value: "coily", label: "Kraus", description: "Enge Windungen, die sich in sich selbst drehen", emoji: "\uD83C\uDF00" },
    ],
    selectionMode: "single",
    motivation: "Super, du bist gerade erst gestartet. Noch 5 kurze Fragen.",
  },
  {
    step: 3,
    questionNumber: 2,
    title: "WIE DICK SIND DEINE EINZELNEN HAARE?",
    instruction:
      "Nimm ein einzelnes Haar und halte es zwischen Daumen und Zeigefinger. Vergleiche es mit einem Naehfaden \u2013 das ist der beste Referenzpunkt.\n\nGemeint ist ein einzelnes Haar, nicht wie viele Haare du insgesamt hast.",
    options: [
      { value: "fine", label: "Fein", description: "Kaum spuerbar \u2013 duenner als ein Naehfaden", emoji: "\uD83E\uDEB6" },
      { value: "normal", label: "Mittel", description: "Spuerbar \u2013 aehnlich wie ein Naehfaden", emoji: "\u270B" },
      { value: "coarse", label: "Dick", description: "Deutlich spuerbar \u2013 dicker als ein Naehfaden", emoji: "\uD83D\uDCAA" },
    ],
    selectionMode: "single",
    motivation: "Klasse \u2013 du hilfst uns, deine Haare richtig einzuschaetzen.",
  },
  {
    step: 4,
    questionNumber: 3,
    title: "WIE FUEHLT SICH DEIN HAAR AN?",
    instruction:
      "Nimm ein gewaschenes, trockenes Haar aus deiner Buerste \u2013 es darf kein Produkt mehr drauf sein. Schliesse die Augen und fahre ganz langsam mit zwei Fingern von der Wurzel zur Spitze. Konzentrier dich darauf, was du fuehlst:",
    options: [
      { value: "glatt", label: "Glatt wie Glas", description: "Die Finger gleiten gleichmaessig durch", emoji: "\u2728" },
      { value: "leicht_uneben", label: "Leicht uneben", description: "Kleine Huegel spuerbar, nicht durchgehend", emoji: "\u303D\uFE0F" },
      { value: "rau", label: "Richtig rau und huckelig", description: "Durchgehend rau und uneben", emoji: "\uD83C\uDFD4\uFE0F" },
    ],
    selectionMode: "single",
    motivation: "Top, schon ein gutes Stueck geschafft.",
  },
  {
    step: 5,
    questionNumber: 4,
    title: "WIE ELASTISCH IST DEIN HAAR?",
    instruction:
      "Nimm dasselbe Haar. Klemm es zwischen Ringfinger und Zeigefinger auf der einen Seite und zwischen Ringfinger und Mittelfinger auf der anderen. Zieh jetzt vorsichtig \u2013 wirklich mit Gefuehl, nicht reissen. Beobachte genau, was passiert:\n\nZiehe nur leicht. Uns geht es um die Tendenz, nicht um Perfektion.",
    options: [
      { value: "stretches_bounces", label: "Dehnt sich und geht zurueck", description: "Federt in den Ursprungszustand zurueck", emoji: "\uD83C\uDFAF" },
      { value: "stretches_stays", label: "Dehnt sich, bleibt ausgeleiert", description: "Kommt nicht mehr zurueck \u2013 bleibt laenglich", emoji: "\uD83D\uDCCF" },
      { value: "snaps", label: "Reisst sofort", description: "Bricht bei leichtem Zug direkt ab", emoji: "\u26A1" },
    ],
    selectionMode: "single",
    motivation: "Gut gemacht \u2013 noch 2 Fragen.",
  },
  {
    step: 7,
    questionNumber: 5,
    title: "SIND DEINE HAARE CHEMISCH BEHANDELT?",
    instruction:
      "Chemische Prozesse wie Blondieren oder Faerben veraendern die innere Struktur deiner Haare grundlegend. Blondieren bricht Brueckenverbindungen auf und entzieht Protein \u2013 das muss in der Pflege ausgeglichen werden.",
    options: [
      { value: "natur", label: "Naturhaar", description: "Keine Farbe, kein Blondieren \u2013 unbehandelt", emoji: "\uD83C\uDF3F" },
      { value: "gefaerbt", label: "Gefaerbt / Getoent", description: "Farbveraenderung, aber kein Aufhellen", emoji: "\uD83C\uDFA8" },
      { value: "blondiert", label: "Blondiert / Aufgehellt", description: "Gebleacht, Straehnchen oder Balayage", emoji: "\u2600\uFE0F" },
    ],
    selectionMode: "multi",
    motivation: "Fast geschafft \u2013 noch eine letzte Frage.",
  },
]

export function getQuestionByStep(step: number): QuizQuestion | undefined {
  return quizQuestions.find((q) => q.step === step)
}
