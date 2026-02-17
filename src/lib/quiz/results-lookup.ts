import type { QuizAnswers } from "./types"

// --- Card 1: Haartyp (composite label) ---
const structureLabels: Record<string, string> = {
  glatt: "glatte",
  wellig: "wellige",
  lockig: "lockige",
  kraus: "krause",
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

// --- Card 2: Haarstaerke ---
export const thicknessResults: Record<string, string> = {
  fine: "Fein \u2013 braucht leichte, waessrige Produkte. Dicke Cremes druecken feine Haare platt, weil der Haardurchmesser zu gering ist.",
  normal: "Mittel \u2013 gute Basis. Du kannst sowohl leichtere als auch reichhaltigere Produkte nutzen.",
  coarse: "Dick \u2013 vertraegt reichhaltige Pflege mit hohem Oelanteil. Dickere Haare brauchen mehr Fett und Inhaltsstoffe.",
}

// --- Card 3: Oberflaeche ---
export const surfaceResults: Record<string, string> = {
  glatt: "Deine Schuppenschicht ist intakt \u2013 die aeussere Haarschicht liegt glatt an. Beste Voraussetzung fuer Glanz.",
  leicht_uneben: "Deine Schuppenschicht ist leicht aufgeraut. Ein guter Conditioner gleicht das aus.",
  rau: "Deine Schuppenschicht ist deutlich geschaedigt. Du brauchst einen dichteren Conditioner und ein gutes Leave-in.",
}

// --- Card 4: Protein vs. Feuchtigkeit ---
export const pullTestResults: Record<string, string> = {
  elastisch:
    "Dein Zugtest zeigt: Dein Haar dehnt sich und federt zurueck \u2013 die Balance stimmt. Du brauchst gute Basispflege, keinen speziellen Repair-Conditioner.",
  ueberdehnt:
    "Dein Zugtest zeigt: Deine Haare sind ueberdehnt und gehen nicht zurueck. Das Protein hat nicht mehr genug Spannkraft. Du brauchst einen Protein-Conditioner als Hauptprodukt.",
  bricht:
    "Dein Zugtest zeigt: Deine Haare reissen bei leichtem Zug sofort. Sie brauchen dringend Feuchtigkeit \u2013 Fettalkohole, Glycerin und feuchtigkeitsbindende Inhaltsstoffe.",
}

// --- Card 5: Kopfhaut (type + condition) ---
export const scalpTypeResults: Record<string, string> = {
  fettig: "Deine Kopfhaut fettet schnell — du brauchst ein klares, tiefenreinigendes Shampoo.",
  ausgeglichen: "Deine Kopfhaut ist ausgeglichen — keine speziellen Massnahmen beim Shampoo noetig.",
  trocken: "Deine Kopfhaut ist dehydriert. Du brauchst ein mildes Shampoo und evtl. ein Serum mit Niacinamid und Ceramiden.",
}

export const scalpConditionResults: Record<string, string> = {
  keine: "",
  schuppen: " Dazu kommen Schuppen — weisse oder gelbliche Flocken, die auf ein Ungleichgewicht hindeuten.",
  gereizt: " Dazu kommt eine gereizte Kopfhaut — Jucken, Roetungen oder Brennen brauchen besondere Aufmerksamkeit.",
}

// --- Card 6: Ziele (display labels) ---
export const goalLabels: Record<string, string> = {
  spliss: "Spliss / Haarbruch",
  frizz: "Frizz / fliegende Haare",
  kein_volumen: "Kein Volumen",
  zu_viel_volumen: "Zu viel Volumen",
  glanzlos: "Glanzlos",
  kopfhaut: "Kopfhautprobleme",
  haarausfall: "Haarausfall / Ausduennen",
}

// --- Aha-Moment fallback ---
export const ahaFallback: Record<string, string> = {
  elastisch:
    "Deine Balance stimmt \u2013 aber mit der richtigen Reihenfolge (Shampoo, Maske, dann Conditioner) holst du noch deutlich mehr raus.",
  ueberdehnt:
    "Wahrscheinlich gibst du deinen Haaren gerade vor allem Feuchtigkeit. Aber dein Zugtest zeigt: Dir fehlt Protein. Deshalb fuehlen sich deine Haare nie richtig stabil an.",
  bricht:
    "Wahrscheinlich setzt du auf Repair-Produkte. Aber dein Zugtest zeigt: Dir fehlt Feuchtigkeit und Fett. Deshalb werden sie immer sproeder statt weicher.",
}

// --- Hope text (always the same) ---
export const hopeText =
  "Das Gute: Deine Haare sind nicht hoffnungslos. Sie brauchen nur die richtige Reihenfolge aus Reinigung, Pflege und Schutz. Genau das baut TomBot jetzt fuer dich."
