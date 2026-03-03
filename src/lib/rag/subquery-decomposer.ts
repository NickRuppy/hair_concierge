import { getOpenAI } from "@/lib/openai/client"
import { SUBQUERY_MIN_WORDS, SUBQUERY_MAX_COUNT } from "@/lib/rag/retrieval-constants"

/**
 * Decomposes a complex user query into 2-4 focused retrieval subqueries
 * using GPT-4o-mini. Handles German input natively.
 *
 * For short/simple queries (< SUBQUERY_MIN_WORDS words), returns the
 * original query as a single-element array (no LLM call).
 *
 * On any failure, falls back to original query as single subquery.
 *
 * Ref: PRD FR-3, Section 6
 */
export async function decomposeQuery(query: string): Promise<string[]> {
  const wordCount = query.trim().split(/\s+/).length
  if (wordCount < SUBQUERY_MIN_WORDS) {
    return [query]
  }

  try {
    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      max_tokens: 300,
      messages: [
        {
          role: "system",
          content: `Du bist ein Retrieval-Assistent. Zerlege die Nutzeranfrage in 2-${SUBQUERY_MAX_COUNT} fokussierte Suchqueries für eine Vektorsuche über eine Haarpflege-Wissensbasis.

Regeln:
- Jede Subquery soll einen eigenständigen Aspekt der Anfrage abdecken.
- Halte die Sprache der Originalanfrage bei (Deutsch oder Englisch).
- Wenn die Anfrage einfach genug für eine einzige Suche ist, gib nur eine Query zurück.
- INCI-Namen, Produktnamen und Fachbegriffe unverändert übernehmen.
- Antworte NUR mit einem JSON-Array von Strings, kein anderer Text.

Beispiel:
Input: "Ich habe feines, fettiges Haar und suche ein silikonfreies Shampoo gegen Schuppen"
Output: ["silikonfreies Shampoo feines Haar", "Schuppen fettige Kopfhaut Shampoo", "feines Haar Pflegeempfehlung"]`,
        },
        { role: "user", content: query },
      ],
    })

    const raw = response.choices[0]?.message?.content?.trim()
    if (!raw) return [query]

    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed) || parsed.length === 0) return [query]

    // Validate: only strings, cap at max count
    const subqueries = parsed
      .filter((q): q is string => typeof q === "string" && q.trim().length > 0)
      .slice(0, SUBQUERY_MAX_COUNT)

    return subqueries.length > 0 ? subqueries : [query]
  } catch (error) {
    console.error("Subquery decomposition failed, using original query:", error)
    return [query]
  }
}
