import assert from "node:assert/strict"
import test from "node:test"

import { buildQuizResultArtifactEmailPayload } from "../src/lib/customerio/quiz-result-artifact"
import { buildQuizOfferPreview, deriveOfferPreviewNeedProfile } from "../src/lib/quiz/offer-preview"
import { resolveQuizNeed } from "../src/lib/quiz/need-lane"
import { buildQuizResultNarrative } from "../src/lib/quiz/result-narrative"
import type { QuizAnswers } from "../src/lib/quiz/types"

const PROFILES = {
  surface: {
    structure: "wavy",
    thickness: "normal",
    density: "medium",
    fingertest: "rau",
    pulltest: "stretches_bounces",
    scalp_type: "ausgeglichen",
    has_scalp_issue: false,
    concerns: ["frizz"],
    treatment: ["natur"],
    goals: ["less_frizz"],
  },
  severeTreatedDamage: {
    structure: "wavy",
    thickness: "normal",
    density: "medium",
    fingertest: "rau",
    pulltest: "stretches_stays",
    scalp_type: "ausgeglichen",
    has_scalp_issue: false,
    concerns: ["breakage", "hair_damage"],
    treatment: ["blondiert"],
    goals: ["anti_breakage", "healthier_hair"],
  },
  scalp: {
    structure: "straight",
    thickness: "fine",
    density: "low",
    fingertest: "glatt",
    pulltest: "stretches_bounces",
    scalp_type: "fettig",
    scalp_condition: "schuppen",
    has_scalp_issue: true,
    concerns: [],
    treatment: ["natur"],
    goals: ["healthy_scalp"],
  },
  neutral: {
    structure: "straight",
    thickness: "fine",
    density: "low",
    fingertest: "glatt",
    pulltest: "stretches_bounces",
    scalp_type: "ausgeglichen",
    has_scalp_issue: false,
    concerns: [],
    treatment: ["gefaerbt"],
    goals: ["color_protection"],
  },
} satisfies Record<string, QuizAnswers>

function stablePreview(answers: QuizAnswers) {
  const preview = buildQuizOfferPreview(answers)
  return {
    lane: preview.lane,
    headline: preview.headline,
    summary: preview.summary,
    signals: preview.signals,
    needs: preview.needs,
    // Image locations are catalog assets, not a guided-story behavior contract.
    products: preview.products.map(({ imageUrl: _imageUrl, ...product }) => product),
  }
}

test("legacy guided-story output locks retain all four representative profile contracts", () => {
  const actual = Object.fromEntries(
    Object.entries(PROFILES).map(([name, answers]) => [
      name,
      {
        needs: deriveOfferPreviewNeedProfile(answers),
        preview: stablePreview(answers),
        resolution: resolveQuizNeed(answers),
        narrative: buildQuizResultNarrative(answers),
      },
    ]),
  )

  assert.deepEqual(actual, {
    surface: {
      needs: {
        shampoo: {
          scalpRoute: "balanced",
          thickness: "normal",
          cleansingIntensity: "regular",
          cadence: { label: "2x/Woche", qualifier: "Startpunkt aus deinem Quiz" },
        },
        conditioner: {
          weight: "medium",
          balance: "balanced",
          cadence: { label: "Bei jeder Haarwäsche", qualifier: "2x/Woche" },
        },
        extra: {
          category: "leave_in",
          cadence: { label: "Nach jeder Haarwäsche" },
          variant: "general",
        },
      },
      preview: {
        lane: "surface_support",
        headline: "Deine Längen brauchen Schutz, der zwischen den Wäschen bleibt.",
        summary:
          "Ein Leave-in ergänzt die Pflegebasis, ohne daraus eine unnötig lange Routine zu machen.",
        signals: [
          {
            label: "Ausgeglichene Kopfhaut",
            conclusion: "Eine ausgewogene Reinigung reicht als Basis. 2x/Woche.",
          },
          {
            label: "Mittlere Haarstärke",
            conclusion: "Ein ausgewogener Conditioner ist der passende Ausgangspunkt.",
          },
          {
            label: "Oberfläche und Längen",
            conclusion: "Ein Leave-in hält Schutz und Geschmeidigkeit zwischen den Wäschen.",
          },
        ],
        needs: {
          shampoo: {
            scalpRoute: "balanced",
            thickness: "normal",
            cleansingIntensity: "regular",
            cadence: { label: "2x/Woche", qualifier: "Startpunkt aus deinem Quiz" },
          },
          conditioner: {
            weight: "medium",
            balance: "balanced",
            cadence: { label: "Bei jeder Haarwäsche", qualifier: "2x/Woche" },
          },
          extra: {
            category: "leave_in",
            cadence: { label: "Nach jeder Haarwäsche" },
            variant: "general",
          },
        },
        products: [
          {
            key: "sh-balanced-normal-dry-fine",
            category: "shampoo",
            categoryLabel: "Shampoo · Beispiel",
            name: "Neqi Moisture Mystery",
            note: "Ein mildes Beispiel, passend zur abgeleiteten Reinigungsrichtung.",
            cadence: { label: "2x/Woche", qualifier: "Startpunkt aus deinem Quiz" },
            suggested: false,
          },
          {
            key: "co-normal-balanced",
            category: "conditioner",
            categoryLabel: "Conditioner · Beispiel",
            name: "Langhaarmädchen Lovely Long Conditioner",
            note: "Ausgewogene Pflege mit mittlerem Gewicht als Beispiel.",
            cadence: { label: "Bei jeder Haarwäsche", qualifier: "2x/Woche" },
            suggested: false,
          },
          {
            key: "extra-leave-in",
            category: "leave_in",
            categoryLabel: "Leave-in · Vorschlag",
            name: "Isana Feuchtigkeits Leave-In (Hyaluron)",
            note: "Leichter Schutz und bessere Kämmbarkeit nach der Wäsche.",
            cadence: { label: "Nach jeder Haarwäsche" },
            suggested: true,
          },
        ],
      },
      resolution: {
        primaryConcern: "frizz",
        primaryGoal: "less_frizz",
        chemicalStress: "none",
        lane: "surface_support",
      },
      narrative: {
        heroHeadline: "Die passende Pflege kann deine Längen spürbar ruhiger machen.",
        intro:
          "Du hast gesagt, dass dich vor allem Frizz stört und dass du dir ruhigeres, geschmeidigeres Haar wünschst.",
        rows: [
          {
            label: "Haargefühl",
            scope: "LÄNGEN",
            before: "stumpf & unruhig",
            after: "ruhig & geordnet",
            iconKey: "sparkles",
            tickBefore: "unruhig",
            tickAfter: "glänzend",
            currentPosition: 66,
            targetPosition: 78,
          },
          {
            label: "Was dich gerade ausbremst",
            scope: "LÄNGEN",
            before: "Frizz",
            after: "ruhigere, glattere Längen",
            iconKey: "sparkles",
            tickBefore: "unruhig",
            tickAfter: "glatt",
            currentPosition: 66,
            targetPosition: 84,
          },
          {
            label: "Worauf wir hinarbeiten",
            scope: "LÄNGEN",
            before: "wenig Kontrolle",
            after: "mehr Geschmeidigkeit & Kontrolle",
            iconKey: "sparkles",
            tickBefore: "unruhig",
            tickAfter: "kontrolliert",
            currentPosition: 50,
            targetPosition: 88,
          },
        ],
        needs: {
          title: "Was dein Haar jetzt braucht",
          mainLeverTitle: "Mehr Schutz für Oberfläche und Längen aufbauen",
          mainLeverWhy:
            "Wenn die Oberfläche aufraut, fallen die Längen schneller unruhig und lassen sich schwerer kontrollieren.",
          mainLeverProducts:
            "Am meisten erreichen wir hier mit einem passenden Conditioner; zusätzlich kann ein Leave-in helfen, die Längen zwischen den Wäschen ruhiger zu halten.",
          products: [
            { name: "Conditioner", description: "Stabilisiert die Oberfläche der Längen." },
            { name: "Leave-in", description: "Hält die Wirkung zwischen den Wäschen." },
          ],
        },
        cta: {
          lead: "Als Nächstes: dein persönlicher Plan",
          label: "MEINE ROUTINE STARTEN",
          subline: "Mit passenden Produkten, Reihenfolge und Anwendung.",
        },
        primaryConcern: "frizz",
        primaryGoal: "less_frizz",
      },
    },
    severeTreatedDamage: {
      needs: {
        shampoo: {
          scalpRoute: "balanced",
          thickness: "normal",
          cleansingIntensity: "regular",
          cadence: { label: "2x/Woche", qualifier: "Startpunkt aus deinem Quiz" },
        },
        conditioner: {
          weight: "medium",
          balance: "protein",
          cadence: { label: "Bei jeder Haarwäsche", qualifier: "2x/Woche" },
        },
        extra: {
          category: "bondbuilder",
          cadence: { label: "Nach Produktprotokoll", qualifier: "wird im finalen Plan festgelegt" },
        },
      },
      preview: {
        lane: "bond_repair",
        headline: "Deine Längen brauchen gezielteren Struktur-Schutz.",
        summary:
          "Neben Shampoo und Conditioner ist ein Bondbuilder der plausibelste zusätzliche Fokus.",
        signals: [
          {
            label: "Ausgeglichene Kopfhaut",
            conclusion: "Eine ausgewogene Reinigung reicht als Basis. 2x/Woche.",
          },
          {
            label: "Mittlere Haarstärke",
            conclusion: "Ein Conditioner mit Protein-Fokus ist der passende Ausgangspunkt.",
          },
          {
            label: "Mehrere Struktur-Signale",
            conclusion: "Ein Bondbuilder ist als zusätzlicher Fokus plausibel.",
          },
        ],
        needs: {
          shampoo: {
            scalpRoute: "balanced",
            thickness: "normal",
            cleansingIntensity: "regular",
            cadence: { label: "2x/Woche", qualifier: "Startpunkt aus deinem Quiz" },
          },
          conditioner: {
            weight: "medium",
            balance: "protein",
            cadence: { label: "Bei jeder Haarwäsche", qualifier: "2x/Woche" },
          },
          extra: {
            category: "bondbuilder",
            cadence: {
              label: "Nach Produktprotokoll",
              qualifier: "wird im finalen Plan festgelegt",
            },
          },
        },
        products: [
          {
            key: "sh-balanced-normal-dry-fine",
            category: "shampoo",
            categoryLabel: "Shampoo · Beispiel",
            name: "Neqi Moisture Mystery",
            note: "Ein mildes Beispiel, passend zur abgeleiteten Reinigungsrichtung.",
            cadence: { label: "2x/Woche", qualifier: "Startpunkt aus deinem Quiz" },
            suggested: false,
          },
          {
            key: "co-normal-protein",
            category: "conditioner",
            categoryLabel: "Conditioner · Beispiel",
            name: "Neqi Repair Reveal Conditioner",
            note: "Struktur-Fokus mit mittlerem Pflegegewicht als Beispiel.",
            cadence: { label: "Bei jeder Haarwäsche", qualifier: "2x/Woche" },
            suggested: false,
          },
          {
            key: "extra-bondbuilder",
            category: "bondbuilder",
            categoryLabel: "Bondbuilder · Vorschlag",
            name: "OLAPLEX No.3PLUS Complete Repair Treatment",
            note: "Intensiver Zusatzschritt vor der Haarwäsche; Rhythmus folgt dem Produktprotokoll.",
            cadence: {
              label: "Nach Produktprotokoll",
              qualifier: "wird im finalen Plan festgelegt",
            },
            suggested: true,
          },
        ],
      },
      resolution: {
        primaryConcern: "breakage",
        primaryGoal: "anti_breakage",
        chemicalStress: "high",
        lane: "bond_repair",
      },
      narrative: {
        heroHeadline: "Deine Längen brauchen gezielteren Schutz.",
        intro:
          "Du hast gesagt, dass dich vor allem Haarbruch stört und dass du dir unter anderem widerstandsfähigere, geschützte Längen wünschst.",
        rows: [
          {
            label: "Haargefühl",
            scope: "HAAR",
            before: "strapazierte Längen",
            after: "spürbar fester",
            iconKey: "shield",
            tickBefore: "strapaziert",
            tickAfter: "geschützt",
            currentPosition: 82,
            targetPosition: 78,
          },
          {
            label: "Was dich gerade ausbremst",
            scope: "HAAR",
            before: "Haarbruch",
            after: "stabilere, geschütztere Längen",
            iconKey: "shield-check",
            tickBefore: "instabil",
            tickAfter: "geschützt",
            currentPosition: 82,
            targetPosition: 84,
          },
          {
            label: "Worauf wir hinarbeiten",
            scope: "HAAR",
            before: "wenig Stabilität",
            after: "mehr Spannkraft & Widerstandskraft",
            iconKey: "shield-check",
            tickBefore: "instabil",
            tickAfter: "stabil",
            currentPosition: 50,
            targetPosition: 88,
          },
        ],
        needs: {
          title: "Was dein Haar jetzt braucht",
          mainLeverTitle: "Mehr Stabilität in die Längen bringen",
          mainLeverWhy:
            "Wenn die Längen geschwächt sind, geben sie schneller nach und Spliss oder Haarbruch werden leichter weiter begünstigt.",
          mainLeverProducts:
            "Am meisten erreichen wir hier mit einem Bondbuilder; zusätzlich kann eine stärkende Maske helfen, die Längen belastbarer zu halten.",
          products: [
            { name: "Bondbuilder", description: "Stabilisiert die Längen von innen." },
            { name: "Stärkende Maske", description: "Macht die Längen wieder belastbar." },
          ],
        },
        cta: {
          lead: "Als Nächstes: dein persönlicher Plan",
          label: "MEINE ROUTINE STARTEN",
          subline: "Mit passenden Produkten, Reihenfolge und Anwendung.",
        },
        primaryConcern: "breakage",
        primaryGoal: "anti_breakage",
      },
    },
    scalp: {
      needs: {
        shampoo: {
          scalpRoute: "dandruff",
          thickness: "fine",
          cleansingIntensity: "regular",
          cadence: { label: "3-4x/Woche", qualifier: "Startpunkt aus deinem Quiz" },
        },
        conditioner: {
          weight: "light",
          balance: "balanced",
          cadence: { label: "Bei jeder Haarwäsche", qualifier: "3-4x/Woche" },
        },
        extra: null,
      },
      preview: {
        lane: "scalp_focus",
        headline: "Deine Pflegebasis beginnt bei der Kopfhaut.",
        summary:
          "Das passende Shampoo übernimmt den Fokus; die Längen bekommen eine abgestimmte Basispflege.",
        signals: [
          {
            label: "Kopfhaut mit Schuppen",
            conclusion: "Das Shampoo übernimmt den Kopfhaut-Fokus. 3-4x/Woche.",
          },
          {
            label: "Feine Haarstärke",
            conclusion: "Ein ausgewogener Conditioner ist der passende Ausgangspunkt.",
          },
          {
            label: "Kopfhaut-Fokus",
            conclusion: "Kein pauschales Serum: der Fokus bleibt beim passenden Shampoo.",
          },
        ],
        needs: {
          shampoo: {
            scalpRoute: "dandruff",
            thickness: "fine",
            cleansingIntensity: "regular",
            cadence: { label: "3-4x/Woche", qualifier: "Startpunkt aus deinem Quiz" },
          },
          conditioner: {
            weight: "light",
            balance: "balanced",
            cadence: { label: "Bei jeder Haarwäsche", qualifier: "3-4x/Woche" },
          },
          extra: null,
        },
        products: [
          {
            key: "sh-dandruff-fine-coarse",
            category: "shampoo",
            categoryLabel: "Shampoo · Beispiel",
            name: "Head & Shoulders DERMAXPRO Beruhigende Pflege",
            note: "Kopfhaut-Fokus bei Schuppen; die finale Anwendung klärt Chaarlie mit dir.",
            cadence: { label: "3-4x/Woche", qualifier: "Startpunkt aus deinem Quiz" },
            suggested: false,
          },
          {
            key: "co-fine-balanced",
            category: "conditioner",
            categoryLabel: "Conditioner · Beispiel",
            name: "Neqi Volume Victory Conditioner",
            note: "Leichte, ausgewogene Pflege als Beispiel für feines Haar.",
            cadence: { label: "Bei jeder Haarwäsche", qualifier: "3-4x/Woche" },
            suggested: false,
          },
        ],
      },
      resolution: {
        primaryConcern: null,
        primaryGoal: "healthy_scalp",
        chemicalStress: "none",
        lane: "scalp_focus",
      },
      narrative: {
        heroHeadline: "Eine passende Pflegebasis beginnt bei deiner Kopfhaut.",
        intro:
          "Du hast gesagt, dass du dir eine ruhigere, ausgeglichenere Kopfhaut wünschst und wir sehen schon, was dein Haar gerade noch ausbremst.",
        rows: [
          {
            label: "Haargefühl",
            scope: "KOPFHAUT",
            before: "fettig",
            after: "ruhiger",
            iconKey: "droplet",
            tickBefore: "unausgeglichen",
            tickAfter: "ausgeglichen",
            currentPosition: 66,
            targetPosition: 78,
          },
          {
            label: "Was dich gerade ausbremst",
            scope: "KOPFHAUT",
            before: "Schuppen",
            after: "mehr Ruhe",
            iconKey: "leaf",
            tickBefore: "unruhig",
            tickAfter: "ausgeglichen",
            currentPosition: 66,
            targetPosition: 84,
          },
          {
            label: "Worauf wir hinarbeiten",
            scope: "KOPFHAUT",
            before: "wenig Ruhe",
            after: "mehr Ruhe & Ausgeglichenheit",
            iconKey: "leaf",
            tickBefore: "unruhig",
            tickAfter: "beruhigt",
            currentPosition: 50,
            targetPosition: 88,
          },
        ],
        needs: {
          title: "Was dein Haar jetzt braucht",
          mainLeverTitle: "Die Kopfhaut gezielter ausgleichen",
          mainLeverWhy:
            "Wenn die Kopfhaut aus dem Gleichgewicht ist, bleibt sie leichter gereizt und Schuppen kommen schneller wieder.",
          mainLeverProducts:
            "Am meisten erreichen wir hier mit einem passenden Anti-Schuppen-Shampoo; ein Conditioner pflegt die Längen passend dazu, ohne eine weitere Kopfhautbehandlung zu versprechen.",
          products: [
            {
              name: "Anti-Schuppen-Shampoo",
              description: "Reguliert die Kopfhaut bei jeder Wäsche.",
            },
            {
              name: "Passender Conditioner",
              description: "Pflegt die Längen passend zur Haarwäsche.",
            },
          ],
        },
        cta: {
          lead: "Als Nächstes: dein persönlicher Plan",
          label: "MEINE ROUTINE STARTEN",
          subline: "Mit passenden Produkten, Reihenfolge und Anwendung.",
        },
        primaryConcern: null,
        primaryGoal: "healthy_scalp",
      },
    },
    neutral: {
      needs: {
        shampoo: {
          scalpRoute: "balanced",
          thickness: "fine",
          cleansingIntensity: "regular",
          cadence: { label: "2x/Woche", qualifier: "Startpunkt aus deinem Quiz" },
        },
        conditioner: {
          weight: "light",
          balance: "balanced",
          cadence: { label: "Bei jeder Haarwäsche", qualifier: "2x/Woche" },
        },
        extra: null,
      },
      preview: {
        lane: "base",
        headline: "Eine passende Pflegebasis ist für dich der sinnvollste Start.",
        summary:
          "Aus dem Quiz lassen sich Shampoo und Conditioner schon sinnvoll eingrenzen; alles Weitere klärt Chaarlie mit dir.",
        signals: [
          {
            label: "Ausgeglichene Kopfhaut",
            conclusion: "Eine ausgewogene Reinigung reicht als Basis. 2x/Woche.",
          },
          {
            label: "Feine Haarstärke",
            conclusion: "Ein ausgewogener Conditioner ist der passende Ausgangspunkt.",
          },
          {
            label: "Keine eindeutige Zusatzkategorie",
            conclusion:
              "Shampoo und Conditioner sind die sinnvolle Mini-Routine; Chaarlie klärt den Rest mit dir.",
          },
        ],
        needs: {
          shampoo: {
            scalpRoute: "balanced",
            thickness: "fine",
            cleansingIntensity: "regular",
            cadence: { label: "2x/Woche", qualifier: "Startpunkt aus deinem Quiz" },
          },
          conditioner: {
            weight: "light",
            balance: "balanced",
            cadence: { label: "Bei jeder Haarwäsche", qualifier: "2x/Woche" },
          },
          extra: null,
        },
        products: [
          {
            key: "sh-balanced-fine",
            category: "shampoo",
            categoryLabel: "Shampoo · Beispiel",
            name: "Balea Aqua Hyaluron",
            note: "Leichte, ausgewogene Reinigung für deine Pflegebasis.",
            cadence: { label: "2x/Woche", qualifier: "Startpunkt aus deinem Quiz" },
            suggested: false,
          },
          {
            key: "co-fine-balanced",
            category: "conditioner",
            categoryLabel: "Conditioner · Beispiel",
            name: "Neqi Volume Victory Conditioner",
            note: "Leichte, ausgewogene Pflege als Beispiel für feines Haar.",
            cadence: { label: "Bei jeder Haarwäsche", qualifier: "2x/Woche" },
            suggested: false,
          },
        ],
      },
      resolution: {
        primaryConcern: null,
        primaryGoal: "color_protection",
        chemicalStress: "moderate",
        lane: "base",
      },
      narrative: {
        heroHeadline: "Deine Balance ist näher dran, als es sich gerade anfühlt.",
        intro:
          "Du hast gesagt, dass du dir länger lebendige Farbe wünschst und wir sehen schon, was dein Haar gerade noch ausbremst.",
        rows: [
          {
            label: "Haargefühl",
            scope: "HAAR",
            before: "strapazierte Längen",
            after: "spürbar fester",
            iconKey: "shield",
            tickBefore: "strapaziert",
            tickAfter: "geschützt",
            currentPosition: 34,
            targetPosition: 78,
          },
          {
            label: "Was dich gerade ausbremst",
            scope: "LÄNGEN",
            before: "unpassende Pflege",
            after: "mehr Ruhe, Glanz & Ausgewogenheit",
            iconKey: "sparkles",
            tickBefore: "unstimmig",
            tickAfter: "passend",
            currentPosition: 34,
            targetPosition: 84,
          },
          {
            label: "Worauf wir hinarbeiten",
            scope: "HAAR",
            before: "wenig Schutz",
            after: "mehr Farbglanz & Schutz",
            iconKey: "palette",
            tickBefore: "verblasst",
            tickAfter: "lebendig",
            currentPosition: 34,
            targetPosition: 88,
          },
        ],
        needs: {
          title: "Was dein Haar jetzt braucht",
          mainLeverTitle: "Die Pflegebasis besser auf dein Haar abstimmen",
          mainLeverWhy:
            "Wenn die Pflegebasis besser passt, wirkt dein Haar insgesamt ruhiger und stimmiger.",
          mainLeverProducts:
            "Am meisten erreichen wir hier mit einem passenden Conditioner; zusätzlich kann ein leichtes Leave-in helfen, die Wirkung in den Längen zu halten.",
          products: [
            { name: "Conditioner", description: "Stimmt die Pflegebasis ab." },
            { name: "Leichtes Leave-in", description: "Hält die Wirkung in den Längen." },
          ],
        },
        cta: {
          lead: "Als Nächstes: dein persönlicher Plan",
          label: "MEINE ROUTINE STARTEN",
          subline: "Mit passenden Produkten, Reihenfolge und Anwendung.",
        },
        primaryConcern: null,
        primaryGoal: "color_protection",
      },
    },
  })
})

test("result email retains the legacy app-value-stack content and excludes free quiz text", () => {
  const payload = buildQuizResultArtifactEmailPayload({
    leadId: "legacy-regression-lead",
    name: "Lea Legacy",
    email: "lea@example.com",
    quizAnswers: { ...PROFILES.surface, concerns_other_text: "do not send" },
    siteUrl: "https://chaarlie.de",
  })

  assert.deepEqual(payload.messageData.app_stories, [
    {
      label: "Deine Routine",
      headline: "Deine Routine auf einen Blick.",
      body: "Produkte, Reihenfolge und Anwendung – klar an einem Ort.",
    },
    {
      label: "Dein Haar-Berater",
      headline: "Frag Chaarlie zu deinem Haar.",
      body: "Chaarlie kennt dein Haarprofil und hilft dir, wenn etwas unklar ist oder sich verändert.",
    },
    {
      label: "Deine Empfehlungen",
      headline: "Frag nach Produkten, die zu dir passen.",
      body: "Du bekommst Preis, Anwendung und eine verständliche Begründung direkt dazu.",
    },
  ])
  assert.deepEqual(
    {
      headline: payload.messageData.headline,
      intro: payload.messageData.intro,
      app_bridge_headline: payload.messageData.app_bridge_headline,
      app_bridge_body: payload.messageData.app_bridge_body,
      cta_label: payload.messageData.cta_label,
      result_url: payload.messageData.result_url,
    },
    {
      headline: "Lea, dein 4-Wochen-Weg zu mehr Geschmeidigkeit & Kontrolle.",
      intro:
        "Frizz ist dein wichtigster Pflegefokus. Deine Pflegebasis setzt deshalb auf Geschmeidigkeit und Schutz zwischen den Haarwäschen.",
      app_bridge_headline: "Deine Routine ist erst der Anfang.",
      app_bridge_body:
        "Chaarlie begleitet dich bei der Anwendung und passt deine Pflege mit dir an.",
      cta_label: "Mit Chaarlie starten",
      result_url:
        "https://chaarlie.de/result/legacy-regression-lead?focus=unlock-plan&entry=result_email",
    },
  )
  assert.equal("concerns_other_text" in payload.messageData, false)
  assert.doesNotMatch(JSON.stringify(payload.messageData), /do not send/)
})
