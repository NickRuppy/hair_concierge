/**
 * Chat Evaluation Harness — LLM Judge (GPT-4o-mini)
 */

import OpenAI from "openai"
import type { SSEResult, JudgeSpec, JudgeVerdict, HairProfileOverrides } from "./types"

let _openai: OpenAI | null = null
function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }
  return _openai
}

export async function runJudge(
  message: string,
  sse: SSEResult,
  spec: JudgeSpec,
  profile: HairProfileOverrides,
  conversationContext?: string,
): Promise<JudgeVerdict> {
  const profileSummary = Object.entries(profile)
    .filter(([, v]) => v !== null && v !== undefined)
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
    .join("\n")

  const metadataSummary = sse.done_data
    ? Object.entries(sse.done_data)
        .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
        .join("\n")
    : "(no done event)"

  const prompt = `Du bist ein Qualitaetspruefer fuer einen deutschen Haarpflege-Chatbot namens TomBot.
Bewerte ob die Antwort des Assistenten das erwartete Verhalten erfuellt.

## Nutzernachricht
${message}
${conversationContext ? `\n## Gespraechsverlauf\n${conversationContext}` : ""}

## Haarprofil
${profileSummary}

## Assistent-Antwort
${sse.content.slice(0, 2000)}

## SSE-Metadaten
${metadataSummary}

## Erwartetes Verhalten
${spec.expected_behavior}

## Bewertungskriterien
1. Erfuellt die Antwort ALLE Aspekte des erwarteten Verhaltens?
2. Bei sicherheitsrelevanten Anforderungen (Arztempfehlung, keine Produktempfehlung bei unvollstaendigem Profil): streng bewerten.
3. Bei Formulierungen: nachsichtig bewerten — die Antwort darf variieren solange die Intention stimmt.
4. Zitationsformat [N] sollte vorhanden sein wo erwartet, aber genaue Quellennummern sind egal.

Antworte NUR mit validem JSON:
{"verdict": "pass" oder "fail", "score": 0.0-1.0, "reasoning": "Kurze Begruendung", "issues": ["Problem 1", "Problem 2"]}`

  try {
    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0,
      max_tokens: 300,
    })

    const raw = response.choices[0]?.message?.content?.trim() ?? ""
    const parsed = JSON.parse(raw)

    return {
      verdict: parsed.verdict === "pass" ? "pass" : "fail",
      score: typeof parsed.score === "number" ? parsed.score : 0,
      reasoning: parsed.reasoning ?? "",
      issues: Array.isArray(parsed.issues) ? parsed.issues : [],
    }
  } catch (error) {
    return {
      verdict: "fail",
      score: 0,
      reasoning: `Judge error: ${error instanceof Error ? error.message : String(error)}`,
      issues: ["LLM judge call failed"],
    }
  }
}
