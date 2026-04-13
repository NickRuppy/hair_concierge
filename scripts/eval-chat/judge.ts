/**
 * Chat Evaluation Harness — LLM Judge (GPT-4o-mini)
 */

import OpenAI from "openai"
import type {
  SSEResult,
  JudgeSpec,
  JudgeVerdict,
  HairProfileOverrides,
  QualityRubricResult,
} from "./types"

let _openai: OpenAI | null = null
function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }
  return _openai
}

async function runJsonJudge<T>(prompt: string, fallback: T): Promise<T> {
  try {
    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0,
      max_tokens: 500,
    })

    const raw = response.choices[0]?.message?.content?.trim() ?? ""
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
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

  const prompt = `Du bist ein Qualitaetspruefer fuer einen deutschen Haarpflege-Chatbot namens Hair Concierge.
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

  const parsed = await runJsonJudge<Partial<JudgeVerdict>>(prompt, {
    verdict: "fail",
    score: 0,
    reasoning: "Judge error",
    issues: ["LLM judge call failed"],
  })

  return {
    verdict: parsed.verdict === "pass" ? "pass" : "fail",
    score: typeof parsed.score === "number" ? parsed.score : 0,
    reasoning: parsed.reasoning ?? "",
    issues: Array.isArray(parsed.issues) ? parsed.issues : [],
  }
}

function clampScore(value: unknown, defaultValue = 0): number {
  if (typeof value !== "number" || Number.isNaN(value)) return defaultValue
  return Math.max(0, Math.min(1, value))
}

export async function runQualityRubric(
  message: string,
  sse: SSEResult,
  profile: HairProfileOverrides,
  conversationContext?: string,
): Promise<QualityRubricResult> {
  const profileSummary = Object.entries(profile)
    .filter(([, v]) => v !== null && v !== undefined)
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
    .join("\n")

  const metadataSummary = sse.done_data
    ? Object.entries(sse.done_data)
        .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
        .join("\n")
    : "(no done event)"

  const prompt = `Du bist ein strenger Qualitaetspruefer fuer den deutschen Haarpflege-Chatbot Hair Concierge.
Bewerte die Antwort entlang eines festen Rubrik-Schemas und antworte NUR mit validem JSON.

## Nutzernachricht
${message}
${conversationContext ? `\n## Gespraechsverlauf\n${conversationContext}` : ""}

## Haarprofil
${profileSummary}

## Assistent-Antwort
${sse.content.slice(0, 3000)}

## Router- und SSE-Metadaten
${metadataSummary}

## Rubrik
- groundedness: 0.0-1.0. Wie gut ist die Antwort an vorhandenen Kontext, Quellen und bekannte Profildaten gebunden?
- recommendation_relevance: 0.0-1.0. Wie gut passt die Empfehlung oder Beratung zur Nutzerfrage und zum Profil?
- clarification_quality: 0.0-1.0. Wenn Rueckfragen noetig waeren: wie gut wurden sie gestellt? Wenn keine Rueckfragen noetig sind: war die Antwort passend direkt und nicht unnoetig ausweichend?
- overclaim_risk: 0.0-1.0. 0.0 = praktisch kein Risiko fuer ueberzogene oder ungestuetzte Behauptungen. 1.0 = hohes Risiko fuer Overclaiming.
- overall_quality: 0.0-1.0. Gesamteindruck unter Beruecksichtigung aller Faktoren.

Antworte NUR mit JSON:
{"groundedness":0.0,"recommendation_relevance":0.0,"clarification_quality":0.0,"overclaim_risk":0.0,"overall_quality":0.0,"summary":"kurz","issues":["issue 1"]}`

  const parsed = await runJsonJudge<Partial<QualityRubricResult>>(prompt, {
    groundedness: 0,
    recommendation_relevance: 0,
    clarification_quality: 0,
    overclaim_risk: 1,
    overall_quality: 0,
    summary: "Judge error",
    issues: ["LLM rubric judge failed"],
  })

  return {
    groundedness: clampScore(parsed.groundedness),
    recommendation_relevance: clampScore(parsed.recommendation_relevance),
    clarification_quality: clampScore(parsed.clarification_quality),
    overclaim_risk: clampScore(parsed.overclaim_risk, 1),
    overall_quality: clampScore(parsed.overall_quality),
    summary: parsed.summary ?? "",
    issues: Array.isArray(parsed.issues) ? parsed.issues : [],
  }
}
