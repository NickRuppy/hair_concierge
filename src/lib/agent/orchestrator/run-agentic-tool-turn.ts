import type OpenAI from "openai"

import {
  AGENTIC_PRODUCT_CATEGORIES,
  type AgenticAnswerCompositionMode,
  type AgenticBlockedToolCall,
  type AgenticExecutedToolCall,
  type AgenticModelToolCall,
  type AgenticProductCategory,
  type AgenticTerminalAnswer,
  type AgenticToolLoopFailureStage,
  type AgenticToolLoopModelStep,
  type AgenticToolName,
  type AgenticToolTurnParams,
  type AgenticToolTurnResult,
} from "@/lib/agent/orchestrator/agentic-tool-loop-types"
import {
  buildAgenticAnswerContext,
  type AgenticAnswerContext,
} from "@/lib/agent/orchestrator/agentic-answer-context"
import {
  buildAgenticConsultationBrief,
  type AgenticConsultationBrief,
} from "@/lib/agent/orchestrator/agentic-consultation-brief"
import {
  buildCurrentTurnActiveProfileSignals,
  extractCurrentTurnContextOverlay,
  getCurrentTurnConflictContext,
  projectHairProfileForCurrentTurn,
  type CurrentTurnContextOverlay,
} from "@/lib/agent/orchestrator/current-turn-context"
import {
  AGENTIC_CONTEXTUAL_COMPOSER_PROMPT,
  AGENTIC_TOOL_LOOP_PROMPT,
} from "@/lib/agent/orchestrator/prompt"
import { buildAgenticToolDefinitions } from "@/lib/agent/orchestrator/tool-definitions"
import type { BuildOrFixRoutineProjection } from "@/lib/agent/tools/build-or-fix-routine"
import type { UserContextProjection } from "@/lib/agent/tools/get-user-context"
import {
  normalizeAdvisorGuidanceCategory,
  normalizeAdvisorGuidanceCategories,
  normalizeAdvisorGuidanceIntent,
  normalizeAdvisorProfileFocus,
  type AdvisorGuidanceProjection,
} from "@/lib/agent/tools/load-advisor-guidance"
import type { SelectedProductsProjection } from "@/lib/agent/tools/select-products"
import {
  normalizeConversationState,
  resolveAgenticConversationStateTransition,
} from "@/lib/chat-runtime/conversation-state"
import type { AgentActiveProfileSignal, AgentConcern } from "@/lib/agent/orchestrator/route-packet"
import type {
  ConversationState,
  ConversationStateTransition,
  RoutineConversationLayer,
} from "@/lib/types"

const VISIBLE_FAILURE_ANSWER =
  "Entschuldige, ich konnte deine Frage gerade nicht eindeutig genug einordnen. Formulier sie bitte noch einmal etwas konkreter, dann helfe ich dir direkt weiter."
const TERMINAL_PROTOCOL_REPAIR_INSTRUCTION =
  "Schliesse diesen Turn jetzt ausschliesslich mit submit_final_answer ab. Nutze die bereits geladenen Tool-Ergebnisse und erfinde keine neuen Produkt- oder Routinefakten. Rufe kein weiteres Tool auf."

const MAX_RECENT_MESSAGES = 8
const MAX_RECENT_MESSAGE_CHARS = 600
const MAX_RECENT_TOTAL_CHARS = 2400
const MAX_MEMORY_ENTRIES = 3
const MAX_MEMORY_CHARS = 120

const HARD_ANSWER_RULES = [
  "answer_current_delta_first",
  "avoid_full_restart",
  "preserve_selected_product_order",
  "ask_at_most_one_blocking_clarification",
  "do_not_expose_internal_labels",
] as const

const ALLOWED_TOOLS = new Set<AgenticToolName>([
  "load_advisor_guidance",
  "select_products",
  "build_or_fix_routine",
  "submit_final_answer",
])

const EXECUTABLE_TOOLS = new Set<AgenticToolName>([
  "load_advisor_guidance",
  "select_products",
  "build_or_fix_routine",
])

export async function runAgenticToolTurn(
  params: AgenticToolTurnParams,
): Promise<AgenticToolTurnResult> {
  const maxModelSteps = params.maxModelSteps ?? 4
  const maxExecutableToolCalls = params.maxExecutableToolCalls ?? 4
  const currentTurnContext = extractCurrentTurnContextOverlay({
    message: params.message,
    recentMessages: params.recentMessages,
    savedProfile: params.userContext.profile,
  })
  const priorExplanationCategory = getPriorRecommendationExplanationCategory({
    message: params.message,
    conversationState: params.conversationState,
  })
  const consultationBrief =
    params.consultationBrief === undefined
      ? await buildAgenticConsultationBrief({
          message: params.message,
          recentMessages: params.recentMessages,
          userContext: params.userContext,
          conversationState: params.conversationState,
        })
      : params.consultationBrief
  const modelMessages = buildInitialMessages(params, consultationBrief, currentTurnContext)
  const modelSteps: AgenticToolLoopModelStep[] = []
  const toolCalls: AgenticExecutedToolCall[] = []
  const blockedToolCalls: AgenticBlockedToolCall[] = []
  const repairAttempts: AgenticToolTurnResult["trace"]["repair_attempts"] = []
  const selectedCategories = new Set<AgenticProductCategory>()
  const guardrails: string[] = []
  let selectedProducts: SelectedProductsProjection | null = null
  let routinePlan: BuildOrFixRoutineProjection | null = null
  let advisorGuidance: AdvisorGuidanceProjection | null = null
  let answerContext: AgenticAnswerContext | null = null
  let terminalAnswer: AgenticTerminalAnswer | null = null
  let terminalFailureStage: Exclude<AgenticToolLoopFailureStage, null> | null = null

  for (let stepIndex = 0; stepIndex < maxModelSteps; stepIndex += 1) {
    const step = await params.modelClient.runStep({
      systemPrompt: AGENTIC_TOOL_LOOP_PROMPT,
      messages: modelMessages,
      tools: buildAgenticToolDefinitions({
        includeAdvisorGuidance: Boolean(params.tools.load_advisor_guidance),
      }),
    })
    modelSteps.push(step)

    if (step.type === "message") {
      if (stepIndex < maxModelSteps - 1) {
        modelMessages.push({
          role: "user",
          content:
            "Bitte schliesse den Turn mit submit_final_answer ab. Freitext ohne terminales Tool ist nicht gueltig.",
        })
        continue
      }

      guardrails.push("missing_terminal_answer")
      terminalFailureStage = "missing_terminal_answer"
      break
    }

    const terminalCalls = step.calls.filter((call) => call.name === "submit_final_answer")
    if (terminalCalls.length > 1) {
      for (const call of terminalCalls) {
        blockedToolCalls.push(blockToolCall(call, "multiple_terminal_answers"))
      }
      guardrails.push("multiple_terminal_answers")
      terminalFailureStage = "multiple_terminal_answers"
      break
    }

    const [terminalCall = null] = terminalCalls
    const hasMixedTerminalCall = Boolean(terminalCall && step.calls.length > 1)
    if (terminalCall && !hasMixedTerminalCall) {
      terminalAnswer = parseTerminalAnswer(terminalCall.input)
      if (!terminalAnswer) {
        return buildVisibleFailureResult({
          params,
          selectedProducts,
          routinePlan,
          advisorGuidance,
          answerContext,
          toolCalls,
          blockedToolCalls,
          guardrails,
          modelSteps,
          consultationBrief,
          answerCompositionMode: params.answerCompositionMode,
          repairAttempts,
          failureStage: "missing_terminal_answer",
        })
      }
      break
    }

    let executedAnyTool = false

    for (const call of step.calls) {
      if (call.name === "submit_final_answer") {
        blockedToolCalls.push(blockToolCall(call, "terminal_with_other_tool_calls"))
        guardrails.push("terminal_with_other_tool_calls")
        terminalFailureStage = "terminal_with_other_tool_calls"
        continue
      }

      if (!isAllowedToolName(call.name)) {
        blockedToolCalls.push(blockToolCall(call, "tool_not_allowed"))
        continue
      }

      if (!EXECUTABLE_TOOLS.has(call.name)) {
        blockedToolCalls.push(blockToolCall(call, "tool_not_allowed"))
        continue
      }

      if (toolCalls.length >= maxExecutableToolCalls) {
        blockedToolCalls.push(blockToolCall(call, "max_executable_tool_calls"))
        guardrails.push("max_executable_tool_calls")
        terminalFailureStage = "max_executable_tool_calls"
        break
      }

      if (call.name === "load_advisor_guidance") {
        if (priorExplanationCategory) {
          blockedToolCalls.push(
            blockToolCall(call, "prior_recommendation_explanation_requires_product_facts"),
          )
          guardrails.push("prior_recommendation_explanation_requires_product_facts")
          if (!selectedCategories.has(priorExplanationCategory)) {
            selectedCategories.add(priorExplanationCategory)
            const input = buildSelectProductsInput(
              { category: priorExplanationCategory, userJob: "product_pick" },
              priorExplanationCategory,
              params,
              currentTurnContext,
            )
            const output = await params.tools.select_products(input)
            selectedProducts = extractSelectedProductsProjection(output)
            const executedCall: AgenticExecutedToolCall = {
              id: `${call.id}-select-products`,
              name: "select_products",
              input,
              output,
            }
            toolCalls.push(executedCall)
            answerContext = buildCurrentAnswerContext({
              message: params.message,
              selectedProducts,
              routinePlan,
              toolCalls,
              conversationState: params.conversationState,
              mode: params.answerCompositionMode,
              currentTurnContext,
            })
            appendToolResultMessages(modelMessages, executedCall, input, output, {
              answerContext:
                params.answerCompositionMode === "inline_context" ? answerContext : null,
            })
            executedAnyTool = true
          }
          continue
        }
        if (!params.tools.load_advisor_guidance) {
          blockedToolCalls.push(blockToolCall(call, "tool_not_allowed"))
          continue
        }
        if (shouldBlockAdvisorGuidanceAfterProducts({ selectedProducts })) {
          blockedToolCalls.push(blockToolCall(call, "redundant_advisor_guidance_after_product"))
          guardrails.push("redundant_advisor_guidance_after_product")
          continue
        }
        const input = buildAdvisorGuidanceInput(call.input, params, currentTurnContext)
        const output = await params.tools.load_advisor_guidance(input)
        advisorGuidance = extractAdvisorGuidanceProjection(output)
        const executedCall: AgenticExecutedToolCall = {
          id: call.id,
          name: "load_advisor_guidance",
          input,
          output,
        }
        toolCalls.push(executedCall)
        answerContext = buildCurrentAnswerContext({
          message: params.message,
          selectedProducts,
          routinePlan,
          toolCalls,
          conversationState: params.conversationState,
          mode: params.answerCompositionMode,
          currentTurnContext,
        })
        appendToolResultMessages(modelMessages, call, input, output, {
          answerContext: params.answerCompositionMode === "inline_context" ? answerContext : null,
        })
        executedAnyTool = true
        continue
      }

      if (call.name === "select_products") {
        const category = parseAgenticProductCategory(call.input.category)
        if (!category) {
          blockedToolCalls.push(blockToolCall(call, "invalid_category"))
          continue
        }

        if (priorExplanationCategory && category !== priorExplanationCategory) {
          blockedToolCalls.push(blockToolCall(call, "conceptual_category_curiosity"))
          guardrails.push("prior_recommendation_explanation_requires_product_facts")
          if (!selectedCategories.has(priorExplanationCategory)) {
            selectedCategories.add(priorExplanationCategory)
            const input = buildSelectProductsInput(
              { category: priorExplanationCategory, userJob: "product_pick" },
              priorExplanationCategory,
              params,
              currentTurnContext,
            )
            const output = await params.tools.select_products(input)
            selectedProducts = extractSelectedProductsProjection(output)
            const executedCall: AgenticExecutedToolCall = {
              id: `${call.id}-prior-select-products`,
              name: "select_products",
              input,
              output,
            }
            toolCalls.push(executedCall)
            answerContext = buildCurrentAnswerContext({
              message: params.message,
              selectedProducts,
              routinePlan,
              toolCalls,
              conversationState: params.conversationState,
              mode: params.answerCompositionMode,
              currentTurnContext,
            })
            appendToolResultMessages(modelMessages, executedCall, input, output, {
              answerContext:
                params.answerCompositionMode === "inline_context" ? answerContext : null,
            })
            executedAnyTool = true
          }
          continue
        }

        if (selectedCategories.has(category)) {
          blockedToolCalls.push(blockToolCall(call, "duplicate_category"))
          continue
        }

        if (
          category !== priorExplanationCategory &&
          (isConceptualCategoryComparisonAsk(params.message, category) ||
            isConceptualCategoryCuriosity(params.message, category))
        ) {
          blockedToolCalls.push(blockToolCall(call, "conceptual_category_curiosity"))
          guardrails.push("conceptual_category_curiosity")
          continue
        }

        selectedCategories.add(category)
        const input = buildSelectProductsInput(call.input, category, params, currentTurnContext)
        const output = await params.tools.select_products(input)
        selectedProducts = extractSelectedProductsProjection(output)
        const executedCall: AgenticExecutedToolCall = {
          id: call.id,
          name: "select_products",
          input,
          output,
        }
        toolCalls.push(executedCall)
        answerContext = buildCurrentAnswerContext({
          message: params.message,
          selectedProducts,
          routinePlan,
          toolCalls,
          conversationState: params.conversationState,
          mode: params.answerCompositionMode,
          currentTurnContext,
        })
        appendToolResultMessages(modelMessages, call, input, output, {
          answerContext: params.answerCompositionMode === "inline_context" ? answerContext : null,
        })
        executedAnyTool = true
        continue
      }

      const input = buildRoutineInput(call.input, params, currentTurnContext)
      const rawOutput = await params.tools.build_or_fix_routine(input)
      routinePlan = sanitizeRoutineProjectionForCurrentTurn(
        extractRoutineProjection(rawOutput),
        currentTurnContext,
      )
      const output = routinePlan ?? rawOutput
      const executedCall: AgenticExecutedToolCall = {
        id: call.id,
        name: "build_or_fix_routine",
        input,
        output,
      }
      toolCalls.push(executedCall)
      answerContext = buildCurrentAnswerContext({
        message: params.message,
        selectedProducts,
        routinePlan,
        toolCalls,
        conversationState: params.conversationState,
        mode: params.answerCompositionMode,
        currentTurnContext,
      })
      appendToolResultMessages(modelMessages, call, input, output, {
        answerContext: params.answerCompositionMode === "inline_context" ? answerContext : null,
      })
      executedAnyTool = true
    }

    if (terminalFailureStage === "max_executable_tool_calls") {
      break
    }

    if (!executedAnyTool) {
      modelMessages.push({
        role: "user",
        content:
          "Kein ausfuehrbares Tool wurde akzeptiert. Beantworte den Turn jetzt mit submit_final_answer, ohne interne Tool- oder Guardrail-Labels zu nennen.",
      })
    }
  }

  if (!terminalAnswer) {
    const repairReason = terminalFailureStage ?? "max_model_steps"
    if (repairReason === "max_model_steps") {
      guardrails.push("max_model_steps")
    }
    const repairResult = await attemptTerminalProtocolRepair({
      params,
      modelMessages,
      modelSteps,
      repairReason,
      repairAttempts,
    })
    terminalAnswer = repairResult.terminalAnswer

    if (!terminalAnswer) {
      return buildVisibleFailureResult({
        params,
        selectedProducts,
        routinePlan,
        advisorGuidance,
        answerContext,
        toolCalls,
        blockedToolCalls,
        guardrails,
        modelSteps,
        consultationBrief,
        answerCompositionMode: params.answerCompositionMode,
        repairAttempts,
        failureStage: repairResult.failureStage ?? "repair_failed",
      })
    }
  }

  const composedAnswer = await composeFinalAnswerIfNeeded({
    terminalAnswer,
    answerContext,
    params,
    selectedProducts,
    routinePlan,
    advisorGuidance,
    toolCalls,
    guardrails,
  })

  const normalizedStatePatch = normalizeTerminalStatePatchForToolFacts({
    terminalStatePatch: terminalAnswer.state_patch,
    toolCalls,
  })

  return buildResult({
    finalAnswer: polishAgenticFinalAnswer(composedAnswer.finalAnswer),
    surfacedProductIds: deriveSurfacedProductIds({
      terminalProductIds: terminalAnswer.product_ids,
      selectedProducts,
    }),
    selectedProducts,
    routinePlan,
    advisorGuidance,
    answerContext: composedAnswer.answerContext,
    toolCalls,
    blockedToolCalls,
    guardrails,
    modelSteps,
    consultationBrief,
    answerCompositionMode: params.answerCompositionMode,
    previousState: params.conversationState,
    terminalStatePatch: normalizedStatePatch,
    repairAttempts,
    failureStage: null,
    visibleFailure: false,
  })
}

async function attemptTerminalProtocolRepair(params: {
  params: AgenticToolTurnParams
  modelMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]
  modelSteps: AgenticToolLoopModelStep[]
  repairReason: Exclude<AgenticToolLoopFailureStage, null>
  repairAttempts: AgenticToolTurnResult["trace"]["repair_attempts"]
}): Promise<{
  terminalAnswer: AgenticTerminalAnswer | null
  failureStage?: Exclude<AgenticToolLoopFailureStage, null>
}> {
  params.repairAttempts.push({
    reason: params.repairReason,
    instruction_label: "terminal_protocol_repair",
  })
  params.modelMessages.push({
    role: "user",
    content: TERMINAL_PROTOCOL_REPAIR_INSTRUCTION,
  })

  const step = await params.params.modelClient.runStep({
    systemPrompt: AGENTIC_TOOL_LOOP_PROMPT,
    messages: params.modelMessages,
    tools: buildTerminalRepairToolDefinitions(),
  })
  params.modelSteps.push(step)

  if (step.type !== "tool_calls") {
    return { terminalAnswer: null }
  }

  const terminalCalls = step.calls.filter((call) => call.name === "submit_final_answer")
  if (step.calls.length !== 1 || terminalCalls.length !== 1) {
    return { terminalAnswer: null }
  }

  const terminalAnswer = parseTerminalAnswer(terminalCalls[0].input)
  return terminalAnswer
    ? { terminalAnswer }
    : { terminalAnswer: null, failureStage: "missing_terminal_answer" }
}

function buildTerminalRepairToolDefinitions(): OpenAI.Chat.Completions.ChatCompletionTool[] {
  return buildAgenticToolDefinitions().filter(
    (tool) => tool.type === "function" && tool.function.name === "submit_final_answer",
  )
}

function polishAgenticFinalAnswer(answer: string): string {
  return answer
    .trim()
    .replace(
      /\bUm (?:Ihre|deine) Kopfhaut zu beruhigen und die Schuppen zu reduzieren,?/i,
      "Um deine Kopfhaut bis zur Shampoo-Auswahl moeglichst mild zu behandeln,",
    )
    .replace(
      /\bUm (?:Ihre|deine) Kopfhaut zu beruhigen und die trockenen Sch(?:ue|ü)ppchen zu reduzieren,?/i,
      "Um deine Kopfhaut bis zur Shampoo-Auswahl moeglichst mild zu behandeln,",
    )
    .replace(
      /\bUm (?:Ihre|deine) Kopfhaut bis zur Auswahl eines passenden Shampoos zu beruhigen,?/i,
      "Um deine Kopfhaut bis zur Auswahl eines passenden Shampoos moeglichst mild zu behandeln,",
    )
    .replace(
      /\bUm (?:Ihre|deine) Kopfhaut zu beruhigen,?/i,
      "Um deine Kopfhaut bis dahin moeglichst mild zu behandeln,",
    )
    .replace(/,\s*und die trockenen Sch(?:ue|ü)ppchen zu reduzieren\b/i, "")
    .replace(
      /\bum zus(?:ae|ä)tzlichen Stress f(?:ue|ü)r die Kopfhaut zu vermeiden\b/i,
      "um die Laengen beim Foehnen zu schuetzen",
    )
    .replace(
      /\bum die Kopfhaut nicht zus(?:ae|ä)tzlich zu belasten\b/i,
      "um die Laengen beim Foehnen zu schuetzen",
    )
    .replace(
      /\bDiese Schritte k(?:oe|ö)nnen helfen, die Symptome zu lindern, bis du ein (?:passendes|geeignetes) Shampoo gefunden hast\.?/i,
      "Diese Schritte halten die Routine bis zur Shampoo-Auswahl sanfter.",
    )
    .replace(
      /\bDiese Anpassungen k(?:oe|ö)nnen helfen, die Kopfhaut zu beruhigen und die Symptome zu lindern\.?/i,
      "Diese Anpassungen halten die Routine bis dahin sanfter.",
    )
    .replace(
      /\bDiese (Anpassungen|Schritte) k(?:oe|ö)nnen helfen, die Symptome zu lindern, (?:w(?:ae|ä)hrend du auf (?:ein geeignetes Shampoo|eine passende Shampoo-Empfehlung) wartest|bis du ein (?:passendes|geeignetes) Shampoo gefunden hast)\.?/i,
      "Diese $1 halten die Routine bis zur Shampoo-Auswahl sanfter.",
    )
    .replace(
      /\bDiese sind oft sanfter und helfen, die Kopfhaut zu beruhigen\.?/i,
      "Diese sind oft sanfter zur Kopfhaut.",
    )
    .replace(
      /\bDiese Schritte helfen, die Kopfhaut zu beruhigen und die Schuppenbildung zu reduzieren\.?/i,
      "Diese Schritte halten die Routine bis zur Shampoo-Auswahl sanfter.",
    )
    .replace(/\bVerwenden Sie\b/g, "Verwende")
    .replace(/\bAchten Sie\b/g, "Achte")
    .replace(/\bNutzen Sie\b/g, "Nutze")
    .replace(/\bVermeiden Sie\b/g, "Vermeide")
    .replace(/\bFalls Sie\b/g, "Falls du")
    .replace(/\bWenn Sie\b/g, "Wenn du")
    .replace(/\bsollten Sie\b/g, "solltest du")
    .replace(/\bkönnen Sie\b/g, "kannst du")
    .replace(/\bkoennen Sie\b/g, "kannst du")
    .replace(/\bIhnen\b/g, "dir")
    .replace(/\bIhre\b/g, "deine")
    .replace(/\bIhren\b/g, "deinen")
    .replace(/\bIhrem\b/g, "deinem")
    .replace(/\bIhrer\b/g, "deiner")
    .replace(/\bIhr\b/g, "dein")
    .replace(
      /\s*(?:Wenn du (?:m\u00f6chtest|moechtest),?\s*)?(?:kann ich dir )?(?:auch )?(?:helfen,?\s*)?(?:eine einfache Routine|eine Routine|passende Produkte|konkrete Produkte|Produktempfehlungen|spezifische Produktvorschlaege|spezifische Produktvorschl\u00e4ge|deine Routine)\s+(?:mit diesen Produkten\s+)?(?:zusammenzustellen|zu erstellen|auszuwaehlen|auszuw\u00e4hlen|zu optimieren|machen|finden)\.?\s*$/i,
      " Als naechsten Schritt koennen wir passende Produkte dafuer auswaehlen.",
    )
    .replace(
      /\s*Wenn du (?:m\u00f6chtest|moechtest),?\s*kann ich dir (?:spezifische |konkrete )?(?:Produktvorschlaege|Produktvorschl\u00e4ge|Produktempfehlungen)(?:\s+fuer\s+[^.?!]+)? machen\.?\s*$/i,
      " Als naechsten Schritt koennen wir passende Produkte dafuer auswaehlen.",
    )
    .replace(
      /\s*Wenn du (?:m\u00f6chtest|moechtest),?\s*kann ich dir bei der Auswahl (?:eines|einer|passender|von)\s+[^.?!]+ helfen\.?\s*$/i,
      " Als naechsten Schritt koennen wir passende Produkte dafuer auswaehlen.",
    )
    .replace(
      /\s*Wenn du (?:weitere Fragen hast|noch Fragen hast|weitere Fragen hast oder Produktvorschlaege moechtest|weitere Fragen hast oder Produktvorschl\u00e4ge m\u00f6chtest|weitere Fragen zur Integration dieser Produkte in deine Routine hast|konkrete Produktvorschlaege moechtest|konkrete Produktvorschl\u00e4ge m\u00f6chtest|Produktempfehlungen moechtest|Produktempfehlungen m\u00f6chtest),?\s*lass es mich wissen!?\s*$/i,
      "",
    )
    .replace(
      /\s*Wenn du weitere Fragen hast oder Hilfe bei der Anwendung ben(?:oe|ö)tigst,?\s*lass es mich wissen!?\s*$/i,
      " Als naechsten Schritt koennen wir die Anwendung fuer dein ausgewaehltes Produkt kurz festlegen.",
    )
    .replace(
      /\s*Wenn du Interesse an (?:spezifischen |konkreten )?(?:Produktvorschlaegen|Produktvorschl\u00e4gen|Produktempfehlungen)(?:\s+fuer\s+[^,.!?]+)? hast,?\s*lass es mich wissen,?\s*und ich kann dir passende Optionen empfehlen\.?\s*$/i,
      " Als naechsten Schritt koennen wir passende Produkte dafuer auswaehlen.",
    )
    .replace(
      /\s*Wenn du (?:m\u00f6chtest|moechtest),?\s*kann ich dir helfen,?\s*die Routine weiter zu verfeinern oder konkrete (?:Produktvorschlaege|Produktvorschl\u00e4ge) machen\.?\s*$/i,
      " Als naechsten Schritt koennen wir passende Produkte dafuer auswaehlen.",
    )
    .replace(
      /\s*Solltest du [^.?!]*(?:Fragen|Produkt(?:auswahl|vorschlaege|vorschl\u00e4ge)|Produktempfehlungen)[^.?!]*lass es mich wissen!?\s*$/i,
      "",
    )
    .replace(
      /\s*Wenn du mehr (?:ueber|über) [^.?!]*(?:Anwendung|Produkte|Produktempfehlungen|Produktauswahl)[^.?!]*(?:wissen|erfahren) (?:moechtest|m\u00f6chtest),?\s*lass es mich wissen!?\s*$/i,
      "",
    )
    .replace(
      /\bDiese Schritte k(?:oe|ö)nnen helfen, deine Kopfhaut zu beruhigen und die Haare zu pflegen, bis du ein passendes Shampoo gefunden hast\./i,
      "Diese Schritte halten die Routine kopfhautschonender und pflegen die Haare, bis du ein passendes Shampoo gefunden hast.",
    )
    .replace(
      /\b(?:Du kannst|kannst du) einige Anpassungen vornehmen, die deiner Kopfhaut helfen k(?:oe|ö)nnten:/i,
      "Du kannst einige kopfhautschonende Anpassungen vornehmen:",
    )
    .replace(
      /\bDiese Schritte k(?:oe|ö)nnen helfen, die Kopfhaut zu beruhigen und die Haare gesund zu halten\.?/i,
      "Diese Schritte halten die Routine kopfhautschonender und pflegen die Haare.",
    )
    .trim()
}

function shouldBlockAdvisorGuidanceAfterProducts(params: {
  selectedProducts: SelectedProductsProjection | null
}): boolean {
  if (!params.selectedProducts) return false

  return !["needs_more_info", "not_recommended", "no_catalog_match"].includes(
    params.selectedProducts.decision,
  )
}

function deriveSurfacedProductIds(params: {
  terminalProductIds: string[]
  selectedProducts: SelectedProductsProjection | null
}): string[] {
  if (!params.selectedProducts) return []

  const allowedProductIds = new Set(
    params.selectedProducts.products.map((product) => product.product_id),
  )
  if (allowedProductIds.size === 0) return []

  const surfacedProductIds: string[] = []
  for (const productId of params.terminalProductIds) {
    if (!allowedProductIds.has(productId)) continue
    surfacedProductIds.push(productId)
    if (surfacedProductIds.length >= 3) break
  }

  return surfacedProductIds
}

function buildCurrentAnswerContext(params: {
  message: string
  selectedProducts: SelectedProductsProjection | null
  routinePlan: BuildOrFixRoutineProjection | null
  toolCalls: AgenticExecutedToolCall[]
  conversationState: ConversationState | null | undefined
  mode: AgenticAnswerCompositionMode | undefined
  currentTurnContext: CurrentTurnContextOverlay
}): AgenticAnswerContext | null {
  if (!params.mode) return null

  return buildAgenticAnswerContext({
    latestUserMessage: params.message,
    selectedProducts: params.selectedProducts,
    routinePlan: params.routinePlan,
    toolCalls: params.toolCalls,
    conversationState: params.conversationState,
    currentTurnConflict: getCurrentTurnConflictContext(params.currentTurnContext),
    currentTurnScalpSafety: hasCurrentTurnScalpSafety(params.currentTurnContext),
  })
}

function hasCurrentTurnScalpSafety(currentTurnContext: CurrentTurnContextOverlay): boolean {
  return currentTurnContext.active_concerns.some(
    (signal) =>
      signal.field === "scalp_condition" ||
      (signal.field === "concerns" &&
        (signal.value === "dandruff" || signal.value === "oily_scalp")),
  )
}

function sanitizeRoutineProjectionForCurrentTurn(
  routinePlan: BuildOrFixRoutineProjection | null,
  currentTurnContext: CurrentTurnContextOverlay,
): BuildOrFixRoutineProjection | null {
  if (!routinePlan) return null
  if (!hasCurrentTurnScalpSafety(currentTurnContext)) return routinePlan
  if (currentTurnContext.has_explicit_reset_signal) return routinePlan

  const steps = routinePlan.steps.filter((step) => !isScalpUnsafeResetStep(step))
  const priorityContext =
    routinePlan.priority_context &&
    steps.some((step) => step.id === routinePlan.priority_context?.selected_step_id)
      ? routinePlan.priority_context
      : null

  if (
    steps.length === routinePlan.steps.length &&
    priorityContext === routinePlan.priority_context
  ) {
    return routinePlan
  }

  return {
    ...routinePlan,
    steps,
    priority_context: priorityContext,
  }
}

function isScalpUnsafeResetStep(step: BuildOrFixRoutineProjection["steps"][number]): boolean {
  const text = normalizeIntentText(
    [
      step.id,
      step.label,
      step.category,
      ...(Array.isArray(step.reasons) ? step.reasons : []),
      ...(Array.isArray(step.caveats) ? step.caveats : []),
    ]
      .filter(Boolean)
      .join(" "),
  )
  return /\b(?:hair reset|haar reset|tiefenreinigung|deep cleansing|clarifying|reset)\b/.test(text)
}

async function composeFinalAnswerIfNeeded(params: {
  terminalAnswer: AgenticTerminalAnswer
  answerContext: AgenticAnswerContext | null
  params: AgenticToolTurnParams
  selectedProducts: SelectedProductsProjection | null
  routinePlan: BuildOrFixRoutineProjection | null
  advisorGuidance: AdvisorGuidanceProjection | null
  toolCalls: AgenticExecutedToolCall[]
  guardrails: string[]
}): Promise<{ finalAnswer: string; answerContext: AgenticAnswerContext | null }> {
  if (params.params.answerCompositionMode !== "composer_context") {
    return {
      finalAnswer: params.terminalAnswer.answer,
      answerContext: params.answerContext,
    }
  }

  const composerCurrentTurnContext = extractCurrentTurnContextOverlay({
    message: params.params.message,
    recentMessages: params.params.recentMessages,
    savedProfile: params.params.userContext.profile,
  })
  const answerContext =
    params.answerContext ??
    buildAgenticAnswerContext({
      latestUserMessage: params.params.message,
      selectedProducts: params.selectedProducts,
      routinePlan: params.routinePlan,
      toolCalls: params.toolCalls,
      conversationState: params.params.conversationState,
      currentTurnConflict: getCurrentTurnConflictContext(composerCurrentTurnContext),
      currentTurnScalpSafety: hasCurrentTurnScalpSafety(composerCurrentTurnContext),
    })

  if (!params.params.modelClient.composeFinalAnswer) {
    params.guardrails.push("composer_unavailable")
    return {
      finalAnswer: params.terminalAnswer.answer,
      answerContext,
    }
  }

  try {
    const composed = await params.params.modelClient.composeFinalAnswer({
      systemPrompt: AGENTIC_CONTEXTUAL_COMPOSER_PROMPT,
      message: params.params.message,
      recentMessages: params.params.recentMessages,
      userContext: params.params.userContext,
      conversationState: params.params.conversationState,
      selectedProducts: params.selectedProducts,
      routinePlan: params.routinePlan,
      advisorGuidance: params.advisorGuidance,
      answerContext,
      draftAnswer: params.terminalAnswer.answer,
    })

    return {
      finalAnswer: composed.trim() || params.terminalAnswer.answer,
      answerContext,
    }
  } catch {
    params.guardrails.push("composer_failed")
    return {
      finalAnswer: params.terminalAnswer.answer,
      answerContext,
    }
  }
}

function buildInitialMessages(
  params: Pick<
    AgenticToolTurnParams,
    "message" | "recentMessages" | "userContext" | "conversationState"
  >,
  consultationBrief: AgenticConsultationBrief | null,
  currentTurnContext: CurrentTurnContextOverlay,
): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
  const recentMessages = budgetRecentMessages(params.recentMessages)

  return [
    {
      role: "user",
      content: JSON.stringify({
        latest_user_message: params.message,
        recent_messages: recentMessages,
        conversation_state: params.conversationState ?? null,
        user_context: compactUserContext(params.userContext),
        current_turn_context: compactCurrentTurnContext(currentTurnContext),
        consultation_brief: consultationBrief,
        hard_rules: HARD_ANSWER_RULES,
      }),
    },
    ...recentMessages.map((message) => ({
      role: message.role,
      content: message.content,
    })),
    {
      role: "user",
      content: params.message,
    },
  ]
}

function compactCurrentTurnContext(currentTurnContext: CurrentTurnContextOverlay) {
  return {
    routine_products: currentTurnContext.routine_products
      ? {
          value: currentTurnContext.routine_products.value,
          evidence: currentTurnContext.routine_products.evidence,
          conflicts_with_saved: currentTurnContext.routine_products.conflicts_with_saved,
        }
      : null,
    active_concerns: currentTurnContext.active_concerns,
    safety_overlay_ids: currentTurnContext.safety_overlay_ids,
  }
}

function budgetRecentMessages(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
): Array<{ role: "user" | "assistant"; content: string }> {
  const result: Array<{ role: "user" | "assistant"; content: string }> = []
  let total = 0

  for (const message of messages.slice(-MAX_RECENT_MESSAGES).reverse()) {
    const content = message.content.trim().slice(0, MAX_RECENT_MESSAGE_CHARS)
    if (!content) continue
    const remaining = MAX_RECENT_TOTAL_CHARS - total
    if (remaining <= 0) break
    const budgeted = content.slice(0, remaining)
    total += budgeted.length
    result.push({ role: message.role, content: budgeted })
  }

  return result.reverse()
}

function compactUserContext(userContext: UserContextProjection) {
  return {
    profile: userContext.profile,
    derived_signals: userContext.derived_signals,
    routine_inventory_count: userContext.routine_inventory.length,
    relevant_memory: userContext.relevant_memory.slice(0, MAX_MEMORY_ENTRIES).map((entry) => ({
      kind: entry.kind,
      content: entry.content.slice(0, MAX_MEMORY_CHARS),
    })),
    missing_profile: userContext.missing_profile,
  }
}

function buildSelectProductsInput(
  input: Record<string, unknown>,
  category: AgenticProductCategory,
  params: AgenticToolTurnParams,
  currentTurnContext: CurrentTurnContextOverlay,
): Record<string, unknown> {
  const message = buildProductSelectionMessage({
    latestMessage: params.message,
    recentMessages: params.recentMessages,
    category,
  })
  const activeProfileSignals = mergeActiveProfileSignals(input.activeProfileSignals, [
    ...inferCurrentTurnActiveProfileSignals(params.message),
    ...buildCurrentTurnActiveProfileSignals(currentTurnContext),
  ])
  const concerns = mergeProductConcerns(
    input.concerns,
    deriveProductConcernsFromCurrentTurn(currentTurnContext),
  )

  return {
    ...input,
    category,
    message,
    hairProfile: projectHairProfileForCurrentTurn(params.userContext.profile, currentTurnContext),
    activeProfileSignals,
    concerns,
    memoryContext: {
      enabled: params.userContext.relevant_memory.length > 0,
      entries: params.userContext.relevant_memory,
      promptContext: null,
      dislikedProductNames: [],
    },
    routineItems: params.userContext.routine_inventory,
  }
}

function buildProductSelectionMessage(params: {
  latestMessage: string
  recentMessages: Array<{ role: "user" | "assistant"; content: string }>
  category: AgenticProductCategory
}): string {
  const latest = params.latestMessage.trim()
  const normalizedLatest = normalizeIntentText(latest)
  if (!latest) return latest
  if (mentionsProductCategory(normalizedLatest, params.category)) return latest
  if (!hasExplicitProductAsk(latest)) return latest

  const priorCategoryMessage = [...params.recentMessages]
    .reverse()
    .find(
      (message) =>
        message.role === "user" &&
        mentionsProductCategory(normalizeIntentText(message.content), params.category),
    )

  if (!priorCategoryMessage?.content.trim()) return latest

  return `${priorCategoryMessage.content.trim()}\n\nAktuelle Nachfrage: ${latest}`
}

function mergeProductConcerns(
  rawConcerns: unknown,
  inferredConcerns: AgentConcern[],
): AgentConcern[] {
  const concerns = Array.isArray(rawConcerns)
    ? rawConcerns.filter((value): value is AgentConcern => isAgentConcern(value))
    : []

  for (const concern of inferredConcerns) {
    if (!concerns.includes(concern)) concerns.push(concern)
  }

  return concerns
}

function deriveProductConcernsFromCurrentTurn(
  currentTurnContext: CurrentTurnContextOverlay,
): AgentConcern[] {
  const concerns: AgentConcern[] = []
  const add = (concern: AgentConcern) => {
    if (!concerns.includes(concern)) concerns.push(concern)
  }

  for (const signal of currentTurnContext.active_concerns) {
    if (signal.field === "scalp_type" && signal.value === "oily") add("oily_roots")
    if (signal.field === "concerns" && signal.value === "dryness") add("dry_lengths")
    if (signal.field === "concerns" && signal.value === "frizz") add("frizz")
    if (
      signal.field === "scalp_condition" &&
      (signal.value === "dandruff" || signal.value === "dry_flakes")
    ) {
      add("dandruff_or_flakes")
    }
    if (signal.field === "scalp_condition" && signal.value === "irritated") add("irritation")
  }

  return concerns
}

function isAgentConcern(value: unknown): value is AgentConcern {
  return (
    value === "oily_roots" ||
    value === "dry_lengths" ||
    value === "dandruff_or_flakes" ||
    value === "irritation" ||
    value === "frizz"
  )
}

function mergeActiveProfileSignals(
  rawSignals: unknown,
  inferredSignals: AgentActiveProfileSignal[],
): unknown[] {
  const signals = Array.isArray(rawSignals) ? [...rawSignals] : []

  for (const signal of inferredSignals) {
    const existingIndex = signals.findIndex(
      (candidate) =>
        candidate &&
        typeof candidate === "object" &&
        "field" in candidate &&
        String((candidate as { field: unknown }).field) === signal.field &&
        (!allowsMultipleActiveSignalValues(signal.field) ||
          String((candidate as { value?: unknown }).value) === signal.value),
    )

    if (existingIndex === -1) {
      signals.push(signal)
      continue
    }

    const existingSignal = signals[existingIndex]
    const existingSelectionEffect =
      existingSignal && typeof existingSignal === "object" && "selection_effect" in existingSignal
        ? String((existingSignal as { selection_effect: unknown }).selection_effect)
        : null
    if (existingSelectionEffect !== "override" && existingSelectionEffect !== "caution") {
      signals[existingIndex] = signal
    }
  }

  return signals
}

function allowsMultipleActiveSignalValues(field: AgentActiveProfileSignal["field"]): boolean {
  return (
    field === "concerns" ||
    field === "goals" ||
    field === "chemical_treatment" ||
    field === "styling_tools" ||
    field === "scalp_condition"
  )
}

function inferCurrentTurnActiveProfileSignals(message: string): AgentActiveProfileSignal[] {
  const densitySignal = inferDensitySignal(message)
  return densitySignal ? [densitySignal] : []
}

function getPriorRecommendationExplanationCategory(params: {
  message: string
  conversationState: ConversationState | null | undefined
}): AgenticProductCategory | null {
  if (
    !hasPriorRecommendationExplanationIntent({
      message: params.message,
      conversationState: params.conversationState,
    })
  ) {
    return null
  }

  const state = params.conversationState
  const categoryFromMessage = AGENTIC_PRODUCT_CATEGORIES.find((category) =>
    mentionsProductCategory(normalizeIntentText(params.message), category),
  )
  const stateCategory =
    parseAgenticProductCategory(state?.last_product_category) ??
    parseAgenticProductCategory(state?.active_topic)

  return stateCategory ?? categoryFromMessage ?? null
}

function hasPriorRecommendationExplanationIntent(params: {
  message: string
  conversationState: ConversationState | null | undefined
}): boolean {
  const normalized = normalizeIntentText(params.message)
  const priorAction = params.conversationState?.last_assistant_action ?? ""
  const followsProductAnswer =
    /product|produkt|recommend|empfehl/i.test(priorAction) ||
    params.conversationState?.last_product_category != null

  if (!followsProductAnswer || !/\bwarum\b/.test(normalized)) return false

  return /\b(?:diese|dieses|diesen|die\s+produkte?|deine\s+empfehlung|empfohlen|schlaegst|schlagst|empfiehlst|gerade\s+den|den\s+empfohlenen|den\s+vorgeschlagenen|den\s+und\s+nicht)\b/.test(
    normalized,
  )
}

function inferDensitySignal(message: string): AgentActiveProfileSignal | null {
  const normalized = normalizeIntentText(message)
  const buildSignal = (value: "low" | "medium" | "high", evidence: string) => ({
    field: "density" as const,
    value,
    source: "message" as const,
    selection_effect: "override" as const,
    evidence,
  })

  if (
    /\b(?:mittler\w*|mittel|medium|normal\w*)\s+(?:haar)?dichte\b/.test(normalized) ||
    /\b(?:haar)?dichte\s+(?:mittler\w*|medium|normal\w*)\b/.test(normalized)
  ) {
    return buildSignal("medium", "mittlere Dichte")
  }

  if (
    /\b(?:wenig\w*|gering\w*|niedrig\w*|low)\s+(?:haar)?dichte\b/.test(normalized) ||
    /\b(?:haar)?dichte\s+(?:wenig\w*|gering\w*|niedrig\w*|low)\b/.test(normalized)
  ) {
    return buildSignal("low", "geringe Dichte")
  }

  if (
    /\b(?:viel\w*|hoch\w*|high)\s+(?:haar)?dichte\b/.test(normalized) ||
    /\b(?:haar)?dichte\s+(?:viel\w*|hoch\w*|high)\b/.test(normalized)
  ) {
    return buildSignal("high", "hohe Dichte")
  }

  return null
}

function normalizeIntentText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function hasExplicitProductAsk(message: string): boolean {
  const normalized = normalizeIntentText(message)

  return [
    /\bwhich\b/,
    /\bwhat kind of\b/,
    /\bwas (?:fur|fuer)\b/,
    /\bwelch\w*\s+(?:produkt\w*|option\w*|shampoo\w*|conditioner\w*|spuelung\w*|spulung\w*|leave in|leavein|maske\w*|haarkur\w*|kur\w*)\b/,
    /\bempfehl\w*\b/,
    /\brecommend\w*\b/,
    /\b(?:ich\s+)?brauche\s+(?:ein\w*\s+)?(?:produkt\w*|shampoo\w*|conditioner\w*|spuelung\w*|spulung\w*|leave in|leavein|maske\w*|haarkur\w*|kur\w*|oel\w*|ol\w*)\b/,
    /\bpasst\b/,
    /\bfit(?:s)?\b/,
    /\bprodukt(?:e|en|s)?\b/,
    /\bproduct(?:s)?\b/,
    /\bkaufen\b/,
    /\bbuy\b/,
    /\bnehmen\b/,
    /\btake\b/,
    /\boption(?:en|s)?\b/,
    /\bbesser\b/,
    /\bbetter\b/,
  ].some((pattern) => pattern.test(normalized))
}

function isConceptualCategoryComparisonAsk(
  message: string,
  category: AgenticProductCategory,
): boolean {
  const normalized = normalizeIntentText(message)
  if (!mentionsProductCategory(normalized, category)) return false
  if (hasConcreteProductPickAsk(normalized)) return false

  const mentionedCategoryCount = AGENTIC_PRODUCT_CATEGORIES.filter((candidate) =>
    mentionsProductCategory(normalized, candidate),
  ).length
  if (mentionedCategoryCount < 2) return false

  return /\b(?:oder|or|vs|versus|statt|lieber|besser|better|sinnvoller|nehmen|take)\b/.test(
    normalized,
  )
}

function hasConcreteProductPickAsk(normalizedMessage: string): boolean {
  return [
    /\bwhich\b/,
    /\bwhat kind of\b/,
    /\bwas (?:fur|fuer)\b/,
    /\bwelch\w*\s+(?:produkt\w*|shampoo\w*|conditioner\w*|spuelung\w*|spulung\w*|leave in|leavein|maske\w*|haarkur\w*|kur\w*|oel\w*|ol\w*)\b/,
    /\bwelch\w*\s+produkt\s*option\w*\b/,
    /\bempfehl\w*\b/,
    /\brecommend\w*\b/,
    /\bprodukt(?:e|en|s)?\b/,
    /\bproduct(?:s)?\b/,
    /\bkaufen\b/,
    /\bbuy\b/,
  ].some((pattern) => pattern.test(normalizedMessage))
}

function isConceptualCategoryCuriosity(message: string, category: AgenticProductCategory): boolean {
  if (
    category !== "leave_in" &&
    category !== "mask" &&
    category !== "conditioner" &&
    category !== "shampoo" &&
    category !== "bondbuilder" &&
    category !== "deep_cleansing_shampoo" &&
    category !== "dry_shampoo" &&
    category !== "peeling"
  ) {
    return false
  }

  const normalized = normalizeIntentText(message)
  if (!mentionsProductCategory(normalized, category)) return false
  if (hasExplicitProductAsk(normalized)) return false

  return [
    /\bgehoert\b/,
    /\bgehort\b/,
    /\bsoll(?:te|test|tet|ten)? gut sein\b/,
    /\bist gut\b/,
    /\bbringt\b/,
    /\bbrauche\b/,
    /\bbrauch ich\b/,
    /\bhilft\b/,
    /\bsinnvoll\b/,
    /\bnotwendig\b/,
    /\bpflicht\b/,
  ].some((pattern) => pattern.test(normalized))
}

function mentionsProductCategory(
  normalizedMessage: string,
  category: AgenticProductCategory,
): boolean {
  return getCategorySynonymPatterns(category).some((pattern) => pattern.test(normalizedMessage))
}

function getCategorySynonymPatterns(category: AgenticProductCategory): RegExp[] {
  switch (category) {
    case "leave_in":
      return [/\bleave in\b/, /\bleavein\b/, /\bleave in conditioner\b/, /\bleave in pflege\b/]
    case "mask":
      return [/\bmask\b/, /\bhair mask\b/, /\bmaske\b/, /\bhaarkur\b/, /\bkur\b/]
    case "conditioner":
      return [
        /\bconditioner\b/,
        /\bspulung\b/,
        /\bspuelung\b/,
        /\bhaarspulung\b/,
        /\bhaarspuelung\b/,
      ]
    case "shampoo":
      return [/\bshampoo\b/, /\bschampoo\b/, /\bhaarwasche\b/, /\bhaarwaesche\b/]
    case "oil":
      return [/\boel\b/, /\bol\b/, /\boil\b/, /\bhaarol\b/, /\bhaaroel\b/]
    case "bondbuilder":
      return [
        /\bbond\s*builder\w*\b/,
        /\bbondbuilder\w*\b/,
        /\bbond\s*repair\b/,
        /\bk18\b/,
        /\bkr18\b/,
        /\bolaplex\b/,
        /\bepres\b/,
      ]
    case "deep_cleansing_shampoo":
      return [
        /\btiefenreinigung\b/,
        /\bdeep cleansing\b/,
        /\bclarifying\b/,
        /\breinigungsshampoo\b/,
      ]
    case "dry_shampoo":
      return [/\btrockenshampoo\b/, /\bdry shampoo\b/]
    case "peeling":
      return [/\bpeeling\b/, /\bscalp scrub\b/, /\bkopfhautpeeling\b/]
  }
}

function buildRoutineInput(
  input: Record<string, unknown>,
  params: AgenticToolTurnParams,
  currentTurnContext: CurrentTurnContextOverlay,
): Record<string, unknown> {
  return {
    ...input,
    objective: projectRoutineObjective(input.objective, params.message, currentTurnContext),
    message: params.message,
    hairProfile: projectHairProfileForCurrentTurn(params.userContext.profile, currentTurnContext),
  }
}

function projectRoutineObjective(
  rawObjective: unknown,
  message: string,
  currentTurnContext: CurrentTurnContextOverlay,
): unknown {
  if (!hasCurrentTurnDirectCareConcern(currentTurnContext)) return rawObjective
  if (currentTurnContext.has_explicit_reset_signal) return rawObjective
  if (!hasNextStepRoutineIntent(message)) return rawObjective

  return "build_routine"
}

function hasCurrentTurnDirectCareConcern(currentTurnContext: CurrentTurnContextOverlay): boolean {
  return currentTurnContext.active_concerns.some(
    (signal) =>
      signal.field === "concerns" &&
      (signal.value === "frizz" || signal.value === "dryness" || signal.value === "tangling"),
  )
}

function hasNextStepRoutineIntent(message: string): boolean {
  const normalized = normalizeIntentText(message)
  return /\b(?:naechst\w*|nachst\w*|sinnvollst\w*|sinnvoll\w*\s+schritt|ergaenz\w*|erganz\w*|hinzufueg\w*|hinzufug\w*)\b/.test(
    normalized,
  )
}

function buildAdvisorGuidanceInput(
  input: Record<string, unknown>,
  params: AgenticToolTurnParams,
  currentTurnContext: CurrentTurnContextOverlay,
): Record<string, unknown> {
  return {
    intent: normalizeAdvisorGuidanceIntent(input.intent),
    category: normalizeAdvisorGuidanceCategory(input.category),
    categories: normalizeAdvisorGuidanceCategories(input.categories),
    profileFocus: normalizeAdvisorProfileFocus(input.profileFocus),
    message: params.message,
    userContext: {
      ...params.userContext,
      profile: projectHairProfileForCurrentTurn(params.userContext.profile, currentTurnContext),
    },
    conversationState: params.conversationState ?? null,
  }
}

function appendToolResultMessages(
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
  call: AgenticModelToolCall,
  input: Record<string, unknown>,
  output: unknown,
  options: {
    answerContext: AgenticAnswerContext | null
  },
): void {
  messages.push({
    role: "assistant",
    content: null,
    tool_calls: [
      {
        id: call.id,
        type: "function",
        function: {
          name: call.name,
          arguments: JSON.stringify(input),
        },
      },
    ],
  })
  messages.push({
    role: "tool",
    tool_call_id: call.id,
    content: JSON.stringify({
      tool_name: call.name,
      output_key: getToolOutputKey(call.name),
      hard_rules: HARD_ANSWER_RULES,
      answer_context: options.answerContext,
      output,
    }),
  })
}

function buildVisibleFailureResult(params: {
  params: AgenticToolTurnParams
  selectedProducts: SelectedProductsProjection | null
  routinePlan: BuildOrFixRoutineProjection | null
  advisorGuidance: AdvisorGuidanceProjection | null
  answerContext: AgenticAnswerContext | null
  toolCalls: AgenticExecutedToolCall[]
  blockedToolCalls: AgenticBlockedToolCall[]
  guardrails: string[]
  modelSteps: AgenticToolLoopModelStep[]
  consultationBrief: AgenticConsultationBrief | null
  answerCompositionMode: AgenticAnswerCompositionMode | undefined
  repairAttempts: AgenticToolTurnResult["trace"]["repair_attempts"]
  failureStage: Exclude<AgenticToolLoopFailureStage, null>
}): AgenticToolTurnResult {
  if (!params.guardrails.includes(params.failureStage)) {
    params.guardrails.push(params.failureStage)
  }

  return buildResult({
    finalAnswer: VISIBLE_FAILURE_ANSWER,
    surfacedProductIds: [],
    selectedProducts: params.selectedProducts,
    routinePlan: params.routinePlan,
    advisorGuidance: params.advisorGuidance,
    answerContext: params.answerContext,
    toolCalls: params.toolCalls,
    blockedToolCalls: params.blockedToolCalls,
    guardrails: params.guardrails,
    modelSteps: params.modelSteps,
    consultationBrief: params.consultationBrief,
    answerCompositionMode: params.answerCompositionMode,
    previousState: params.params.conversationState,
    terminalStatePatch: null,
    repairAttempts: params.repairAttempts,
    failureStage: params.failureStage,
    visibleFailure: true,
    keepStateUnchanged: true,
  })
}

function buildResult(params: {
  finalAnswer: string
  surfacedProductIds: string[]
  selectedProducts: SelectedProductsProjection | null
  routinePlan: BuildOrFixRoutineProjection | null
  advisorGuidance: AdvisorGuidanceProjection | null
  answerContext: AgenticAnswerContext | null
  toolCalls: AgenticExecutedToolCall[]
  blockedToolCalls: AgenticBlockedToolCall[]
  guardrails: string[]
  modelSteps: AgenticToolLoopModelStep[]
  consultationBrief: AgenticConsultationBrief | null
  answerCompositionMode: AgenticAnswerCompositionMode | undefined
  previousState: ConversationState | null | undefined
  terminalStatePatch: AgenticTerminalAnswer["state_patch"] | null
  repairAttempts: AgenticToolTurnResult["trace"]["repair_attempts"]
  failureStage: AgenticToolLoopFailureStage
  visibleFailure: boolean
  keepStateUnchanged?: boolean
}): AgenticToolTurnResult {
  const stateTransition = params.keepStateUnchanged
    ? buildUnchangedStateTransition(params.previousState)
    : normalizeStateTransitionForToolFacts({
        stateTransition: resolveAgenticConversationStateTransition({
          previousState: params.previousState ?? null,
          terminalStatePatch: params.terminalStatePatch ?? {
            active_topic: null,
            routine_layer: null,
            last_product_category: null,
            last_assistant_action: "",
            topic_relation: "unclear",
            reason: "tool_loop_missing_terminal_state_patch",
          },
          selectedProducts: params.selectedProducts,
          routinePlan: params.routinePlan,
        }),
        toolCalls: params.toolCalls,
        selectedProducts: params.selectedProducts,
      })

  return {
    final_answer: params.finalAnswer,
    selected_products: params.selectedProducts,
    routine_plan: params.routinePlan,
    advisor_guidance: params.advisorGuidance,
    surfaced_product_ids: params.surfacedProductIds,
    tool_calls: params.toolCalls,
    state_transition: stateTransition,
    trace: {
      engine_variant: "tool_loop",
      answer_composition_mode: params.answerCompositionMode ?? "baseline",
      answer_context: params.answerContext,
      advisor_guidance: params.advisorGuidance,
      consultation_brief: params.consultationBrief,
      model_steps: params.modelSteps,
      tool_calls: params.toolCalls,
      blocked_tool_calls: params.blockedToolCalls,
      guardrails: params.guardrails,
      repair_attempts: params.repairAttempts,
      failure_stage: params.failureStage,
      visible_failure: params.visibleFailure,
    },
  }
}

function buildUnchangedStateTransition(
  previousState: ConversationState | null | undefined,
): ConversationStateTransition {
  const normalizedPreviousState = normalizeConversationState(previousState ?? null)

  return {
    previous_state: normalizedPreviousState,
    next_state: normalizedPreviousState,
    reason: "tool_loop_visible_failure",
    changed_fields: [],
    classifier_override: null,
    updated_by_engine: "tool_loop",
  }
}

function normalizeTerminalStatePatchForToolFacts(params: {
  terminalStatePatch: AgenticTerminalAnswer["state_patch"] | null
  toolCalls: AgenticExecutedToolCall[]
}): AgenticTerminalAnswer["state_patch"] | null {
  const latestToolCall = params.toolCalls.at(-1)
  if (latestToolCall?.name !== "build_or_fix_routine" || latestToolCall.input.layer !== "basics") {
    return params.terminalStatePatch
  }

  return {
    ...(params.terminalStatePatch ?? {
      topic_relation: "same_topic",
      reason: "tool_loop_build_or_fix_routine_basics",
    }),
    active_topic: "routine",
    routine_layer: "basics",
    last_product_category: null,
    last_assistant_action: "answered_routine_basics",
  }
}

function normalizeStateTransitionForToolFacts(params: {
  stateTransition: ConversationStateTransition
  toolCalls: AgenticExecutedToolCall[]
  selectedProducts: SelectedProductsProjection | null
}): ConversationStateTransition {
  const latestToolCall = params.toolCalls.at(-1)
  if (latestToolCall?.name === "select_products") {
    const selectedProductTopic = parseAgenticProductCategory(params.selectedProducts?.category)
    if (!selectedProductTopic) return params.stateTransition

    const nextState: ConversationState = {
      ...params.stateTransition.next_state,
      active_topic: selectedProductTopic,
      routine_layer: null,
      pending_offer: null,
      last_product_category: selectedProductTopic,
    }

    return {
      ...params.stateTransition,
      next_state: nextState,
      reason: "tool_loop_select_products",
      changed_fields: getChangedConversationStateFields(
        params.stateTransition.previous_state,
        nextState,
      ),
    }
  }

  if (latestToolCall?.name !== "build_or_fix_routine" || latestToolCall.input.layer !== "basics") {
    return params.stateTransition
  }

  const nextState: ConversationState = {
    ...params.stateTransition.next_state,
    active_topic: "routine",
    routine_layer: "basics",
    pending_offer: "routine_goals_or_problems",
    last_assistant_action: "answered_routine_basics",
    last_product_category: null,
  }

  return {
    ...params.stateTransition,
    next_state: nextState,
    reason: "tool_loop_routine_basics_answered",
    changed_fields: getChangedConversationStateFields(
      params.stateTransition.previous_state,
      nextState,
    ),
  }
}

function getChangedConversationStateFields(
  previousState: ConversationState,
  nextState: ConversationState,
): Array<keyof ConversationState> {
  const fields: Array<keyof ConversationState> = [
    "version",
    "active_topic",
    "routine_layer",
    "pending_offer",
    "answered_slots",
    "last_assistant_action",
    "last_product_category",
  ]

  return fields.filter((field) => {
    const previousValue = previousState[field]
    const nextValue = nextState[field]
    return JSON.stringify(previousValue) !== JSON.stringify(nextValue)
  })
}

function parseTerminalAnswer(input: Record<string, unknown>): AgenticTerminalAnswer | null {
  if (typeof input.answer !== "string" || !input.answer.trim()) {
    return null
  }

  const statePatch =
    input.state_patch && typeof input.state_patch === "object" && !Array.isArray(input.state_patch)
      ? (input.state_patch as Record<string, unknown>)
      : {}

  return {
    answer: input.answer,
    product_ids: parseTerminalProductIds(input.product_ids),
    state_patch: {
      active_topic: parseActiveTopic(statePatch.active_topic),
      routine_layer: toRoutineLayer(statePatch.routine_layer),
      last_product_category: parseAgenticProductCategory(statePatch.last_product_category),
      last_assistant_action:
        typeof statePatch.last_assistant_action === "string"
          ? statePatch.last_assistant_action.slice(0, 80)
          : "answered",
      topic_relation: parseTopicRelation(statePatch.topic_relation),
      reason:
        typeof statePatch.reason === "string" && statePatch.reason.trim()
          ? statePatch.reason.slice(0, 240)
          : "Terminal state patch.",
    },
  }
}

function parseTerminalProductIds(value: unknown): string[] {
  if (!Array.isArray(value)) return []

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
}

function extractSelectedProductsProjection(output: unknown): SelectedProductsProjection | null {
  if (!output || typeof output !== "object") return null
  const record = output as Record<string, unknown>
  const projection = record.projection

  if (projection && typeof projection === "object") {
    return projection as SelectedProductsProjection
  }

  if ("product_response_policy" in record && "products" in record) {
    return record as unknown as SelectedProductsProjection
  }

  return null
}

function extractRoutineProjection(output: unknown): BuildOrFixRoutineProjection | null {
  if (!output || typeof output !== "object") return null
  const record = output as Record<string, unknown>

  return Array.isArray(record.steps) ? (record as unknown as BuildOrFixRoutineProjection) : null
}

function extractAdvisorGuidanceProjection(output: unknown): AdvisorGuidanceProjection | null {
  if (!output || typeof output !== "object") return null
  const record = output as Record<string, unknown>

  return Array.isArray(record.loaded_guidance_ids)
    ? (record as unknown as AdvisorGuidanceProjection)
    : null
}

function getToolOutputKey(name: string): string {
  if (name === "select_products") return "selected_products"
  if (name === "build_or_fix_routine") return "routine_plan"
  if (name === "load_advisor_guidance") return "advisor_guidance"
  return "terminal_answer"
}

function blockToolCall(
  call: AgenticModelToolCall,
  reason: AgenticBlockedToolCall["reason"],
): AgenticBlockedToolCall {
  return {
    id: call.id,
    name: call.name,
    reason,
  }
}

function isAllowedToolName(name: string): name is AgenticToolName {
  return ALLOWED_TOOLS.has(name as AgenticToolName)
}

function parseActiveTopic(value: unknown): "routine" | AgenticProductCategory | null {
  return value === "routine" ? "routine" : parseAgenticProductCategory(value)
}

function parseAgenticProductCategory(value: unknown): AgenticProductCategory | null {
  return typeof value === "string" && isAgenticProductCategory(value) ? value : null
}

function isAgenticProductCategory(value: string): value is AgenticProductCategory {
  return (AGENTIC_PRODUCT_CATEGORIES as readonly string[]).includes(value)
}

function toRoutineLayer(value: unknown): RoutineConversationLayer {
  return value === "basics" || value === "goals" || value === "problems" || value === "deep_dive"
    ? value
    : null
}

function parseTopicRelation(
  value: unknown,
): AgenticTerminalAnswer["state_patch"]["topic_relation"] {
  return value === "same_topic" ||
    value === "category_switch" ||
    value === "refinement" ||
    value === "recap" ||
    value === "unclear"
    ? value
    : "unclear"
}
