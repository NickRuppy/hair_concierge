import type { QuizAnswers } from "./types"

// --- Card 1: Haartyp (composite label) ---
const structureLabels: Record<string, string> = {
  straight: "glatte",
  wavy: "wellige",
  curly: "lockige",
  coily: "krause",
}

const thicknessLabels: Record<string, string> = {
  fine: "Feine",
  normal: "Mittlere",
  coarse: "Dicke",
}

export function getHaartypLabel(answers: QuizAnswers): string {
  const t = thicknessLabels[answers.thickness ?? ""] ?? "Deine"
  const s = structureLabels[answers.structure ?? ""] ?? ""
  return `${t}, ${s} Haare`
}

// --- Card 2: Haarstärke ---
export const thicknessResults: Record<string, string> = {
  fine: "Fein \u2013 braucht leichte, wässrige Produkte. Dicke Cremes drücken feine Haare platt, weil der Haardurchmesser zu gering ist.",
  normal:
    "Mittel \u2013 gute Basis. Du kannst sowohl leichtere als auch reichhaltigere Produkte nutzen.",
  coarse:
    "Dick \u2013 verträgt reichhaltige Pflege mit hohem Ölanteil. Dickere Haare brauchen mehr Fett und Inhaltsstoffe.",
}

// --- Card 3: Oberfläche ---
export const surfaceResults: Record<string, string> = {
  glatt:
    "Deine Schuppenschicht ist intakt \u2013 die äußere Haarschicht liegt glatt an. Beste Voraussetzung für Glanz.",
  leicht_uneben:
    "Deine Schuppenschicht ist leicht aufgeraut. Ein guter Conditioner gleicht das aus.",
  rau: "Deine Schuppenschicht ist deutlich geschädigt. Du brauchst einen dichteren Conditioner und ein gutes Leave-in.",
}

// --- Card 4: Protein vs. Feuchtigkeit ---
export const pullTestResults: Record<string, string> = {
  stretches_bounces:
    "Dein Zugtest zeigt: Dein Haar dehnt sich und federt zurück \u2013 die Balance stimmt. Du brauchst gute Basispflege, keinen speziellen Repair-Conditioner.",
  stretches_stays:
    "Dein Zugtest zeigt: Deine Haare sind überdehnt und gehen nicht zurück. Das Protein hat nicht mehr genug Spannkraft. Du brauchst einen Protein-Conditioner als Hauptprodukt.",
  snaps:
    "Dein Zugtest zeigt: Deine Haare reißen bei leichtem Zug sofort. Sie brauchen dringend Feuchtigkeit \u2013 Fettalkohole, Glycerin und feuchtigkeitsbindende Inhaltsstoffe.",
}

// --- Card 5: Kopfhaut (type + condition) ---
export const scalpTypeResults: Record<string, string> = {
  fettig: "Deine Kopfhaut fettet schnell — du brauchst ein klares, tiefenreinigendes Shampoo.",
  ausgeglichen: "Deine Kopfhaut ist ausgeglichen — keine speziellen Maßnahmen beim Shampoo nötig.",
  trocken:
    "Deine Kopfhaut ist dehydriert. Du brauchst ein mildes Shampoo und evtl. ein Serum mit Niacinamid und Ceramiden.",
}

export const scalpConditionResults: Record<string, string> = {
  keine: "",
  schuppen:
    " Dazu kommen Schuppen — weiße oder gelbliche Flocken, die auf ein Ungleichgewicht hindeuten.",
  trockene_schuppen:
    " Dazu kommen trockene Schuppen — kleine, weiße Flocken, die auf eine dehydrierte Kopfhaut hindeuten.",
  gereizt:
    " Dazu kommt eine gereizte Kopfhaut — Jucken, Rötungen oder Brennen brauchen besondere Aufmerksamkeit.",
}

// --- Aha-Moment fallback ---
export const ahaFallback: Record<string, string> = {
  stretches_bounces:
    "Deine Balance stimmt \u2013 aber mit der richtigen Reihenfolge (Shampoo, Maske, dann Conditioner) holst du noch deutlich mehr raus.",
  stretches_stays:
    "Wahrscheinlich gibst du deinen Haaren gerade vor allem Feuchtigkeit. Aber dein Zugtest zeigt: Dir fehlt Protein. Deshalb fühlen sich deine Haare nie richtig stabil an.",
  snaps:
    "Wahrscheinlich setzt du auf Repair-Produkte. Aber dein Zugtest zeigt: Dir fehlt Feuchtigkeit und Fett. Deshalb werden sie immer spröder statt weicher.",
}

// --- Share quote fallback (for OG card) ---
export const shareQuoteFallback: Record<string, string> = {
  stretches_bounces: "Deine Balance stimmt — jetzt fehlt nur die richtige Routine.",
  stretches_stays: "Deinen Haaren fehlt Protein. Das ändert alles.",
  snaps: "Deine Haare schreien nach Feuchtigkeit, nicht nach Repair.",
}

// --- Hope text (always the same) ---
export const hopeText =
  "Das Gute: Deine Haare sind nicht hoffnungslos. Sie brauchen die richtige Reihenfolge aus Reinigung, Pflege und Schutz. Im nächsten Schritt schärfen wir noch deine Ziele und deine Wunsch-Routine."
