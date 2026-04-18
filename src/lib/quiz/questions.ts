import type { QuizQuestion } from "./types"

export const QUIZ_TOTAL_QUESTIONS = 7

export const quizQuestions: QuizQuestion[] = [
  {
    step: 2,
    questionNumber: 1,
    title: "Was ist deine natürliche Haartextur?",
    instruction:
      "Mach eine Strähne tropfnass, drücke sie oben zusammen und lass los \u2013 was passiert?",
    options: [
      {
        value: "straight",
        label: "Glatt",
        description: "Die Strähne hängt glatt runter",
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
    motivation: "Super — noch 6 kurze Fragen.",
  },
  {
    step: 3,
    questionNumber: 2,
    title: "Wie dick sind deine einzelnen Haare?",
    instruction:
      "Nimm ein einzelnes Haar und halte es zwischen Daumen und Zeigefinger. Vergleiche es mit einem Nähfaden \u2013 das ist der beste Referenzpunkt.\n\nGemeint ist ein einzelnes Haar, nicht wie viele Haare du insgesamt hast.",
    options: [
      {
        value: "fine",
        label: "Fein",
        description: "Kaum spürbar \u2013 dünner als ein Nähfaden",
        icon: "hair-fine",
      },
      {
        value: "normal",
        label: "Mittel",
        description: "Spürbar \u2013 ähnlich wie ein Nähfaden",
        icon: "hair-normal",
      },
      {
        value: "coarse",
        label: "Dick",
        description: "Deutlich spürbar \u2013 dicker als ein Nähfaden",
        icon: "hair-coarse",
      },
    ],
    selectionMode: "single",
    motivation: "Klasse — schon ein besseres Bild.",
  },
  {
    step: 4,
    questionNumber: 3,
    title: "Wie fühlt sich dein Haar an?",
    instruction:
      "Nimm ein gewaschenes, trockenes Haar aus deiner Bürste \u2013 es darf kein Produkt mehr drauf sein. Schließ die Augen und fahre ganz langsam mit zwei Fingern von der Wurzel zur Spitze. Konzentrier dich darauf, was du fühlst:",
    options: [
      {
        value: "glatt",
        label: "Glatt wie Glas",
        description: "Die Finger gleiten gleichmäßig durch",
        icon: "surface-smooth",
      },
      {
        value: "leicht_uneben",
        label: "Leicht uneben",
        description: "Kleine Hügel spürbar, nicht durchgehend",
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
    motivation: "Top — über die Hälfte geschafft.",
  },
  {
    step: 5,
    questionNumber: 4,
    title: "Wie elastisch ist dein Haar?",
    instruction:
      "Nimm dasselbe Haar. Klemm es zwischen Ringfinger und Zeigefinger auf der einen Seite und zwischen Ringfinger und Mittelfinger auf der anderen. Zieh jetzt vorsichtig \u2013 wirklich mit Gefühl, nicht reißen. Beobachte genau, was passiert:\n\nZiehe nur leicht. Uns geht es um die Tendenz, nicht um Perfektion.",
    options: [
      {
        value: "stretches_bounces",
        label: "Dehnt sich und geht zurück",
        description: "Federt in den Ursprungszustand zurück",
        icon: "elastic-bounces",
      },
      {
        value: "stretches_stays",
        label: "Dehnt sich, bleibt ausgeleiert",
        description: "Kommt nicht mehr zurück \u2013 bleibt länglich",
        icon: "elastic-stays",
      },
      {
        value: "snaps",
        label: "Reißt sofort",
        description: "Bricht bei leichtem Zug direkt ab",
        icon: "elastic-snaps",
      },
    ],
    selectionMode: "single",
    motivation: "Gut gemacht — noch 3 Fragen.",
  },
  {
    step: 7,
    questionNumber: 5,
    title: "Sind deine Haare chemisch behandelt?",
    instruction:
      "Chemische Prozesse wie Blondieren oder Färben verändern die innere Struktur deiner Haare grundlegend. Blondieren bricht Brückenverbindungen auf und entzieht Protein \u2013 das muss in der Pflege ausgeglichen werden.",
    options: [
      {
        value: "natur",
        label: "Naturhaar",
        description: "Keine Farbe, kein Blondieren \u2013 unbehandelt",
        icon: "treatment-natural",
      },
      {
        value: "gefaerbt",
        label: "Gefärbt / Getönt",
        description: "Farbveränderung, aber kein Aufhellen",
        icon: "treatment-colored",
      },
      {
        value: "blondiert",
        label: "Blondiert / Aufgehellt",
        description: "Gebleacht, Strähnchen oder Balayage",
        icon: "treatment-lightened",
      },
    ],
    selectionMode: "multi",
    motivation: "Fast geschafft!",
  },
  {
    step: 8,
    questionNumber: 7,
    title: "Welche Haarprobleme beschäftigen dich gerade am meisten?",
    instruction:
      "Wähle bis zu 3 Punkte aus, die aktuell am besten zu deinen Längen und Spitzen passen.",
    options: [
      {
        value: "hair_damage",
        label: "Haarschäden",
        description: "Die Längen wirken strapaziert und geschwächt",
        icon: "goal-repair",
      },
      {
        value: "split_ends",
        label: "Spliss",
        description: "Die Spitzen fasern auf oder fransen schnell aus",
        icon: "goal-split-ends",
      },
      {
        value: "breakage",
        label: "Haarbruch",
        description: "Haare brechen oder reißen schnell ab",
        icon: "goal-strength",
      },
      {
        value: "dryness",
        label: "Trockenheit",
        description: "Die Längen fühlen sich stumpf und trocken an",
        icon: "goal-moisture",
      },
      {
        value: "frizz",
        label: "Frizz",
        description: "Viele abstehende Härchen und wenig Geschmeidigkeit",
        icon: "goal-frizz",
      },
      {
        value: "tangling",
        label: "Verknotungen",
        description: "Dein Haar verheddert sich schnell und ist schwer zu entwirren",
        icon: "goal-smoothness",
      },
    ],
    selectionMode: "multi",
    maxSelections: 3,
    motivation: "Geschafft — dein Pflegeplan ist gleich da.",
  },
]

export function getQuestionByStep(step: number): QuizQuestion | undefined {
  return quizQuestions.find((q) => q.step === step)
}
