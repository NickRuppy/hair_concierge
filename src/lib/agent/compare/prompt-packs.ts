export interface AgentComparePromptTemplate {
  id: string
  label: string
  prompt: string
}

export const SHAMPOO_QA_PROMPT_TEMPLATES: AgentComparePromptTemplate[] = [
  {
    id: "shampoo-best-pick",
    label: "Shampoo QA · Bester Pick",
    prompt: "Welches Shampoo passt am besten zu mir?",
  },
  {
    id: "shampoo-oily-roots",
    label: "Shampoo QA · Fettiger Ansatz",
    prompt: "Mein Ansatz fettet schnell, welches Shampoo soll ich nehmen?",
  },
  {
    id: "shampoo-dry-lengths",
    label: "Shampoo QA · Trockene Laengen",
    prompt: "Meine Laengen sind trocken, brauche ich ein anderes Shampoo?",
  },
  {
    id: "shampoo-compare",
    label: "Shampoo QA · Vergleich",
    prompt: "Vergleich mir bitte die passenden Shampoos.",
  },
  {
    id: "shampoo-usage",
    label: "Shampoo QA · Anwendung",
    prompt: "Wie soll ich mein Shampoo anwenden?",
  },
]

export const CONDITIONER_QA_PROMPT_TEMPLATES: AgentComparePromptTemplate[] = [
  {
    id: "conditioner-light-fine-hair",
    label: "Conditioner QA · Fein/leicht",
    prompt: "Welche Spülung passt zu meinem feinen Haar, ohne es zu beschweren?",
  },
  {
    id: "conditioner-dry-strawlike",
    label: "Conditioner QA · Trocken/strohig",
    prompt:
      "Mein Haar ist nach dem Waschen trocken und strohig, welchen Conditioner soll ich nehmen?",
  },
  {
    id: "conditioner-protein-or-moisture",
    label: "Conditioner QA · Protein/Feuchtigkeit",
    prompt: "Brauche ich eine proteinreiche Spülung oder lieber mehr Feuchtigkeit?",
  },
  {
    id: "conditioner-colored-damaged",
    label: "Conditioner QA · Coloriert/strapaziert",
    prompt: "Welche Spülung passt zu coloriertem, strapaziertem Haar?",
  },
  {
    id: "conditioner-curls-frizz",
    label: "Conditioner QA · Locken/Frizz",
    prompt: "Meine Locken fühlen sich weich, aber frizzig an, welcher Conditioner hilft?",
  },
  {
    id: "conditioner-oily-roots-usage",
    label: "Conditioner QA · Fettiger Ansatz",
    prompt: "Kann ich Conditioner nur in die Längen geben, wenn mein Ansatz schnell fettet?",
  },
  {
    id: "conditioner-compare-fine-hair",
    label: "Conditioner QA · Vergleich fein",
    prompt: "Vergleich mir bitte zwei passende Conditioner für feines Haar.",
  },
  {
    id: "conditioner-flattening",
    label: "Conditioner QA · Platt/beschwert",
    prompt: "Mein Conditioner macht die Haare platt, soll ich wechseln?",
  },
  {
    id: "conditioner-split-ends",
    label: "Conditioner QA · Spliss/trockene Spitzen",
    prompt: "Welche Spülung passt, wenn ich Spliss und trockene Spitzen habe?",
  },
  {
    id: "conditioner-overconditioned-cadence",
    label: "Conditioner QA · Überpflegt",
    prompt: "Wie oft sollte ich Conditioner verwenden, wenn meine Haare schnell überpflegt wirken?",
  },
]

export const CONDITIONER_EDGE_PROMPT_TEMPLATES: AgentComparePromptTemplate[] = [
  {
    id: "conditioner-ingredient-unsupported",
    label: "Conditioner Edge · Ingredient-Wunsch",
    prompt: "Welchen silikonfreien Conditioner empfiehlst du mir?",
  },
  {
    id: "conditioner-scalp-redirect",
    label: "Conditioner Edge · Kopfhaut-Redirect",
    prompt: "Welcher Conditioner hilft gegen juckende Kopfhaut?",
  },
]

export const LEAVE_IN_QA_PROMPT_TEMPLATES: AgentComparePromptTemplate[] = [
  {
    id: "leave-in-light-fine-hair",
    label: "Leave-in Test · Fein/leicht",
    prompt: "Welches Leave-in passt zu meinem feinen Haar, ohne es zu beschweren?",
  },
  {
    id: "leave-in-high-heat-protection",
    label: "Leave-in Test · Hitzeschutz hoch",
    prompt:
      "Welches Leave-in passt, wenn ich mein Haar regelmaessig mit Glaetteisen oder Lockenstab style?",
  },
  {
    id: "leave-in-blow-dry-moderate",
    label: "Leave-in Test · Foenen moderat",
    prompt:
      "Ich föhne nur mit Föhn oder Diffusor. Brauche ich trotzdem ein Leave-in mit Hitzeschutz?",
  },
  {
    id: "leave-in-curls-definition",
    label: "Leave-in Test · Locken/Definition",
    prompt:
      "Welches Leave-in passt, wenn meine Wellen oder Locken mehr Definition und weniger Frizz brauchen?",
  },
  {
    id: "leave-in-replacement-vs-booster",
    label: "Leave-in Test · Ersatz/Booster",
    prompt:
      "Kann ein Leave-in bei mir die Spülung ersetzen oder sollte ich es eher als Extra-Pflege verwenden?",
  },
  {
    id: "leave-in-compare",
    label: "Leave-in Test · Vergleich",
    prompt: "Vergleich mir bitte zwei passende Leave-ins für mein Profil.",
  },
]

export const LEAVE_IN_EDGE_PROMPT_TEMPLATES: AgentComparePromptTemplate[] = [
  {
    id: "leave-in-ingredient-unsupported",
    label: "Leave-in Grenzfall · Ingredient-Wunsch",
    prompt: "Welches silikonfreie Leave-in empfiehlst du mir?",
  },
  {
    id: "leave-in-exact-heat-temperature",
    label: "Leave-in Grenzfall · Temperaturclaim",
    prompt: "Welches Leave-in schuetzt sicher bis 230 Grad?",
  },
]

export const MASK_QA_PROMPT_TEMPLATES: AgentComparePromptTemplate[] = [
  {
    id: "mask-dry-damaged",
    label: "Maske QA · Trocken/strapaziert",
    prompt: "Welche Haarmaske passt zu trockenem, strapaziertem Haar?",
  },
  {
    id: "mask-moisture-or-protein",
    label: "Maske QA · Feuchtigkeit/Protein",
    prompt: "Brauche ich eine Feuchtigkeitsmaske oder eine Proteinmaske?",
  },
  {
    id: "mask-overcare-cadence",
    label: "Maske QA · Ueberpflege",
    prompt: "Wie oft sollte ich eine Maske verwenden, ohne mein Haar zu überpflegen?",
  },
  {
    id: "mask-after-bleach",
    label: "Maske QA · Nach Blondierung",
    prompt: "Welche Maske passt nach einer Blondierung?",
  },
  {
    id: "mask-light-fine-dry",
    label: "Maske QA · Fein/leicht",
    prompt: "Meine Haare sind fein und trocken. Gibt es eine leichte Maske?",
  },
  {
    id: "mask-split-ends",
    label: "Maske QA · Spliss",
    prompt: "Kann eine Maske Spliss reparieren oder nur kaschieren?",
  },
  {
    id: "mask-vs-conditioner",
    label: "Maske QA · Vergleich Conditioner",
    prompt: "Vergleich mir bitte eine Maske und einen Conditioner für meine Situation.",
  },
  {
    id: "mask-soft-weak",
    label: "Maske QA · Weich/kraftlos",
    prompt: "Mein Haar fühlt sich weich, aber kraftlos an. Welche Kur passt?",
  },
  {
    id: "mask-frizz-dull",
    label: "Maske QA · Frizz/stumpf",
    prompt: "Welche Maske hilft bei Frizz und stumpfen Längen?",
  },
  {
    id: "mask-order",
    label: "Maske QA · Reihenfolge",
    prompt: "Soll ich Maske vor oder nach Conditioner verwenden?",
  },
]

export const GENERAL_COMPARE_PROMPT_TEMPLATES: AgentComparePromptTemplate[] = [
  {
    id: "glanz",
    label: "Mehr Glanz",
    prompt: "Ich suche einfach eine Pflege, die mehr Glanz bringt.",
  },
  {
    id: "mixed",
    label: "Gemischte Probleme",
    prompt: "Meine Laengen sind trocken und frizzig, aber der Ansatz fettet schnell.",
  },
  {
    id: "direct-product",
    label: "Direkte Produktempfehlung",
    prompt: "Welches Produkt passt am besten zu mir?",
  },
]

export const AGENT_COMPARE_PROMPT_TEMPLATES: AgentComparePromptTemplate[] = [
  ...SHAMPOO_QA_PROMPT_TEMPLATES,
  ...CONDITIONER_QA_PROMPT_TEMPLATES,
  ...CONDITIONER_EDGE_PROMPT_TEMPLATES,
  ...LEAVE_IN_QA_PROMPT_TEMPLATES,
  ...LEAVE_IN_EDGE_PROMPT_TEMPLATES,
  ...MASK_QA_PROMPT_TEMPLATES,
  ...GENERAL_COMPARE_PROMPT_TEMPLATES,
]
