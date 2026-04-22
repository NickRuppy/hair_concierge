export interface QuizResultCta {
  lead: string
  label: string
  subline: string
}

export function getQuizResultCta({
  canGoStraightToRoutine,
}: {
  canGoStraightToRoutine: boolean
}): QuizResultCta {
  if (canGoStraightToRoutine) {
    return {
      lead: "Als Nächstes: dein persönlicher Plan",
      label: "MEINE ROUTINE STARTEN",
      subline: "Mit passenden Produkten, Reihenfolge und Anwendung.",
    }
  }

  return {
    lead: "Als Nächstes: Profil speichern & Plan freischalten",
    label: "PLAN FREISCHALTEN",
    subline:
      "Noch 3 kurze Schritte, dann legen wir Produkte, Reihenfolge und Anwendung für dich fest.",
  }
}
