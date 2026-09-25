import type { DiagnosticConcern } from "@/lib/quiz/diagnostic-input"
import type { Stage1Category } from "@/lib/personal-plan/types"

/**
 * The main-problem recipes for the discovery-call cockpit — one per quiz concern.
 *
 * Internal only: the founder reads these in the call, the participant never sees them.
 * Source of truth is `docs/research/concern-recipes/recipes.json` (method, evidence labels
 * and the `when` semantics are in the README next to it). This table mirrors that JSON
 * verbatim so the cockpit gets a typed value; `tests/discovery-concern-recipes.test.ts`
 * fails if the two drift apart or a concern code is missing — edit the JSON first, then
 * this table.
 */

export type ConcernRecipeEvidence = "strong" | "moderate" | "weak" | "unknown"

export type ConcernRecipeCategory = Stage1Category

/**
 * One gate: OR within a key, AND across keys. Several entries with the same category are
 * OR across entries (README „`when` semantics").
 */
export type ConcernRecipeWhen = {
  hair_texture?: Array<"straight" | "wavy" | "curly" | "coily">
  thickness?: Array<"fine" | "normal" | "coarse">
  scalp_type?: Array<"oily" | "balanced" | "dry">
  damaged?: true
  chemical_treatment?: Array<"colored" | "lightened" | "permed" | "chemically_straightened">
  heat_styling?: true
}

export type ConcernRecipe = {
  code: DiagnosticConcern
  labelDe: string
  meaningDe: string
  researchRef: { concerns: string[]; goals: string[] }
  primary: {
    categories: Array<{
      category: ConcernRecipeCategory
      why: string
      evidence: ConcernRecipeEvidence
    }>
    /** A lever with a `category` may unlock it only when the call confirms the signal. */
    levers: Array<{
      lever: string
      evidence: ConcernRecipeEvidence
      category?: ConcernRecipeCategory
    }>
  }
  conditional: Array<{
    category: ConcernRecipeCategory
    when: ConcernRecipeWhen
    why: string
    evidence: ConcernRecipeEvidence
  }>
  avoid: string[]
  boundary: string | null
  conflicts: DiagnosticConcern[]
  talkingPointDe: string
  callQuestionsDe: string[]
  /** English, internal: open questions for domain review. */
  domainReview: string[]
  evidence: ConcernRecipeEvidence
}

export const CONCERN_RECIPES: readonly ConcernRecipe[] = [
  {
    code: "dry_lengths",
    labelDe: "Trockene oder strohige Längen",
    meaningDe:
      "Die Längen fühlen sich rau, strohig oder spröde an und lassen sich schwer kämmen – gemeint sind die Längen, nicht die Kopfhaut.",
    researchRef: {
      concerns: ["dryness"],
      goals: ["moisture"],
    },
    primary: {
      categories: [
        {
          category: "conditioner",
          why: "Nach jeder Wäsche in Längen und Spitzen: glättet die Oberfläche, verbessert Gleitfähigkeit und Kämmbarkeit, weniger raues Gefühl.",
          evidence: "strong",
        },
        {
          category: "leave_in",
          why: "Gibt zwischen den Wäschen Gleitfähigkeit und Schutz vor Reibung. Menge und Gewicht an die Haardicke anpassen: feines Haar = leichte Formel, sparsam, nur Längen.",
          evidence: "moderate",
        },
        {
          category: "shampoo",
          why: "Mildes Shampoo gezielt auf die Kopfhaut; die Längen werden nur vom ausgespülten Schaum mitgereinigt. Waschrhythmus richtet sich nach der Kopfhaut, nicht nach den Längen.",
          evidence: "strong",
        },
      ],
      levers: [
        {
          lever: "Handtuch: ausdrücken statt rubbeln",
          evidence: "strong",
        },
        {
          lever: "Hitze reduzieren: seltener, niedrigere Stufe, weniger Durchgänge",
          evidence: "strong",
        },
        {
          lever: "Längen beim Waschen nicht schrubben, nur Kopfhaut massieren",
          evidence: "strong",
        },
        {
          lever:
            "Belag-Check: wirken die Längen eher belegt/schwer als rau? Dann einmalig Tiefenreinigung statt mehr Pflege",
          evidence: "moderate",
          category: "deep_cleansing_shampoo",
        },
      ],
    },
    conditional: [
      {
        category: "mask",
        when: {
          thickness: ["coarse"],
        },
        why: "Grobes Haar verträgt reichhaltigere Pflege; Maske ersetzt an dem Waschtag den Conditioner.",
        evidence: "moderate",
      },
      {
        category: "mask",
        when: {
          hair_texture: ["curly", "coily"],
        },
        why: "Locken und Coils brauchen erfahrungsgemäß mehr Gleitfähigkeit; Maske ersetzt an dem Waschtag den Conditioner.",
        evidence: "moderate",
      },
      {
        category: "mask",
        when: {
          damaged: true,
          thickness: ["normal", "coarse"],
        },
        why: "Chemisch/thermisch strapazierte Längen sind rauer und poröser; reichhaltigere Pflege glättet spürbar. Bei feinem Haar stattdessen beim leichten Leave-in bleiben.",
        evidence: "moderate",
      },
      {
        category: "oil",
        when: {
          hair_texture: ["curly", "coily"],
        },
        why: "Wenige Tropfen in die Spitzen als Gleit- und Abschlussfilm, nicht als „Feuchtigkeit“.",
        evidence: "weak",
      },
      {
        category: "oil",
        when: {
          thickness: ["coarse"],
        },
        why: "Wenige Tropfen in die Spitzen als Gleit- und Abschlussfilm.",
        evidence: "weak",
      },
      {
        category: "heat_protectant",
        when: {
          heat_styling: true,
        },
        why: "Reduziert messbaren Hitzeschaden, ersetzt aber nicht weniger Hitze.",
        evidence: "moderate",
      },
      {
        category: "bondbuilder",
        when: {
          chemical_treatment: ["lightened", "permed", "chemically_straightened"],
        },
        why: "Strohigkeit nach Blondierung/Dauerwelle/Glättung ist oft Strukturschaden; ein Bondbuilder kann unterstützen, ersetzt aber Conditioner und Leave-in nicht.",
        evidence: "weak",
      },
    ],
    avoid: [
      "Reichhaltige Maske oder Öl als ersten Schritt bei feinem Haar oder fettiger Kopfhaut",
      "Trockenheit als „Wassermangel“ erklären – gemeint ist Geschmeidigkeit, nicht Wasser",
      "Tiefenreinigung als Standard – trocknet raue Längen weiter aus",
      "Bondbuilder/Protein als Trockenheits-Lösung ohne chemische Vorbehandlung",
      "Pflege auf den Ansatz bei fettiger Kopfhaut",
    ],
    boundary:
      "Nur Längen. Trockene, spannende, juckende, schuppende oder gerötete Kopfhaut ist ein anderes Thema; hält das an oder ist es entzündlich, gehört es dermatologisch abgeklärt.",
    conflicts: ["lost_shape", "low_volume_or_weighed_down"],
    talkingPointDe:
      "So gehen wir es an: Deine Längen brauchen vor allem mehr Gleitfähigkeit und Schutz – Conditioner nach jeder Wäsche, dazu ein passendes Leave-in, und Shampoo nur auf die Kopfhaut. Ob du zusätzlich etwas Reichhaltigeres brauchst, richten wir nach deiner Haardicke, damit nichts beschwert.",
    callQuestionsDe: [
      "Fühlen sich die Längen eher rau/strohig an oder eher belegt/schwer?",
      "Wie oft nutzt du Föhn, Glätteisen oder Lockenstab – und auf welcher Stufe?",
      "Ist die Kopfhaut auch trocken, oder nur die Längen?",
    ],
    domainReview: [],
    evidence: "strong",
  },
  {
    code: "frizz_flyaways",
    labelDe: "Frizz oder viele abstehende Haare",
    meaningDe:
      "Die Haare stehen ab, wirken puffig oder bilden einen „Heiligenschein“ – oft bei Luftfeuchtigkeit oder nach dem Trocknen; bei Wellen und Locken meist ein gestörtes Muster.",
    researchRef: {
      concerns: ["frizz"],
      goals: ["less_frizz"],
    },
    primary: {
      categories: [
        {
          category: "conditioner",
          why: "Senkt Reibung und statische Aufladung, glättet die Oberfläche – der am besten belegte erste Schritt gegen Frizz.",
          evidence: "strong",
        },
        {
          category: "leave_in",
          why: "Reduziert Frizz, Flyaways und statische Aufladung zwischen den Wäschen. Gewicht an die Haardicke anpassen: feines Haar = leichte Sprühformel, grobes/lockiges Haar = cremiger.",
          evidence: "strong",
        },
      ],
      levers: [
        {
          lever: "Handtuch: ausdrücken statt rubbeln (Mikrofaser/T-Shirt)",
          evidence: "strong",
        },
        {
          lever: "Wellen, Locken, Coils nicht trocken bürsten; im nassen Haar mit Pflege entwirren",
          evidence: "strong",
        },
        {
          lever: "Produkte im nassen/feuchten Haar einarbeiten und beim Trocknen wenig anfassen",
          evidence: "moderate",
        },
        {
          lever: "Hitze reduzieren; Föhn mit Abstand und in Bewegung",
          evidence: "strong",
        },
        {
          lever:
            "Belag-Check: wirkt das Haar schwer/belegt und trotzdem frizzy? Dann einmalig Tiefenreinigung",
          evidence: "moderate",
          category: "deep_cleansing_shampoo",
        },
      ],
    },
    conditional: [
      {
        category: "mask",
        when: {
          hair_texture: ["curly", "coily"],
        },
        why: "Mehr Gleitfähigkeit für Locken/Coils; Maske ersetzt an dem Waschtag den Conditioner.",
        evidence: "moderate",
      },
      {
        category: "mask",
        when: {
          damaged: true,
          thickness: ["normal", "coarse"],
        },
        why: "Geschädigte Längen reagieren stärker auf Feuchtigkeit und sind rauer; reichhaltigere Pflege glättet.",
        evidence: "moderate",
      },
      {
        category: "oil",
        when: {
          thickness: ["coarse"],
        },
        why: "Wenige Tropfen als glättender Abschluss auf den Längen.",
        evidence: "weak",
      },
      {
        category: "oil",
        when: {
          hair_texture: ["curly", "coily"],
          thickness: ["normal", "coarse"],
        },
        why: "Wenige Tropfen als Abschluss, nachdem Leave-in eingearbeitet ist; nicht statt Leave-in.",
        evidence: "weak",
      },
      {
        category: "heat_protectant",
        when: {
          heat_styling: true,
        },
        why: "Hitze macht die Oberfläche rauer und feuchtigkeitsempfindlicher; Schutz unterstützt, weniger Hitze bleibt wichtiger.",
        evidence: "moderate",
      },
    ],
    avoid: [
      "Öl als Standardantwort auf Frizz",
      "Protein/Bondbuilder als generelle Frizz-Lösung ohne Schadenssignal (dann Rezept hair_damage)",
      "Trockenes Bürsten von Wellen/Locken/Coils",
      "Schwere Pflege bei feinem Haar – macht platt und trotzdem nicht frizzfrei",
      "Versprechen, dass ein Produkt Frizz bei Luftfeuchtigkeit komplett verhindert",
    ],
    boundary:
      "Sind die „abstehenden Haare“ kurze abgebrochene Stücke, gilt das Rezept breakage. Viele neue kurze Haare am Haaransatz nach einer Phase mit starkem Ausfall sind meist nachwachsendes Haar – kosmetisch unkritisch, aber wenn der Ausfall selbst Thema ist, gilt die Grenze von hair_loss_or_thinning.",
    conflicts: ["lost_shape", "low_volume_or_weighed_down"],
    talkingPointDe:
      "So gehen wir es an: Frizz hat meist mehrere Ursachen – wir glätten zuerst die Oberfläche mit Conditioner und einem passenden Leave-in und ändern ein, zwei Handgriffe beim Abtrocknen und Stylen. Wie reichhaltig das sein darf, richten wir nach deiner Haardicke, damit nichts beschwert.",
    callQuestionsDe: [
      "Wird es vor allem bei feuchtem Wetter schlimmer?",
      "Sind das eher kurze abgebrochene Haare oder die normalen Längen, die abstehen?",
      "Bürstest du deine Haare trocken, und wie trocknest du sie?",
    ],
    domainReview: [],
    evidence: "moderate",
  },
  {
    code: "low_shine",
    labelDe: "Wenig Glanz",
    meaningDe: "Die Längen wirken stumpf und matt und reflektieren kaum Licht.",
    researchRef: {
      concerns: [],
      goals: ["shine"],
    },
    primary: {
      categories: [
        {
          category: "conditioner",
          why: "Glättet die Oberfläche und legt einen Film auf – glattere Oberfläche reflektiert Licht gleichmäßiger.",
          evidence: "moderate",
        },
      ],
      levers: [
        {
          lever: "Schonend waschen: Shampoo auf die Kopfhaut, Längen nicht schrubben",
          evidence: "strong",
        },
        {
          lever: "Reibung und Hitze reduzieren (Handtuch, Bürste, Glätteisen)",
          evidence: "strong",
        },
        {
          lever:
            "Beim Föhnen von oben nach unten trocknen, zum Schluss kühl – richtet die Haare aus",
          evidence: "weak",
        },
        {
          lever:
            "Gefärbtes Haar: unnötige Wäschen, Sonne und Hitze reduzieren – Glanzverlust ist oft verblassende Farbe",
          evidence: "strong",
        },
        {
          lever:
            "Belag-Check: stumpf, schwer, wachsig? Dann einmalig Tiefenreinigung – nicht als Standard bei gefärbtem oder trockenem Haar",
          evidence: "moderate",
          category: "deep_cleansing_shampoo",
        },
      ],
    },
    conditional: [
      {
        category: "leave_in",
        when: {
          thickness: ["fine"],
        },
        why: "Leichter Glättungsfilm ohne das Gewicht von Öl.",
        evidence: "weak",
      },
      {
        category: "oil",
        when: {
          thickness: ["normal", "coarse"],
        },
        why: "Ein, zwei Tropfen als Glanzfinish auf trockene Längen; Effekt ist ein Film, keine Reparatur.",
        evidence: "weak",
      },
      {
        category: "mask",
        when: {
          damaged: true,
          thickness: ["normal", "coarse"],
        },
        why: "Raue, strapazierte Längen streuen Licht; reichhaltigere Pflege glättet sichtbar.",
        evidence: "moderate",
      },
      {
        category: "heat_protectant",
        when: {
          heat_styling: true,
        },
        why: "Hitze raut die Oberfläche auf und lässt Farbe verblassen; Schutz unterstützt, weniger Hitze bleibt wichtiger.",
        evidence: "moderate",
      },
    ],
    avoid: [
      "Schweres Öl oder Maske für alle – bei feinem Haar platt und fettig statt glänzend",
      "Versprechen, die Schuppenschicht wieder „wie neu“ zu machen",
      "Häufige Tiefenreinigung bei gefärbtem Haar (beschleunigt Verblassen und Trockenheit)",
      "Glanz ausschließlich auf Schaden zurückführen – Rückstände und Styling spielen oft mit",
    ],
    boundary: null,
    conflicts: ["low_volume_or_weighed_down"],
    talkingPointDe:
      "So gehen wir es an: Glanz entsteht, wenn die Oberfläche glatt ist und Licht gleichmäßig zurückwirft – wir glätten mit Conditioner, schonen die Längen beim Waschen und Föhnen und prüfen, ob Rückstände den Glanz schlucken.",
    callQuestionsDe: [
      "Wirken die Längen eher rau oder eher belegt/schwer?",
      "Ist dein Haar gefärbt, und ist der Glanz nach dem Färben erst gut und lässt dann nach?",
      "Wie stylst du – Föhn, Glätteisen, Lufttrocknen?",
    ],
    domainReview: [
      "Maps to research goal `shine`, not a concern in goal-concern-levers; the concern-level recipe is derived from the shine goal lever map.",
      "Should `colored` alone (without lightening) unlock anything for low_shine, e.g. a color-care shampoo? Our catalog has no separate color-care category; kept as a non-product lever.",
    ],
    evidence: "moderate",
  },
  {
    code: "lost_shape",
    labelDe:
      "Form verliert sich schnell (je nach Haarstruktur: Form und Halt / Wellen / Locken-Definition / Coil-Definition)",
    meaningDe:
      "Bei Wellen, Locken und Coils: Die Definition fällt schnell zusammen oder hängt aus. Bei glattem Haar: Die Frisur hält nicht und die Längen wirken schnell platt und kraftlos.",
    researchRef: {
      concerns: [],
      goals: ["curl_definition", "volume"],
    },
    primary: {
      categories: [
        {
          category: "conditioner",
          why: "Gleitfähigkeit ist die Grundlage für Definition bei Wellen/Locken; bei glattem Haar leicht und nur in Längen und Spitzen, damit nichts runterzieht.",
          evidence: "moderate",
        },
      ],
      levers: [
        {
          lever:
            "Wellen/Locken/Coils: Produkte im nassen Haar abschnittsweise einarbeiten, dann bis zum Trocknen möglichst nicht anfassen",
          evidence: "weak",
        },
        {
          lever: "Nicht trocken bürsten; entwirren nur nass mit Pflege",
          evidence: "moderate",
        },
        {
          lever:
            "Lufttrocknen oder Diffusor auf niedriger Stufe statt heißem Föhnen mit viel Bewegung",
          evidence: "weak",
        },
        {
          lever:
            "Halt kommt von Stylingprodukten (Gel, Mousse) – nicht in unserem Empfehlungskatalog, im Call nur als Hebel benennen",
          evidence: "moderate",
        },
        {
          lever:
            "Glattes Haar: Ansatz sauber halten, Pflege vom Ansatz fern, beim Föhnen am Ansatz anheben; Schnitt kann viel ausmachen",
          evidence: "weak",
        },
        {
          lever:
            "Belag-Check: hängen Locken aus, obwohl viel Pflege drauf ist? Dann einmalig Tiefenreinigung",
          evidence: "moderate",
          category: "deep_cleansing_shampoo",
        },
      ],
    },
    conditional: [
      {
        category: "leave_in",
        when: {
          hair_texture: ["wavy", "curly", "coily"],
        },
        why: "Im nassen Haar eingearbeitet hilft es, Strähnen zu Gruppen zu formen, und reduziert Frizz. Bei feinen Wellen leichte Formel, sonst hängen sie aus. Nächste Kategorie zu Curl-Cremes.",
        evidence: "moderate",
      },
      {
        category: "dry_shampoo",
        when: {
          hair_texture: ["straight", "wavy"],
          scalp_type: ["oily"],
        },
        why: "Wenn die Form am zweiten Tag wegen fettigem Ansatz zusammenfällt: sparsam am Ansatz zwischen den Wäschen, ersetzt aber das Waschen nicht.",
        evidence: "weak",
      },
      {
        category: "heat_protectant",
        when: {
          heat_styling: true,
        },
        why: "Hitzeschaden kann das Lockenmuster dauerhaft lockern; Schutz unterstützt, weniger Hitze bleibt wichtiger.",
        evidence: "moderate",
      },
    ],
    avoid: [
      "„Mehr Feuchtigkeit“ als Standardantwort – zu viel oder zu schwere Pflege lässt Wellen/Locken aushängen",
      "Schwere Öle oder Masken bei feinen Wellen",
      "Trockenes Bürsten zum „Formen“",
      "Tiefenreinigung als Standard bei trockenem, gefärbtem oder gereiztem Haar",
      "Versprechen, dass Produkte die Lockenstruktur dauerhaft verändern",
    ],
    boundary: null,
    conflicts: ["dry_lengths", "frizz_flyaways", "low_volume_or_weighed_down", "hair_damage"],
    talkingPointDe:
      "So gehen wir es an: Form hält am besten, wenn nichts dein Haar beschwert und du sie im nassen oder feuchten Haar festlegst – leichte Pflege in den Längen, ein sauberer Ansatz, und beim Trocknen möglichst wenig anfassen. Welche Schritte genau, richten wir nach deiner Haarstruktur.",
    callQuestionsDe: [
      "Wann fällt die Form zusammen – direkt nach dem Trocknen oder erst am nächsten Tag?",
      "Wie viel und welche Pflege benutzt du gerade – eher viel und reichhaltig oder eher wenig?",
      "Bürstest oder kämmst du die Haare, wenn sie trocken sind?",
    ],
    domainReview: [
      "Maps to research goal `curl_definition` (quiz goal `shape_definition`), not a concern in goal-concern-levers; for straight hair the label means style hold/body, which is closer to research goal `volume`.",
      "The best-supported product lever (hold: gel/mousse/styling cream, `moderate`) is outside our recommendable categories (styling_* keys exist in CanonicalProductCategoryKey but are not recommended). The recipe falls back to leave_in; decide whether the call may name gel/mousse generically.",
      'Straight-hair variant ("Form und Halt") has only practice-level evidence (weak).',
    ],
    evidence: "moderate",
  },
  {
    code: "low_volume_or_weighed_down",
    labelDe:
      "Platt oder beschwert (je nach Haarstruktur: flacher Ansatz / ungleichmäßiges Volumen)",
    meaningDe:
      "Glatt/wellig: Der Ansatz liegt flach oder die Längen wirken schnell schwer und platt. Lockig/Coils: Volumen verteilt sich ungleichmäßig, z. B. oben flach und unten breit.",
    researchRef: {
      concerns: [],
      goals: ["volume"],
    },
    primary: {
      categories: [
        {
          category: "shampoo",
          why: "Gezielt auf die Kopfhaut; Talg und Rückstände am Ansatz lassen ihn flach wirken. Bei fettiger Kopfhaut ist häufigeres Waschen in Ordnung.",
          evidence: "moderate",
        },
        {
          category: "conditioner",
          why: "Leichte Formel, kleine Menge, nur Längen und Spitzen – nie an den Ansatz.",
          evidence: "moderate",
        },
      ],
      levers: [
        {
          lever:
            "Gewicht rausnehmen: weniger Produkt, nichts am Ansatz, schwere Schritte weglassen",
          evidence: "moderate",
        },
        {
          lever: "Ansatz vollständig trocknen und dabei gegen die Fallrichtung anheben",
          evidence: "weak",
        },
        {
          lever: "Schnitt/Stufen: lange, schwere Längen hängen flacher",
          evidence: "weak",
        },
        {
          lever:
            "Belag-Check: schwer, belegt, schnell platt trotz Waschen? Dann einmalig Tiefenreinigung",
          evidence: "moderate",
          category: "deep_cleansing_shampoo",
        },
      ],
    },
    conditional: [
      {
        category: "dry_shampoo",
        when: {
          scalp_type: ["oily"],
        },
        why: "Sparsam am Ansatz zwischen zwei Wäschen, bindet Talg und gibt kurzfristig Stand. Ersetzt das Waschen nicht; nach ein, zwei Anwendungen wieder richtig waschen.",
        evidence: "weak",
      },
      {
        category: "leave_in",
        when: {
          hair_texture: ["curly", "coily"],
        },
        why: "Bei Locken/Coils geht es eher um gleichmäßige Form als um reines Anheben: leichtes Leave-in im nassen Haar für gleichmäßige Lockengruppen, nicht am Ansatz.",
        evidence: "weak",
      },
      {
        category: "heat_protectant",
        when: {
          heat_styling: true,
        },
        why: "Wenn Volumen über Föhnen/Rundbürste entsteht, als Schutz – nicht als Volumenprodukt.",
        evidence: "moderate",
      },
    ],
    avoid: [
      "Masken und Öle bei feinem Haar oder fettigem Ansatz",
      "Reichhaltiges Leave-in bei feinem Haar",
      "Pflege oder Öl am Ansatz",
      "„Volumenshampoo macht das Haar dicker“ – es reinigt, verändert aber nicht die Dichte",
      "Trockenshampoo als Ersatz fürs Waschen",
      "Wachstums- oder Verdichtungsversprechen",
    ],
    boundary:
      "Wenn „platt“ eigentlich heißt, dass das Haar weniger dicht wird, der Scheitel breiter wirkt oder mehr Kopfhaut durchscheint, gilt die Grenze von hair_loss_or_thinning – nicht dieses Rezept.",
    conflicts: [
      "dry_lengths",
      "frizz_flyaways",
      "low_shine",
      "lost_shape",
      "hair_damage",
      "hair_loss_or_thinning",
      "breakage",
      "split_ends",
      "tangling",
    ],
    talkingPointDe:
      "So gehen wir es an: Wir nehmen Gewicht raus – Shampoo gezielt an den Ansatz, Pflege nur in Längen und Spitzen und in kleinen Mengen, und wir prüfen, ob sich Rückstände angesammelt haben. Volumen holen wir über Reinigung und Styling, nicht über noch mehr Pflege.",
    callQuestionsDe: [
      "Ist dein Haar direkt nach dem Waschen platt oder erst nach ein, zwei Tagen?",
      "Hast du das Gefühl, dass dein Haar weniger dicht geworden ist – oder ist es eher schwer und flach?",
      "Was benutzt du nach dem Waschen, und wie viel davon?",
    ],
    domainReview: [
      "Maps to research goal `volume` (quiz goal `volume_balance`), not a concern in goal-concern-levers.",
      "For curly/coily the quiz label means uneven shape/volume distribution, which is largely cut and styling; evidence for a product recipe there is weak. Confirm the call should lead with cut/styling for curly/coily.",
    ],
    evidence: "moderate",
  },
  {
    code: "hair_damage",
    labelDe: "Mein Haar wirkt insgesamt strapaziert oder geschädigt",
    meaningDe:
      "Sammelbegriff: Längen fühlen sich rau, stumpf, porös oder „anders“ an, oft nach Blondieren, Färben oder viel Hitze – manchmal mit Bruch, Spliss oder Knoten.",
    researchRef: {
      concerns: ["hair_damage"],
      goals: ["healthier_hair", "strengthen"],
    },
    primary: {
      categories: [
        {
          category: "conditioner",
          why: "Senkt Reibung und Kämmkraft, macht strapazierte Längen geschmeidiger und reduziert Bruch beim Kämmen.",
          evidence: "strong",
        },
        {
          category: "leave_in",
          why: "Gleitfähigkeit und Schutz zwischen den Wäschen; feines Haar: leichte Formel, sparsam.",
          evidence: "strong",
        },
      ],
      levers: [
        {
          lever:
            "Schadensquelle zuerst reduzieren: weniger Hitze, niedrigere Stufe, weniger Durchgänge",
          evidence: "strong",
        },
        {
          lever: "Chemische Behandlungen strecken, nicht überlappend blondieren/färben/glätten",
          evidence: "strong",
        },
        {
          lever:
            "Sanft entwirren: abschnittsweise, von den Spitzen nach oben, breiter Kamm oder Finger",
          evidence: "strong",
        },
        {
          lever: "Strukturell kaputte Spitzen schneiden lassen",
          evidence: "moderate",
        },
        {
          lever:
            "Einordnung: Haar ist nicht lebendig und heilt nicht – Pflege verbessert Gefühl und Optik und bremst neuen Schaden",
          evidence: "strong",
        },
      ],
    },
    conditional: [
      {
        category: "bondbuilder",
        when: {
          chemical_treatment: ["lightened", "permed", "chemically_straightened"],
        },
        why: "Für chemisch geschädigtes Haar gibt es Hinweise auf mehr Festigkeit und weniger Bruch (vor allem Labor-/In-vitro-Daten); als Unterstützung, nicht als Reparatur.",
        evidence: "moderate",
      },
      {
        category: "mask",
        when: {
          thickness: ["normal", "coarse"],
        },
        why: "Reichhaltigere Pflege glättet raue Längen; Maske ersetzt an dem Waschtag den Conditioner. Bei feinem Haar beim leichten Leave-in bleiben.",
        evidence: "moderate",
      },
      {
        category: "mask",
        when: {
          hair_texture: ["curly", "coily"],
        },
        why: "Locken/Coils brauchen mehr Gleitfähigkeit; Maske ersetzt an dem Waschtag den Conditioner.",
        evidence: "moderate",
      },
      {
        category: "heat_protectant",
        when: {
          heat_styling: true,
        },
        why: "Reduziert messbaren Hitzeschaden; steht aber hinter „weniger Hitze“.",
        evidence: "moderate",
      },
      {
        category: "oil",
        when: {
          thickness: ["coarse"],
        },
        why: "Wenige Tropfen in die Spitzen als Gleitfilm; keine Strukturreparatur.",
        evidence: "weak",
      },
    ],
    avoid: [
      "Öle und Masken, während Blondierung, viel Hitze oder grobes Entwirren unverändert weiterlaufen",
      "„Reparieren“, „heilen“, „wie neu“",
      "Nahrungsergänzungsmittel gegen Längenschäden",
      "„Mehr Protein“ als Pauschalantwort – kann strapaziertes Haar steif und rau machen",
      "Reichhaltige Maske bei feinem Haar als erster Schritt",
      "Tiefenreinigung als Standard",
    ],
    boundary:
      "Kommt zum strapazierten Haar vermehrter Ausfall mit Wurzel, lichter werdendes Haar oder Kopfhautbeschwerden hinzu, gilt die Grenze von hair_loss_or_thinning. Brennen, Wunden oder starke Reaktion der Kopfhaut nach Färben/Blondieren → ärztlich abklären lassen.",
    conflicts: ["lost_shape", "low_volume_or_weighed_down"],
    talkingPointDe:
      "So gehen wir es an: Geschädigte Längen kann man nicht heilen, aber wir können sie deutlich geschmeidiger machen und vor allem verhindern, dass neuer Schaden dazukommt – weniger Hitze und Belastung, konsequent Conditioner und Leave-in, und bei blondiertem Haar gezielt ein Bondbuilder. Was wirklich kaputt ist, nehmen wir beim nächsten Schnitt mit.",
    callQuestionsDe: [
      "Was glaubst du, woher der Schaden kommt – Blondieren, Färben, Hitze, Kämmen?",
      "Wie oft blondierst oder färbst du, und wann war die letzte Behandlung?",
      "Brechen Haare ab, oder fühlen sie sich vor allem rau und stumpf an?",
    ],
    domainReview: [
      "Should `colored` (permanent color without lightening) count as `damaged`? Currently only lightened/permed/chemically_straightened unlock bondbuilder.",
    ],
    evidence: "strong",
  },
  {
    code: "hair_loss_or_thinning",
    labelDe: "Haarausfall oder dünner werdendes Haar",
    meaningDe:
      "„Mir fallen mehr Haare auf als sonst oder mein Haar wirkt weniger dicht.“ Kann Ausfall mit Wurzel, abnehmende Dichte, breiteren Scheitel – oder eigentlich Haarbruch meinen.",
    researchRef: {
      concerns: ["hair_loss", "thinning"],
      goals: [],
    },
    primary: {
      categories: [],
      levers: [
        {
          lever:
            "Erst trennen: ganze Haare mit kleinem hellem Knötchen an der Wurzel = Ausfall; kurze Stücke ohne Wurzel = Bruch (→ Rezept breakage)",
          evidence: "strong",
        },
        {
          lever:
            "Ausfall oder lichter werdendes Haar: ärztliche Abklärung empfehlen, bevorzugt Hautärztin/Hautarzt",
          evidence: "strong",
        },
        {
          lever:
            "Erst nach dieser Einordnung und nicht als Behandlung: straffe Frisuren und Zug meiden, sanft entwirren",
          evidence: "moderate",
        },
      ],
    },
    conditional: [],
    avoid: [
      "Jede Produktempfehlung als Antwort auf Ausfall oder Ausdünnung – kein Rezept",
      "Shampoos, Seren oder scalp_care-Produkte „gegen Haarausfall“ oder „für Wachstum“",
      "Nahrungsergänzungsmittel, Kopfhautöle, Massagen oder Peelings als Lösung",
      "Worte wie stoppen, nachwachsen, Wachstum anregen, Follikel stärken",
      "Eine Ursache benennen oder vermuten (Hormone, Stress, Eisenmangel, Genetik)",
      "Beschwichtigen („das ist bestimmt normal“) oder Medikamente absetzen lassen",
    ],
    boundary:
      "Nur Grenze, kein Produktrezept. Ausfall und Ausdünnung haben viele Ursachen und gehören ärztlich abgeklärt. Deutliche Warnzeichen für eine zeitnahe Abklärung: plötzlicher oder büschelweiser Ausfall, kahle oder lichte Stellen, sichtbar breiterer Scheitel/lichter Oberkopf, Schmerz, Brennen, Jucken, Rötung, Schuppung oder Pusteln an der Kopfhaut, Ausfall nach Geburt, Fieber, OP, starkem Gewichtsverlust oder Medikamentenwechsel, oder wenn es sie belastet. Bei gleichzeitigem Haarbruch darf das Rezept breakage für die Längen laufen – ausdrücklich ohne Anspruch, den Ausfall zu behandeln.",
    conflicts: ["low_volume_or_weighed_down", "breakage"],
    talkingPointDe:
      "Dass dir mehr Haare ausfallen oder dein Haar lichter wirkt, nehmen wir ernst – dafür kann es viele Gründe geben, und die sollte eine Hautärztin oder ein Hautarzt abklären. Was wir mit dir angehen können, ist die Pflege deiner Längen, damit nicht zusätzlich etwas abbricht – das ersetzt aber keine Abklärung.",
    callQuestionsDe: [
      "Sind es eher ganze Haare mit Wurzel oder kurze abgebrochene Stücke?",
      "Kam das plötzlich oder schleichend – und seit wann?",
      "Warst du damit schon bei einer Ärztin oder einem Arzt?",
    ],
    domainReview: [
      "Confirm the call may ask the Wurzel-vs-Stück question at all, or whether the founder should only acknowledge and refer.",
      "Legal/compliance check of the talking point wording (HWG/EU cosmetic claims) before it is used verbatim.",
    ],
    evidence: "strong",
  },
  {
    code: "breakage",
    labelDe: "Mein Haar bricht in den Längen ab",
    meaningDe:
      "Einzelne Haare reißen oberhalb der Spitzen ab – kurze abgebrochene Stücke, ungleich lange Haare, oft beim Kämmen, nach Hitze oder Blondierung.",
    researchRef: {
      concerns: ["breakage"],
      goals: ["anti_breakage"],
    },
    primary: {
      categories: [
        {
          category: "conditioner",
          why: "Conditioner senkt in Kämmstudien den Bruch messbar, besonders bei blondiertem Haar.",
          evidence: "strong",
        },
        {
          category: "leave_in",
          why: "Gleitfähigkeit beim Entwirren und Stylen; weniger Kraft beim Kämmen = weniger Bruch.",
          evidence: "strong",
        },
      ],
      levers: [
        {
          lever:
            "Bruch von Ausfall trennen: kurze Stücke ohne Wurzel = Bruch; ganze Haare mit Wurzel → hair_loss_or_thinning",
          evidence: "strong",
        },
        {
          lever:
            "Entwirren: abschnittsweise, von den Spitzen nach oben, breiter Kamm oder Finger; Locken/Coils nur nass mit Pflege",
          evidence: "strong",
        },
        {
          lever:
            "Hitze reduzieren: seltener, niedriger, weniger Durchgänge; Glätteisen nur auf trockenes Haar",
          evidence: "strong",
        },
        {
          lever: "Chemische Behandlungen strecken, nicht überlappend blondieren",
          evidence: "strong",
        },
        {
          lever: "Lockere Frisuren, keine straffen Gummis; Handtuch ausdrücken statt rubbeln",
          evidence: "strong",
        },
        {
          lever: "Reibung nachts reduzieren (lockerer Zopf, glatter Bezug)",
          evidence: "moderate",
        },
        {
          lever: "Die am stärksten geschädigten Spitzen schneiden",
          evidence: "moderate",
        },
      ],
    },
    conditional: [
      {
        category: "bondbuilder",
        when: {
          chemical_treatment: ["lightened", "permed", "chemically_straightened"],
        },
        why: "Hinweise auf weniger Bruch und mehr Festigkeit bei chemisch geschädigtem Haar (überwiegend Labor-/In-vitro-Daten); Unterstützung, keine Umkehr.",
        evidence: "moderate",
      },
      {
        category: "heat_protectant",
        when: {
          heat_styling: true,
        },
        why: "Reduziert Hitzeschaden und Bruch in Tests; steht hinter „weniger Hitze“.",
        evidence: "moderate",
      },
      {
        category: "mask",
        when: {
          damaged: true,
          thickness: ["normal", "coarse"],
        },
        why: "Mehr Gleitfähigkeit für raue, strapazierte Längen; Maske ersetzt an dem Waschtag den Conditioner.",
        evidence: "moderate",
      },
      {
        category: "mask",
        when: {
          hair_texture: ["curly", "coily"],
        },
        why: "Locken/Coils brechen vor allem beim Entwirren; mehr Gleitfähigkeit hilft.",
        evidence: "moderate",
      },
      {
        category: "oil",
        when: {
          hair_texture: ["curly", "coily"],
        },
        why: "Etwas Öl auf schwierige Stellen als zusätzliche Gleitfähigkeit beim Entwirren.",
        evidence: "weak",
      },
    ],
    avoid: [
      "Ausfall als Bruch behandeln",
      "„Dir fehlt Protein“ als Pauschalerklärung",
      "Öl oder Maske als alleinige Lösung, während Hitze/Blondierung/Zug weiterlaufen",
      "Fester oder häufiger bürsten",
      "Straffe Zöpfe, Dutts oder Extensions ohne Hinweis auf Zug",
    ],
    boundary:
      "Ganze Haare mit Wurzel, lichter werdendes Haar, kahle Stellen oder plötzlich viel Ausfall → Grenze von hair_loss_or_thinning. Kommt beides vor, darf dieses Rezept für die Längen laufen, ohne den Ausfall zu behandeln. Plötzlicher starker Bruch direkt nach einer chemischen Behandlung mit brennender oder wunder Kopfhaut → ärztlich abklären.",
    conflicts: ["low_volume_or_weighed_down", "hair_loss_or_thinning"],
    talkingPointDe:
      "So gehen wir es an: Haarbruch entsteht fast immer durch Belastung – beim Kämmen, durch Hitze oder durch chemische Behandlungen. Wir sorgen mit Conditioner und Leave-in für Gleitfähigkeit, ändern, wie du entwirrst und stylst, und nehmen Belastung raus; wenn deine Längen blondiert sind, kann ein Bondbuilder zusätzlich unterstützen.",
    callQuestionsDe: [
      "Sind es kurze abgebrochene Stücke oder ganze Haare mit Wurzel?",
      "Wann bricht es – beim Kämmen, beim Glätten, beim Zopfmachen?",
      "Sind deine Längen blondiert, dauergewellt oder chemisch geglättet?",
    ],
    domainReview: [],
    evidence: "strong",
  },
  {
    code: "split_ends",
    labelDe: "Meine Spitzen sind sichtbar gespalten oder ausgefranst",
    meaningDe:
      "Die Enden einzelner Haare teilen sich oder fransen aus; die Spitzen wirken dünn, rau oder verheddern sich.",
    researchRef: {
      concerns: ["split_ends"],
      goals: ["less_split_ends"],
    },
    primary: {
      categories: [
        {
          category: "conditioner",
          why: "Senkt Reibung und beugt neuem Spliss vor; bestehender Spliss wird nur optisch geglättet.",
          evidence: "strong",
        },
        {
          category: "leave_in",
          why: "Hält die Spitzen geschmeidig, damit sie weniger hängen bleiben und weiter aufspleißen; glättet die Optik bis zur nächsten Wäsche.",
          evidence: "moderate",
        },
      ],
      levers: [
        {
          lever: "Bestehenden Spliss schneiden lassen – die einzige echte Lösung",
          evidence: "strong",
        },
        {
          lever: "Wer Länge behalten will: regelmäßig nur wenige Millimeter schneiden",
          evidence: "moderate",
        },
        {
          lever: "Hitze, chemische Belastung und Reibung reduzieren",
          evidence: "strong",
        },
        {
          lever: "Sanft entwirren, von den Spitzen nach oben",
          evidence: "strong",
        },
      ],
    },
    conditional: [
      {
        category: "oil",
        when: {
          thickness: ["normal", "coarse"],
        },
        why: "Ein, zwei Tropfen in die Spitzen glätten die Optik vorübergehend; keine Reparatur.",
        evidence: "weak",
      },
      {
        category: "heat_protectant",
        when: {
          heat_styling: true,
        },
        why: "Hitze ist ein Haupttreiber für neuen Spliss; Schutz unterstützt, weniger Hitze bleibt wichtiger.",
        evidence: "moderate",
      },
      {
        category: "bondbuilder",
        when: {
          chemical_treatment: ["lightened", "permed", "chemically_straightened"],
        },
        why: "Kann chemisch geschwächtes Haar widerstandsfähiger machen und so neuem Spliss vorbeugen; verklebt keinen bestehenden Spliss.",
        evidence: "weak",
      },
    ],
    avoid: [
      "„Repariert“ oder „versiegelt Spliss dauerhaft“",
      "Nur Öl als Antwort",
      "Schneiden aus Angst um die Länge immer weiter aufschieben – Spliss wandert nach oben und verursacht Bruch und Knoten",
      "Feste Schnitt-Intervalle als Regel vorgeben",
    ],
    boundary: null,
    conflicts: ["low_volume_or_weighed_down"],
    talkingPointDe:
      "So gehen wir es an: Ehrlich gesagt – was schon gespalten ist, bekommt man nur mit der Schere weg; Pflege kann es nur optisch glätten. Deshalb einmal die Spitzen schneiden lassen und ab dann mit Conditioner, Leave-in und weniger Hitze dafür sorgen, dass neuer Spliss langsamer entsteht.",
    callQuestionsDe: [
      "Wann warst du zuletzt beim Schneiden?",
      "Ist dir die Länge gerade besonders wichtig?",
      "Wie oft nutzt du Hitze, und sind die Spitzen blondiert?",
    ],
    domainReview: [],
    evidence: "strong",
  },
  {
    code: "tangling",
    labelDe: "Schnelles Verknoten",
    meaningDe: "Die Haare verknoten oder verfilzen schnell, Kämmen ziept und dauert lange.",
    researchRef: {
      concerns: ["tangling"],
      goals: [],
    },
    primary: {
      categories: [
        {
          category: "conditioner",
          why: "Gleitfähigkeit ist der wichtigste Hebel gegen Knoten; senkt die Kämmkraft.",
          evidence: "strong",
        },
        {
          category: "leave_in",
          why: "Wirkt als Entwirrhilfe zwischen den Wäschen; feines Haar: leichte Sprühformel.",
          evidence: "strong",
        },
      ],
      levers: [
        {
          lever: "In Abschnitten entwirren, von den Spitzen nach oben, breiter Kamm oder Finger",
          evidence: "strong",
        },
        {
          lever:
            "Locken/Coils nur nass mit Pflege entwirren; glattes Haar kann angetrocknet mit breitem Kamm entwirrt werden",
          evidence: "strong",
        },
        {
          lever: "Handtuch ausdrücken statt rubbeln; nachts lockerer Zopf oder glatter Bezug",
          evidence: "moderate",
        },
        {
          lever: "Spitzen, die immer wieder hängen bleiben, schneiden lassen",
          evidence: "moderate",
        },
        {
          lever:
            "Belag-Check: fühlt sich das Haar belegt/klebrig an? Dann einmalig Tiefenreinigung",
          evidence: "moderate",
          category: "deep_cleansing_shampoo",
        },
      ],
    },
    conditional: [
      {
        category: "mask",
        when: {
          hair_texture: ["curly", "coily"],
        },
        why: "Mehr Gleitfähigkeit für Locken/Coils; Maske ersetzt an dem Waschtag den Conditioner.",
        evidence: "moderate",
      },
      {
        category: "mask",
        when: {
          damaged: true,
          thickness: ["normal", "coarse"],
        },
        why: "Raue, strapazierte Längen haken stärker ineinander; reichhaltigere Pflege glättet.",
        evidence: "moderate",
      },
      {
        category: "oil",
        when: {
          hair_texture: ["curly", "coily"],
        },
        why: "Etwas Öl auf besonders schwierige Stellen als zusätzliche Gleitfähigkeit.",
        evidence: "weak",
      },
      {
        category: "oil",
        when: {
          thickness: ["coarse"],
        },
        why: "Etwas Öl in die Spitzen als zusätzliche Gleitfähigkeit.",
        evidence: "weak",
      },
    ],
    avoid: [
      "Fester oder öfter bürsten",
      "Trockenes Bürsten von Locken/Coils",
      "Reparaturbehandlung vor Gleitfähigkeit und Technik",
      "Knoten automatisch als Trockenheit deuten – Länge, Struktur, Spliss und Rückstände spielen mit",
      "Schwere Pflege bei feinem Haar",
    ],
    boundary:
      "Bleiben beim Entwirren viele ganze Haare mit Wurzel in der Bürste, ist das Thema eher Ausfall → Grenze von hair_loss_or_thinning. Stark verfilzte Stellen nicht mit Gewalt lösen – das gehört zur Friseurin.",
    conflicts: ["low_volume_or_weighed_down"],
    talkingPointDe:
      "So gehen wir es an: Knoten sind vor allem eine Frage von Gleitfähigkeit und Technik – Conditioner und Leave-in sorgen für Gleitfähigkeit, und du entwirrst in Abschnitten von den Spitzen nach oben, mit breitem Kamm oder den Fingern. Das bringt meistens schon am meisten.",
    callQuestionsDe: [
      "Wann verknotet es am meisten – nach dem Waschen, über Nacht, im Alltag?",
      "Womit und in welchem Zustand entwirrst du – nass, trocken, Bürste, Kamm?",
      "Bleiben die Knoten vor allem in den Spitzen hängen?",
    ],
    domainReview: [],
    evidence: "strong",
  },
]

const RECIPES_BY_CODE = new Map(CONCERN_RECIPES.map((recipe) => [recipe.code, recipe] as const))

export function concernRecipeFor(code: DiagnosticConcern): ConcernRecipe | null {
  return RECIPES_BY_CODE.get(code) ?? null
}
