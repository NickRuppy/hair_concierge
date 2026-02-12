import { getOpenAI } from "@/lib/openai/client"

const VISION_ANALYSIS_PROMPT = `Du bist eine erfahrene Haar-Expertin und analysierst das folgende Bild.

Bitte analysiere das Haar im Bild und beschreibe folgende Aspekte so detailliert wie moeglich:

1. **Haartyp**: Glatt, wellig, lockig oder kraus
2. **Haartextur**: Fein, mittel oder dick
3. **Haarzustand**: Gesund, trocken, geschaedigt, bruechig etc.
4. **Haarfarbe**: Natuerlich oder gefaerbt, welche Farbe/Nuancen
5. **Sichtbare Probleme**: Spliss, Frizz, Haarbruch, trockene Kopfhaut, Schuppen, duennes Haar etc.
6. **Laenge und Schnitt**: Kurz, mittel, lang; Stufenschnitt, Pony etc.
7. **Styling-Zustand**: Frisch gewaschen, gestylt, natuerlich, Hitzeschaeden sichtbar etc.

Gib deine Analyse auf Deutsch in einem strukturierten Format zurueck. Sei ehrlich aber einfuehlsam in deiner Bewertung.`

/**
 * Analyzes a hair image using GPT-4o vision capabilities.
 *
 * @param imageUrl - The URL of the image to analyze (public URL or base64 data URI)
 * @param userContext - Optional additional context from the user about their hair
 * @returns The analysis text in German
 */
export async function analyzeImage(
  imageUrl: string,
  userContext?: string
): Promise<string> {
  const userPrompt = userContext
    ? `${VISION_ANALYSIS_PROMPT}\n\nZusaetzlicher Kontext vom Nutzer: ${userContext}`
    : VISION_ANALYSIS_PROMPT

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: userPrompt,
          },
          {
            type: "image_url",
            image_url: {
              url: imageUrl,
              detail: "high",
            },
          },
        ],
      },
    ],
    max_tokens: 1000,
  })

  const content = response.choices[0]?.message?.content
  if (!content) {
    throw new Error("No analysis returned from vision model")
  }

  return content
}
