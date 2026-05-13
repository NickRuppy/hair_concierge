import type { BuildOrFixRoutineProjection } from "@/lib/agent/tools/build-or-fix-routine"
import type { CurrentTurnConflictContext } from "@/lib/agent/orchestrator/current-turn-context"
import type { SelectedProductsProjection } from "@/lib/agent/tools/select-products"
import type { ConversationState } from "@/lib/types"

export type AgenticAnswerCapsuleId =
  | "global.natural_consultant"
  | "context.current_turn_conflict"
  | "product.explain_prior_recommendation"
  | "product.recommendation_shape"
  | "product.usage_shape"
  | "product.caution_without_products"
  | "product.recommend_with_caveat"
  | "product.redirect_to_better_lever"
  | "category.conceptual_topology"
  | "category.bondbuilder.recommend"
  | "category.conditioner.recommend"
  | "category.deep_cleansing.recommend"
  | "category.dry_shampoo.guardrail"
  | "category.dry_shampoo.recommend"
  | "category.leave_in.heat_consolidation"
  | "category.leave_in.recommend"
  | "category.leave_in.usage"
  | "category.mask.optional_decision"
  | "category.oil.purpose_before_products"
  | "category.oil.recommend"
  | "category.peeling.recommend"
  | "category.peeling.scalp_guardrail"
  | "category.shampoo.recommend"
  | "category.shampoo.redirect"
  | "routine.broad_goal"
  | "routine.basics_next_choice"
  | "routine.category_overview"
  | "routine.existing_steps_anchor"
  | "routine.layered_answer"
  | "routine.adjacent_category_transition"
  | "routine.priority_context"
  | "routine.scalp_safety"
  | "followup.proactive_next_step"

export interface AgenticAnswerContext {
  capsule_ids: AgenticAnswerCapsuleId[]
  instructions: string[]
  examples: string[]
}

export interface AgenticAnswerContextToolCall {
  name: string
  input?: Record<string, unknown>
}

export interface BuildAgenticAnswerContextParams {
  latestUserMessage: string
  selectedProducts: SelectedProductsProjection | null
  routinePlan: BuildOrFixRoutineProjection | null
  toolCalls: AgenticAnswerContextToolCall[]
  conversationState: ConversationState | null | undefined
  currentTurnConflict?: CurrentTurnConflictContext | null
  currentTurnScalpSafety?: boolean
}

const CAPSULES: Record<AgenticAnswerCapsuleId, { instruction: string; example?: string }> = {
  "global.natural_consultant": {
    instruction:
      "Antworte wie eine ruhige Haarpflege-Beraterin: erst das aktuelle Nutzer-Delta, dann klar strukturiert und leicht erklaerend. Schliesse nicht generisch mit 'lass es mich wissen' oder leerem 'wenn du moechtest'; wenn du einen naechsten Schritt anbietest, formuliere genau eine konkrete Option. Keine internen Tool-, Trace-, Capsule-, Guidance- oder Policy-Woerter.",
  },
  "product.recommendation_shape": {
    instruction:
      "Bei Produktantworten zuerst in 1-2 Saetzen erklaeren, welcher Produkttyp fuer dieses Profil sinnvoll ist. Nutze selected_products.profile_basis und category_guidance fuer die Profil- und Kategorie-Einordnung; nutze products[*].supported_claims und comparison_facts fuer echte, belegte Produktunterschiede. Danach die Tool-Produkte als Optionen mit Entscheidungslogik rahmen: beste erste Wahl nach rank/Tool-Fakten, guenstigere/leichtere Alternative oder reichhaltigere/intensivere Option nur, wenn die Tool-Fakten das hergeben. Wenn die Tool-Fakten kaum echte Unterschiede zeigen, sage offen, dass die Optionen fachlich nah beieinander liegen, statt kuenstliche Unterschiede zu erfinden. Erklaere einen sinnvollen Unterschied pro Produkt aus supported_claims, comparison_facts, fit_reason oder caveat; keine flache interne Claim-Aufzaehlung und keine neuen Claims.",
    example:
      "Fuer deine Laengen suche ich hier eher einen mittelgewichtigen, intensiveren Conditioner. Von den Optionen ist X die guenstige Basis, Y sehr aehnlich, und Z etwas teurer.",
  },
  "product.explain_prior_recommendation": {
    instruction:
      "Wenn die Nutzerin fragt, warum eine vorherige Produktauswahl empfohlen wurde, erklaere aus selected_products.profile_basis, category_guidance, supported_claims und comparison_facts. Sage klar, welche Profil- oder Produktachsen die Empfehlung tragen. Wenn mehrere Produkte fachlich nah beieinander liegen, sage das offen. Keine neuen Claims und keine internen Trace-Woerter.",
  },
  "context.current_turn_conflict": {
    instruction:
      "Wenn die aktuelle Nachricht einer gespeicherten Routine sichtbar widerspricht und das die Empfehlung veraendert, erkenne es kurz und natuerlich auf Deutsch an. Nutze fuer diese Antwort die aktuelle Aussage. Verwende keine internen Woerter wie override, overlay, profile patch oder fallback, und bitte nur dann ums Profil-Aktualisieren, wenn es wirklich natuerlich hilfreich ist.",
    example:
      "In deinem gespeicherten Profil sehe ich noch weitere Schritte; wenn du aktuell aber nur Shampoo und Conditioner nutzt, waere der naechste sinnvolle Hebel ...",
  },
  "product.caution_without_products": {
    instruction:
      "Bei vorsichtigen Kopfhaut- oder Schuppenfaellen nicht als Sackgasse antworten. Erst kurz einordnen, dass Juckreiz, Reizung oder wiederkehrende Schuppen vorsichtig behandelt werden sollten; bei anhaltenden/starken Symptomen professionelle oder dermatologische Abklaerung nennen. Dann genau eine scharfe Rueckfrage stellen, die die naechste Produktauswahl ermoeglicht, z.B. ob es eher fettige/gelbliche Schuppen oder trockene kleine Schueppchen mit gereizter Kopfhaut sind.",
  },
  "product.usage_shape": {
    instruction:
      "Bei kombinierten Fragen wie welche Option passt und wie du sie verwendest, beantworte beide Teile: zuerst die passende Option/Produkttyp-Einordnung, dann Dosierung, Stelle im Ablauf, Laengen/Spitzen versus Ansatz und woran die Nutzerin merkt, dass es zu viel war.",
  },
  "product.recommend_with_caveat": {
    instruction:
      "Bei expliziten Produktfragen mit Caveat: erst den Wunsch respektieren und die Tool-Produkte nennen; dann knapp erklaeren, welcher Hebel fuer das Ziel wahrscheinlich staerker ist. Nicht wie eine Ablehnung formulieren.",
  },
  "product.redirect_to_better_lever": {
    instruction:
      "Wenn das Tool die Kategorie nicht als besten Hebel sieht, erst wertschatzend einordnen, was sie leisten kann; dann knapp den besseren Hebel nennen. Biete Produktempfehlungen nur als naechsten Schritt an.",
  },
  "category.conceptual_topology": {
    instruction:
      "Bei konzeptuellen Kategoriefragen diese Reihenfolge nutzen: direkte Antwort, Rolle der Kategorie, Profilgrund, praktische Anwendung oder Grenze, genau ein naechster Schritt. Bei Vergleichen mit zwei Kategorien immer mit einem klaren 'in deinem Fall eher X zuerst, Y optional fuer Z' enden, sofern die geladenen Guidance-/Profildaten das erlauben. Nicht sofort Produktlisten starten.",
  },
  "category.conditioner.recommend": {
    instruction:
      "Bei Conditioner erst kurz sagen, welcher Typ Conditioner gebraucht wird: Gewicht, Balance/Pflegeintensitaet und Rolle nach jeder Waesche. Danach die Optionen ueber echte Unterschiede vergleichen, z.B. Gewicht, Balance, Pflegeintensitaet, Preis nur nachgeordnet. Wenn mehrere Optionen dieselben Achsen teilen, sage das offen, nenne die erste Wahl nach Ranking, und formuliere die anderen als sehr nahe Alternativen statt dieselben Claim-Woerter zu wiederholen. Kopiere keine internen Claim-Zeilen.",
  },
  "category.shampoo.recommend": {
    instruction:
      "Bei Shampoo-Produktempfehlungen zuerst Kopfhaut/Reinigungsbedarf und Haardicke bzw. Gewichtssensitivitaet einordnen. Danach die Tool-Produkte ueber belegte Reinigungs-, Kopfhaut- oder Milde-Achsen vergleichen. Bei normalen Shampoo-Empfehlungen nicht ausweichen; nur bei Laengen-Zielen wie Glanz, Frizz oder trockenen Spitzen weich erklaeren, dass Conditioner, Leave-in, Maske oder Oel dort meist staerkere Hebel sind. Mit einem knappen Anwendungssatz enden: vor allem Kopfhaut, Laengen nur mit Schaumkontakt, gruendlich ausspuelen.",
  },
  "category.leave_in.heat_consolidation": {
    instruction:
      'Wenn Leave-in-Tooldaten Hitzeschutz stuetzen und das Profil schon separaten Hitzeschutz kennt: direkt anerkennen, dass der separate Hitzeschutz bleiben kann. Danach die Zwei-in-eins-Route mit der Formulierung "ein Produkt weniger in der Routine" erklaeren: Leave-in-Pflege plus Foehnschutz in einem Produkt.',
  },
  "category.leave_in.recommend": {
    instruction:
      "Bei Leave-in zuerst den benoetigten Typ erklaeren: Gewicht/Dichte-Fit und Rolle fuer Locken, Frizz, Finish oder Hitzeschutz nur, wenn Tool-Daten das stuetzen. Mache einen praktischen Vergleich ueber echte Unterschiede, nenne eine erste Wahl als Tendenz, und vermeide flache interne Faktenlisten.",
  },
  "category.leave_in.usage": {
    instruction:
      "Bei Leave-in-Anwendung den Wasch- oder Foehnrhythmus aus dem Profil natuerlich einbinden, wenn vorhanden. Nenne handtuchtrockenes Haar, Laengen/Spitzen, sparsame Menge, gleichmaessiges Verteilen und nicht ausspuelen.",
  },
  "category.mask.optional_decision": {
    instruction:
      "Bei Masken-Pflicht- oder Add-on-Fragen zuerst klar sagen: nicht Pflicht, sondern Zusatzpflege. Dann erklaeren, wann sie sich lohnt, wie sie zur bestehenden Routine passt, und dass konkrete Picks der naechste Schritt sein koennen.",
  },
  "category.oil.purpose_before_products": {
    instruction:
      "Bei konkreten Oel-Produktempfehlungen muss der Zweck klar sein: Finish/Glanz in Spitzen, Pre-Wash-Laengenschutz oder Kopfhaut-nahe Anwendung. Wenn selected_products needs_more_info fuer Oel-Zweck liefert, genau danach fragen.",
  },
  "category.oil.recommend": {
    instruction:
      "Bei Oel-Empfehlungen zuerst den Zweck nennen, den selected_products traegt: Finish/Glanz in Laengen und Spitzen oder Pre-Wash-Laengenschutz. Vergleiche Produkte nur ueber belegte Oel-Zweck-, Subtyp-, Gewichts- oder Fit-Achsen. Bei feinem Haar sparsam und laengenbezogen framen; bei fettigem Ansatz Oel nicht auf Ansatz oder Kopfhaut empfehlen. Nicht behaupten, dass Oel Spliss repariert, Schuppen loest oder die Kopfhaut behandelt.",
  },
  "category.bondbuilder.recommend": {
    instruction:
      "Bei Bondbuilder-Empfehlungen zuerst sagen, ob es ein gezielter Zusatz fuer strukturellen Schaden ist und nicht Basis-Pflege ersetzt. Nutze selected_products.profile_basis, category_guidance und comparison_facts fuer die Lane-Entscheidung: K18/Peptid-/Leave-in-Lane eher bei Bruch, Snapping, starker Hitze oder Laengsstruktur-Signalen; OLAPLEX/Epres/Crosslink-Lane eher bei Blondierung, Coloration oder chemischem Stress. Wenn die Tool-Fakten keine klare Lane tragen, sage offen, dass es ein optionaler Vergleich ist.",
  },
  "category.deep_cleansing.recommend": {
    instruction:
      "Bei Tiefenreinigungs-Empfehlungen als gelegentlichen Reset gegen Rueckstaende, Stylingfilm, Build-up oder schweres Haar framen, nicht als Alltagsshampoo und nicht als Kopfhautbehandlung. Nenne eine vorsichtige Frequenz nur allgemein und profilbezogen, z.B. gelegentlich oder nach Bedarf statt fixem Muss. Bei trockener, gereizter oder schuppiger Kopfhaut konservativ bleiben und nicht aggressiver reinigen lassen.",
  },
  "category.dry_shampoo.recommend": {
    instruction:
      "Bei Trockenshampoo-Empfehlungen als kosmetische Bruecke zwischen Waeschen framen: Es kann Oel optisch aufnehmen und Frische/Volumen geben, ersetzt aber keine Waesche. Vergleiche Produkte nur ueber belegte Format-, Farbfit-, Rueckstands-, Duft- oder Sensitivitaetsachsen. Anwendung knapp nennen: Ansatz, kurz einwirken lassen, ausbuersten oder einarbeiten.",
  },
  "category.dry_shampoo.guardrail": {
    instruction:
      "Bei Trockenshampoo ist die Kern-Caveat Pflicht: Es reinigt die Kopfhaut nicht, sondern absorbiert Fett nur optisch, und sollte spaeter mit normalem Shampoo und Wasser ausgewaschen werden. Nicht als Pflege, Behandlung, Kopfhautloesung oder dauerhaften Wasch-Ersatz darstellen; Caveat nur einmal natuerlich nennen.",
  },
  "category.peeling.recommend": {
    instruction:
      "Bei Kopfhautpeeling-Empfehlungen als gelegentliche kosmetische Build-up-/Schueppchen-Unterstuetzung fuer geeignete Kopfhaut framen, nicht als medizinische Behandlung. Erklaere Methode und Frequenz konservativ nach Kopfhaut-Toleranz; eher selten starten, nicht stark rubbeln, danach ausspuelen und normal reinigen, wenn die Produkt-/Anwendungsdaten das hergeben.",
  },
  "category.peeling.scalp_guardrail": {
    instruction:
      "Bei Peeling plus gereizter, sehr empfindlicher, brennender, schmerzender, entzuendeter, juckender oder schuppender Kopfhaut konservativ bleiben: kein starkes mechanisches oder chemisches Peeling empfehlen. Erst milde Kopfhaut-/Shampoo-Einordnung, nicht kratzen oder stark rubbeln, und bei anhaltenden oder starken Symptomen professionelle bzw. dermatologische Abklaerung nennen.",
  },
  "category.shampoo.redirect": {
    instruction:
      "Bei Shampoo fuer Laengen-Ziele ehrlich bleiben: Shampoo hilft vor allem Kopfhaut/Reinigung, aber Glanz, Glaettung und Frizz laufen meist staerker ueber Conditioner, Leave-in, Maske oder Oel.",
  },
  "routine.broad_goal": {
    instruction:
      "Bei breiten Zielen wie glatter/glaenzender nicht sofort die komplette Routine ausrollen. Erst die 2-3 wichtigsten Produkt-Lanes oder Hebel erklaeren und zeigen, welchen Zweck jeder Hebel hat.",
  },
  "routine.basics_next_choice": {
    instruction:
      "Bei Routine-Basics am Ende nicht generisch weitere Produktkategorien anbieten. Schliesse stattdessen mit genau einer natuerlichen Wahlfrage: ob die Nutzerin als Naechstes eher an ihren Zielen weiterarbeiten moechte oder an konkreten Problemen.",
  },
  "routine.category_overview": {
    instruction:
      "Bei breiten Fragen nach weiteren Produktkategorien die Routine-Basics als Ordnung nutzen, aber als natuerlichen Uebergang formulieren: 'Dann schauen wir zuerst auf die Basis.' Shampoo als Reinigung, Conditioner als Pflegeanker nach jeder Waesche, dann genau den autoritativen priority_context-Hebel als groessten Zusatzhebel. Am Ende fragen, ob die Nutzerin als naechstes nach Zielen oder Problemen weitergehen moechte.",
  },
  "routine.layered_answer": {
    instruction:
      "Bei Routineantworten nur die geladene Routine-Ebene beantworten. Basics, Ziele/Probleme und Deep-Dive nicht vermischen. Keine vollstaendige Routine neu starten, wenn die Nutzerin nur einen Baustein fragt.",
  },
  "routine.adjacent_category_transition": {
    instruction:
      "Wenn der Nutzer in einem Routine- oder Produktfolgegespraech fragt, warum andere Kategorien nicht dabei sind, beantworte es als Anschluss an die vorherige Empfehlung: Die genannten Kategorien sind nicht ausgeschlossen, sondern eine spaetere oder optionale Ebene. Erklaere kurz, warum die vorherige Empfehlung zuerst kam, und ordne die neuen Kategorien nur relativ dazu ein. Nicht als allgemeines Lexikon neu starten und keine Produktpicks anbieten, wenn der Nutzer nur die Routine-Logik klaert.",
    example:
      "Gute Nachfrage: Maske und Oel sind nicht falsch, ich wuerde sie nur nach dem Leave-in einordnen. Das Leave-in ist hier zuerst der Alltagshebel; Maske waere Zusatzpflege, Oel eher Finish oder Pre-Wash.",
  },
  "routine.existing_steps_anchor": {
    instruction:
      "Bei Routine-Basics zuerst anerkennen, was der Nutzer bereits macht. Schritte mit action=keep als vorhandenen Startpunkt formulieren; Schritte mit action=add als naechste sinnvolle Ergaenzung formulieren.",
  },
  "routine.priority_context": {
    instruction:
      "Bei breiten Routineantworten den gewaehlten dritten Routine-Hebel aus priority_context als autoritativ behandeln, aber seine Rolle erklaeren: Cleanup/Reset, Alltagshebel oder optionales Extra. Wenn priority_context.adjacent_levers einen Alltagshebel wie Leave-in nennt, kurz einordnen: Der gewaehlte Reset kann fuer Rueckstaende sinnvoll sein, waehrend Leave-in oder andere Alltagshebel die laufende Routine ergaenzen.",
  },
  "routine.scalp_safety": {
    instruction:
      "Bei aktuellen Juckreiz-, Reizungs-, Schuppen- oder trockene-Schueppchen-Faellen Routineantworten kopfhautschonend rahmen: keine Maske, kein Oel und keine Tiefenreinigung als Kopfhaut-Behandlung oder Beruhigung darstellen. Conditioner/Maske nur fuer Laengen/Spitzen nennen, wenn sie relevant sind. Fuer die Kopfhaut: mild reinigen, nicht stark rubbeln/kratzen, aggressive Peelings/Reset vorsichtig behandeln, und bei anhaltenden/starken Symptomen professionelle Abklaerung nennen.",
  },
  "followup.proactive_next_step": {
    instruction:
      "Wenn die Antwort nicht mit einer klaren Handlung endet, biete genau einen naheliegenden naechsten Schritt an, z.B. passende Produkte zeigen, Anwendung erklaeren oder den wichtigsten Hebel vertiefen. Nicht generisch mit 'lass es mich wissen' enden.",
  },
}

export function buildAgenticAnswerContext(
  params: BuildAgenticAnswerContextParams,
): AgenticAnswerContext {
  const capsuleIds: AgenticAnswerCapsuleId[] = ["global.natural_consultant"]
  const latestToolCall = params.toolCalls[params.toolCalls.length - 1]
  const latestUserJob =
    typeof latestToolCall?.input?.userJob === "string" ? latestToolCall.input.userJob : null

  if (
    !params.selectedProducts &&
    isDryShampooState(params.conversationState) &&
    hasDryShampooGuardrailFollowupIntent(params.latestUserMessage)
  ) {
    addCapsule(capsuleIds, "category.dry_shampoo.guardrail")
  }

  if (
    !params.selectedProducts &&
    hasConceptualCategoryIntent(params.latestUserMessage, params.conversationState)
  ) {
    addCapsule(capsuleIds, "category.conceptual_topology")
    addConceptualCategoryCapsules(capsuleIds, params.latestUserMessage)
  }

  if (
    !params.selectedProducts &&
    hasAdjacentCategoryTransitionIntent(params.latestUserMessage, params.conversationState)
  ) {
    addCapsule(capsuleIds, "category.conceptual_topology")
    addCapsule(capsuleIds, "routine.adjacent_category_transition")
  }

  if (params.currentTurnConflict?.routine_products.conflicts_with_saved) {
    addCapsule(capsuleIds, "context.current_turn_conflict")
  }

  if (params.selectedProducts) {
    addProductCapsules({
      capsuleIds,
      selectedProducts: params.selectedProducts,
      latestUserJob,
      latestUserMessage: params.latestUserMessage,
    })
    if (hasPriorRecommendationExplanationIntent(params.latestUserMessage)) {
      addCapsule(capsuleIds, "product.explain_prior_recommendation")
    }
  }

  if (params.routinePlan) {
    addCapsule(capsuleIds, "routine.layered_answer")
    if (params.currentTurnScalpSafety || hasScalpSafetyIntent(params.latestUserMessage)) {
      addCapsule(capsuleIds, "routine.scalp_safety")
    }
    if (params.routinePlan.steps.some((step) => step.action === "keep")) {
      addCapsule(capsuleIds, "routine.existing_steps_anchor")
    }
    const layer =
      typeof latestToolCall?.input?.layer === "string" ? latestToolCall.input.layer : null
    if (layer === "basics") {
      addCapsule(capsuleIds, "routine.basics_next_choice")
    }
    if (params.routinePlan.priority_context) {
      addCapsule(capsuleIds, "routine.priority_context")
    }
    if (hasBroadCategoryOverviewIntent(params.latestUserMessage)) {
      addCapsule(capsuleIds, "routine.category_overview")
    }

    if (layer === "goals" || hasBroadGoalIntent(params.latestUserMessage)) {
      addCapsule(capsuleIds, "routine.broad_goal")
    }
  }

  if (shouldOfferNextStep(params)) {
    addCapsule(capsuleIds, "followup.proactive_next_step")
  }

  return {
    capsule_ids: capsuleIds,
    instructions: capsuleIds.map((id) => CAPSULES[id].instruction),
    examples: capsuleIds.flatMap((id) => {
      const example = CAPSULES[id].example
      return example ? [example] : []
    }),
  }
}

function addProductCapsules(params: {
  capsuleIds: AgenticAnswerCapsuleId[]
  selectedProducts: SelectedProductsProjection
  latestUserJob: string | null
  latestUserMessage: string
}): void {
  const { capsuleIds, selectedProducts } = params

  if (selectedProducts.product_response_policy === "recommend_with_caveat") {
    addCapsule(capsuleIds, "product.recommend_with_caveat")
    addCapsule(capsuleIds, "product.recommendation_shape")
    if (params.latestUserJob === "usage" || hasUsageIntent(params.latestUserMessage)) {
      addCapsule(capsuleIds, "product.usage_shape")
    }
    if (selectedProducts.category === "shampoo") {
      addCapsule(capsuleIds, "category.shampoo.redirect")
    }
    addSelectedCategoryCapsules(capsuleIds, selectedProducts, params.latestUserMessage)
    return
  }

  if (selectedProducts.product_response_policy === "redirect_to_better_lever") {
    addCapsule(capsuleIds, "product.redirect_to_better_lever")
    if (selectedProducts.category === "shampoo") {
      addCapsule(capsuleIds, "category.shampoo.redirect")
    }
    return
  }

  if (selectedProducts.product_response_policy === "caution_without_products") {
    addCapsule(capsuleIds, "product.caution_without_products")
    return
  }

  const hasUsage = params.latestUserJob === "usage" || hasUsageIntent(params.latestUserMessage)
  if (hasUsage) {
    addCapsule(capsuleIds, "product.usage_shape")
    if (selectedProducts.category === "leave_in") {
      addCapsule(capsuleIds, "category.leave_in.usage")
    }
  }

  addCapsule(capsuleIds, "product.recommendation_shape")
  addSelectedCategoryCapsules(capsuleIds, selectedProducts, params.latestUserMessage)

  if (selectedProducts.category === "conditioner") {
    addCapsule(capsuleIds, "category.conditioner.recommend")
  } else if (selectedProducts.category === "leave_in") {
    addCapsule(capsuleIds, "category.leave_in.recommend")
    if (
      hasSupportedHeatProtection(selectedProducts) &&
      mentionsSeparateHeatProtection(selectedProducts)
    ) {
      addCapsule(capsuleIds, "category.leave_in.heat_consolidation")
    }
  } else if (
    selectedProducts.category === "mask" &&
    hasMaskDecisionIntent(params.latestUserMessage)
  ) {
    addCapsule(capsuleIds, "category.mask.optional_decision")
  } else if (
    selectedProducts.category === "oil" &&
    selectedProducts.decision === "needs_more_info"
  ) {
    addCapsule(capsuleIds, "category.oil.purpose_before_products")
  }
}

function addSelectedCategoryCapsules(
  capsuleIds: AgenticAnswerCapsuleId[],
  selectedProducts: SelectedProductsProjection,
  latestUserMessage: string,
): void {
  switch (selectedProducts.category) {
    case "shampoo":
      addCapsule(capsuleIds, "category.shampoo.recommend")
      break
    case "oil":
      addCapsule(capsuleIds, "category.oil.recommend")
      break
    case "bondbuilder":
      addCapsule(capsuleIds, "category.bondbuilder.recommend")
      break
    case "deep_cleansing_shampoo":
      addCapsule(capsuleIds, "category.deep_cleansing.recommend")
      break
    case "dry_shampoo":
      addCapsule(capsuleIds, "category.dry_shampoo.recommend")
      addCapsule(capsuleIds, "category.dry_shampoo.guardrail")
      break
    case "peeling":
      addCapsule(capsuleIds, "category.peeling.recommend")
      if (
        hasScalpSafetyIntent(latestUserMessage) ||
        mentionsSensitiveScalpContext(selectedProducts)
      ) {
        addCapsule(capsuleIds, "category.peeling.scalp_guardrail")
      }
      break
  }
}

function addConceptualCategoryCapsules(
  capsuleIds: AgenticAnswerCapsuleId[],
  latestUserMessage: string,
): void {
  const normalized = normalizeText(latestUserMessage)
  if (mentionsDryShampoo(normalized)) {
    addCapsule(capsuleIds, "category.dry_shampoo.guardrail")
  }
  if (
    mentionsPeeling(normalized) &&
    (hasScalpSafetyIntent(latestUserMessage) || mentionsSensitiveScalpText(normalized))
  ) {
    addCapsule(capsuleIds, "category.peeling.scalp_guardrail")
  }
}

function shouldOfferNextStep(params: BuildAgenticAnswerContextParams): boolean {
  if (params.selectedProducts?.product_response_policy === "redirect_to_better_lever") return true
  if (params.selectedProducts?.decision === "needs_more_info") return false
  const latestToolCall = params.toolCalls[params.toolCalls.length - 1]
  const layer = typeof latestToolCall?.input?.layer === "string" ? latestToolCall.input.layer : null
  if (params.routinePlan && layer === "basics") return false
  if (params.routinePlan && params.selectedProducts === null) return true
  if (hasMaskDecisionIntent(params.latestUserMessage)) return true
  return params.conversationState?.pending_offer != null
}

function addCapsule(capsuleIds: AgenticAnswerCapsuleId[], capsuleId: AgenticAnswerCapsuleId): void {
  if (!capsuleIds.includes(capsuleId)) {
    capsuleIds.push(capsuleId)
  }
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

function hasUsageIntent(message: string): boolean {
  return (
    /\b(benutz\w*|anwend\w*|verwend\w*|dosier\w*|wie oft|wann|reihenfolge|ausspuel\w*|ausspul\w*)\b/.test(
      normalizeText(message),
    ) || /\bwende\b.*\ban\b/.test(normalizeText(message))
  )
}

function hasPriorRecommendationExplanationIntent(message: string): boolean {
  const normalized = normalizeText(message)
  return (
    /\bwarum\b/.test(normalized) &&
    /\b(?:schlaegst|schlagst|empfiehlst|empfohlen|diese|die|proteinlastig|produkte?|conditioner|spuelung|spulung|leave in|leavein|shampoo|maske|kur|oel|ol|oil)\b/.test(
      normalized,
    )
  )
}

function hasScalpSafetyIntent(message: string): boolean {
  return /\b(?:juck|gereizt|brennt|schuppen|schuppchen|schueppchen|dandruff|flakes|kopfhaut)\b/.test(
    normalizeText(message),
  )
}

function mentionsSensitiveScalpText(normalizedText: string): boolean {
  return /\b(?:empfindlich|sensibel|sensitive|irritiert|irritation|entzuendet|entzundet|schmerz|brenn)\b/.test(
    normalizedText,
  )
}

function mentionsSensitiveScalpContext(selectedProducts: SelectedProductsProjection): boolean {
  const text = [
    ...selectedProducts.profile_basis,
    selectedProducts.category_guidance,
    selectedProducts.policy_reason,
  ].join("\n")
  return mentionsSensitiveScalpText(normalizeText(text))
}

function mentionsDryShampoo(normalizedText: string): boolean {
  return /\b(?:trockenshampoo|dry[-_ ]?shampoo)\b/.test(normalizedText)
}

function isDryShampooState(conversationState: ConversationState | null | undefined): boolean {
  return (
    conversationState?.active_topic === "dry_shampoo" ||
    conversationState?.last_product_category === "dry_shampoo"
  )
}

function hasDryShampooGuardrailFollowupIntent(message: string): boolean {
  const normalized = normalizeText(message)
  return /\b(?:statt\s+waschen|waschen|benutzen|verwenden|anwenden|wie\s+oft|taeglich|taglich|jeden\s+tag|ersetzen|ersatz|auswaschen)\b/.test(
    normalized,
  )
}

function mentionsPeeling(normalizedText: string): boolean {
  return /\b(?:peeling|kopfhaut[-_ ]?peeling|scalp[-_ ]?(?:scrub|exfoliat))\b/.test(normalizedText)
}

function hasMaskDecisionIntent(message: string): boolean {
  return (
    /\b(maske|kur)\b/.test(normalizeText(message)) &&
    /\b(pflicht|muss|brauche|notwendig|noetig|notig|hilft|weglassen)\b/.test(normalizeText(message))
  )
}

function hasBroadGoalIntent(message: string): boolean {
  return /\b(glatt|glaenz|glanz|shine|frizz|gesuender|gesunder)\b/.test(normalizeText(message))
}

function hasConceptualCategoryIntent(
  message: string,
  conversationState: ConversationState | null | undefined = null,
): boolean {
  const normalized = normalizeText(message)
  const hasConceptualQuestion =
    /\b(wichtig|sinnvoll|gut|brauche|noetig|notig|integrier\w*|hilft|stattdessen|unterschied|oder|nehmen|entscheiden|vergleich\w*|dazu)\b/.test(
      normalized,
    )
  if (!hasConceptualQuestion) return false

  const mentionsCategory =
    /\b(leave[-_ ]?in|leavein|conditioner|spuelung|spulung|maske|kur|shampoo|trockenshampoo|dry[-_ ]?shampoo|oel|ol|bond[-_ ]?builder|bondbuilder|bond[-_ ]?repair|k18|kr18|olaplex|epres|tiefenreinigung|deep[-_ ]?cleansing|reinigungsshampoo|peeling|kopfhaut[-_ ]?peeling)\b/.test(
      normalized,
    )
  if (mentionsCategory) return true

  return (
    conversationState?.active_topic === "leave_in" ||
    conversationState?.active_topic === "conditioner" ||
    conversationState?.active_topic === "mask" ||
    conversationState?.active_topic === "shampoo" ||
    conversationState?.active_topic === "oil" ||
    conversationState?.active_topic === "bondbuilder" ||
    conversationState?.active_topic === "deep_cleansing_shampoo" ||
    conversationState?.active_topic === "dry_shampoo" ||
    conversationState?.active_topic === "peeling" ||
    conversationState?.last_product_category != null
  )
}

function hasAdjacentCategoryTransitionIntent(
  message: string,
  conversationState: ConversationState | null | undefined = null,
): boolean {
  const normalized = normalizeText(message)
  const mentionsCategory =
    /\b(leave[-_ ]?in|leavein|conditioner|spuelung|spulung|maske|kur|shampoo|trockenshampoo|dry[-_ ]?shampoo|oel|ol|bond[-_ ]?builder|bondbuilder|bond[-_ ]?repair|k18|kr18|olaplex|epres|tiefenreinigung|deep[-_ ]?cleansing|reinigungsshampoo|peeling|kopfhaut[-_ ]?peeling)\b/.test(
      normalized,
    )
  if (!mentionsCategory) return false

  const asksAboutInclusion =
    /\b(nicht\s+dazu|auch\s+dazu|dazu|fehlt|fehlen|weggelassen|weglassen|nicht\s+inkludiert|nicht\s+dabei)\b/.test(
      normalized,
    )
  if (!asksAboutInclusion) return false

  return (
    conversationState?.active_topic === "routine" ||
    conversationState?.active_topic === "leave_in" ||
    conversationState?.active_topic === "conditioner" ||
    conversationState?.active_topic === "mask" ||
    conversationState?.active_topic === "oil" ||
    conversationState?.active_topic === "bondbuilder" ||
    conversationState?.active_topic === "deep_cleansing_shampoo" ||
    conversationState?.active_topic === "dry_shampoo" ||
    conversationState?.active_topic === "peeling" ||
    conversationState?.last_product_category != null ||
    conversationState?.routine_layer != null
  )
}

function hasBroadCategoryOverviewIntent(message: string): boolean {
  const normalized = normalizeText(message)
  return (
    (/\b(andere|weiter\w*|zusaetzlich|zusatzlich|noch|ergaenz\w*|erganz\w*)\b/.test(normalized) &&
      /\b(produkt\w*|kategorie\w*|shampoo|routine)\b/.test(normalized)) ||
    /\b(?:was|welche?s?)?\s*(?:sollte|soll|kann|koennte|konnte|könnte)\s+ich\s+noch\s+(?:hinzuf(?:u|ue)g\w*|ergaenz\w*|erganz\w*|dazunehmen|nehmen)\b/.test(
      normalized,
    ) ||
    /\bwhat\s+else\s+(?:should|can|could)\s+i\s+(?:add|use|try)\b|\banything\s+else\s+(?:to\s+)?(?:add|use|try)\b/.test(
      normalized,
    )
  )
}

function hasSupportedHeatProtection(products: SelectedProductsProjection): boolean {
  return products.products.some((product) =>
    product.supported_claims.some(
      (claim) =>
        claim.field === "heat_protection" &&
        !/^(?:false|no|nein|none|keine?|without|ohne)$/i.test(claim.value.trim()),
    ),
  )
}

function mentionsSeparateHeatProtection(products: SelectedProductsProjection): boolean {
  const text = [...products.profile_basis, products.category_guidance].join("\n")
  return /\b(separat\w*\s+hitzeschutz|bereits\s+hitzeschutz|eigener\s+hitzeschutz)\b/i.test(text)
}
