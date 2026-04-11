import type { QuizQuestion } from "./types"

export const quizQuestions: QuizQuestion[] = [
  {
    step: 2,
    questionNumber: 1,
    title: "Was ist deine natuerliche Haartextur?",
    instruction:
      "Mach eine Straehne tropfnass, druecke sie oben zusammen und lass los \u2013 was passiert?",
    options: [
      {
        value: "straight",
        label: "Glatt",
        description: "Die Straehne haengt glatt runter",
        icon: "hair-straight",
      },
      {
        value: "wavy",
        label: "Wellig",
        description: "Bildet eine S-Kurve, keine 3D-Windung",
        icon: "hair-wavy",
      },
      {
        value: "curly",
        label: "Lockig",
        description: "Formt sich zu einer deutlichen 3D-Locke",
        icon: "hair-curly",
      },
      {
        value: "coily",
        label: "Kraus",
        description: "Enge Windungen, die sich in sich selbst drehen",
        icon: "hair-coily",
      },
    ],
    selectionMode: "single",
    motivation: "Super, du bist gerade erst gestartet. Noch 5 kurze Fragen.",
  },
  {
    step: 3,
    questionNumber: 2,
    title: "Wie dick sind deine einzelnen Haare?",
    instruction:
      "Nimm ein einzelnes Haar und halte es zwischen Daumen und Zeigefinger. Vergleiche es mit einem Naehfaden \u2013 das ist der beste Referenzpunkt.\n\nGemeint ist ein einzelnes Haar, nicht wie viele Haare du insgesamt hast.",
    options: [
      {
        value: "fine",
        label: "Fein",
        description: "Kaum spuerbar \u2013 duenner als ein Naehfaden",
        icon: "hair-fine",
      },
      {
        value: "normal",
        label: "Mittel",
        description: "Spuerbar \u2013 aehnlich wie ein Naehfaden",
        icon: "hair-normal",
      },
      {
        value: "coarse",
        label: "Dick",
        description: "Deutlich spuerbar \u2013 dicker als ein Naehfaden",
        icon: "hair-coarse",
      },
    ],
    selectionMode: "single",
    motivation: "Klasse \u2013 du hilfst uns, deine Haare richtig einzuschaetzen.",
  },
  {
    step: 4,
    questionNumber: 3,
    title: "Wie fuehlt sich dein Haar an?",
    instruction:
      "Nimm ein gewaschenes, trockenes Haar aus deiner Buerste \u2013 es darf kein Produkt mehr drauf sein. Schliesse die Augen und fahre ganz langsam mit zwei Fingern von der Wurzel zur Spitze. Konzentrier dich darauf, was du fuehlst:",
    options: [
      {
        value: "glatt",
        label: "Glatt wie Glas",
        description: "Die Finger gleiten gleichmaessig durch",
        icon: "surface-smooth",
      },
      {
        value: "leicht_uneben",
        label: "Leicht uneben",
        description: "Kleine Huegel spuerbar, nicht durchgehend",
        icon: "surface-uneven",
      },
      {
        value: "rau",
        label: "Richtig rau und huckelig",
        description: "Durchgehend rau und uneben",
        icon: "surface-rough",
      },
    ],
    selectionMode: "single",
    motivation: "Top, schon ein gutes Stueck geschafft.",
  },
  {
    step: 5,
    questionNumber: 4,
    title: "Wie elastisch ist dein Haar?",
    instruction:
      "Nimm dasselbe Haar. Klemm es zwischen Ringfinger und Zeigefinger auf der einen Seite und zwischen Ringfinger und Mittelfinger auf der anderen. Zieh jetzt vorsichtig \u2013 wirklich mit Gefuehl, nicht reissen. Beobachte genau, was passiert:\n\nZiehe nur leicht. Uns geht es um die Tendenz, nicht um Perfektion.",
    options: [
      {
        value: "stretches_bounces",
        label: "Dehnt sich und geht zurueck",
        description: "Federt in den Ursprungszustand zurueck",
        icon: "elastic-bounces",
      },
      {
        value: "stretches_stays",
        label: "Dehnt sich, bleibt ausgeleiert",
        description: "Kommt nicht mehr zurueck \u2013 bleibt laenglich",
        icon: "elastic-stays",
      },
      {
        value: "snaps",
        label: "Reisst sofort",
        description: "Bricht bei leichtem Zug direkt ab",
        icon: "elastic-snaps",
      },
    ],
    selectionMode: "single",
    motivation: "Gut gemacht \u2013 noch 2 Fragen.",
  },
  {
    step: 7,
    questionNumber: 5,
    title: "Sind deine Haare chemisch behandelt?",
    instruction:
      "Chemische Prozesse wie Blondieren oder Faerben veraendern die innere Struktur deiner Haare grundlegend. Blondieren bricht Brueckenverbindungen auf und entzieht Protein \u2013 das muss in der Pflege ausgeglichen werden.",
    options: [
      {
        value: "natur",
        label: "Naturhaar",
        description: "Keine Farbe, kein Blondieren \u2013 unbehandelt",
        icon: "treatment-natural",
      },
      {
        value: "gefaerbt",
        label: "Gefaerbt / Getoent",
        description: "Farbveraenderung, aber kein Aufhellen",
        icon: "treatment-colored",
      },
      {
        value: "blondiert",
        label: "Blondiert / Aufgehellt",
        description: "Gebleacht, Straehnchen oder Balayage",
        icon: "treatment-lightened",
      },
    ],
    selectionMode: "multi",
    motivation: "Fast geschafft \u2013 noch eine letzte Frage.",
  },
]

export function getQuestionByStep(step: number): QuizQuestion | undefined {
  return quizQuestions.find((q) => q.step === step)
}
