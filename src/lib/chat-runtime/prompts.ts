/**
 * Prompt for classifying the intent of a user message.
 * Returns JSON with intent, category, complexity, confidence, filters, and needs_clarification.
 */
export const INTENT_CLASSIFICATION_PROMPT = `Klassifiziere die Absicht der folgenden Nachricht. Antworte als JSON-Objekt mit sechs Feldern:

1. "intent" — genau EINE der folgenden Kategorien:
- product_recommendation: Der Nutzer fragt nach Produktempfehlungen, Produktvergleichen oder sucht nach bestimmten Haarpflegeprodukten
- hair_care_advice: Der Nutzer fragt nach allgemeinen Haarpflegetipps, Routinen oder Methoden
- diagnosis: Der Nutzer beschreibt ein Haarproblem und möchte eine Einschätzung oder Ursachenanalyse
- routine_help: Der Nutzer möchte Hilfe bei der Erstellung oder Optimierung einer Haarpflege-Routine
- ingredient_question: Der Nutzer fragt nach bestimmten Inhaltsstoffen, INCI-Listen oder deren Wirkung
- general_chat: Smalltalk, Begrüßung oder allgemeine Unterhaltung rund ums Thema Haar
- followup: Eine Folgefrage oder Präzisierung zu einer vorherigen Antwort

2. "category" — falls der Nutzer nach einem bestimmten Produkttyp fragt, genau EINE der folgenden:
- shampoo: Shampoo, Haarwäsche, Reinigung
- conditioner: Conditioner, Spülung
- mask: Haarmaske, Haarkur, Tiefenpflege
- oil: Haaröl, Kopfhautöl
- leave_in: Leave-in, Hitzeschutz, Styling-Produkt
- routine: Komplette Routine / mehrere Produkttypen
- null: Kein bestimmter Produkttyp erkennbar oder kein Produktintent

3. "complexity" — Komplexität der Anfrage:
- simple: Einfache, eindeutige Frage (z.B. "Was ist Silikon?", "Hallo!")
- multi_constraint: Mehrere Kriterien oder Einschränkungen (z.B. "Shampoo für fettige Kopfhaut und feines Haar")
- multi_hop: Erfordert mehrere Denkschritte oder Wissensverknüpfung (z.B. "Warum brechen meine Haare trotz Proteinbehandlung?")

4. "confidence" — Deine Sicherheit bei der Intent-Klassifikation als Zahl zwischen 0.0 und 1.0. Hohe Werte (>0.85) bei eindeutigen Anfragen, niedrige Werte (<0.6) bei vagen oder mehrdeutigen Nachrichten.

5. "filters" — Extrahiere vorhandene Informationen aus der Nachricht als Objekt:
- problem: Das konkrete Anliegen/Problem (oder null)
- duration: Seit wann das Problem besteht (oder null)
- products_tried: Bereits verwendete Produkte (oder null)
- routine: Aktuelle Pflegeroutine/Waschfrequenz (oder null)
- special_circumstances: Besondere Umstände wie Färben, Hitze, Schwangerschaft, Medikamente (oder null)

6. "needs_clarification" — true wenn die Nachricht zu vage ist für eine hilfreiche Antwort, false wenn genug Kontext vorhanden ist.

Antworte NUR mit validem JSON.
Beispiel: {"intent": "product_recommendation", "category": "shampoo", "complexity": "multi_constraint", "confidence": 0.85, "filters": {"problem": "fettige Kopfhaut", "duration": null, "products_tried": null, "routine": null, "special_circumstances": null}, "needs_clarification": true}

{{HISTORY_PREFIX}}Klassifiziere die folgende Nutzer-Nachricht:
{{MESSAGE}}`

/**
 * Prompt for generating a short German conversation title from the first message.
 */
export const TITLE_GENERATION_PROMPT = `Generiere einen kurzen, prägnanten deutschen Titel (maximal 5 Wörter) für eine Unterhaltung, die mit der folgenden Nachricht beginnt. Der Titel soll das Hauptthema erfassen.

Antworte NUR mit dem Titel, ohne Anführungszeichen oder zusätzliche Erklärung.

Nachricht: {{MESSAGE}}`

/**
 * Prompt for extracting durable memory from a conversation.
 * Used with GPT-4o-mini to update the user's cross-conversation memory.
 */
export const MEMORY_EXTRACTION_PROMPT = `Du bist ein Analyse-Assistent. Deine Aufgabe: Extrahiere aus dem folgenden Gespräch zwischen dem Haarpflege-Assistenten und dem Nutzer alle dauerhaften, persönlichen Fakten über den Nutzer.

Extrahiere NUR:
- Produkterfahrungen (was gut/schlecht funktioniert hat)
- Allergien, Unverträglichkeiten, Empfindlichkeiten
- Gesundheitliche Umstände (Schwangerschaft, Medikamente, Erkrankungen)
- Lebensstil-Faktoren (Sport, Ernährung, Beruf, Klima)
- Persönliche Vorlieben (Duft, Textur, Budget, Marken)
- Haargeschichte (Färbungen, chemische Behandlungen, große Veränderungen)
- Spezifische Reaktionen auf Inhaltsstoffe

Ignoriere:
- Smalltalk und Begrüßung
- Empfehlungen und Erklärungen des Assistenten (nur was der NUTZER sagt oder bestätigt)
- Einmalige Fragen ohne persönlichen Kontext
- Informationen die bereits im bestehenden Gedächtnis stehen

Format: Kompakte Stichpunktliste auf Deutsch. Jeder Punkt beginnt mit "- ".
Maximal 1500 Zeichen. Keine Überschriften, keine Nummerierung.

Wenn es nichts Neues zu extrahieren gibt, antworte mit: KEINE_NEUEN_FAKTEN`

export const MEMORY_EXTRACTION_JSON_PROMPT = `Du bist ein Analyse-Assistent für Chaarlie. Extrahiere dauerhafte, haarspezifische Erinnerungen aus einem Gespräch.

Antworte NUR als JSON:
{"memories":[{"kind":"preference|routine|product_experience|hair_history|progress|sensitivity|medical_context|other","memory_key":"stabiler_key","content":"deutscher Satz","evidence":"kurzes Nutzerzitat","confidence":0.0,"product_names":["..."],"sentiment":"positive|negative|neutral"}]}

Regeln:
- Speichere nur Fakten, die der NUTZER explizit sagt oder bestätigt.
- Speichere keine Empfehlungen, Erklärungen oder Annahmen des Assistenten.
- Speichere nur hair-care-relevante Fakten: Vorlieben, Routine, Produkterfahrungen, Haarhistorie, Fortschritt, Reaktionen, Sensitivitäten.
- Medizinisch angrenzende Fakten wie Haarausfall, Kopfhautbeschwerden, Schwangerschaft, Medikamente oder Allergien nur speichern, wenn der Nutzer sie explizit als relevant nennt.
- Keine Smalltalk-Fakten, keine allgemeinen Lebensdetails ohne Haarpflegebezug.
- Bei Produkterfahrungen setze product_names und sentiment. Negative sentiment bedeutet: Produkt nicht wieder priorisieren.
- memory_key muss stabil sein, z.B. "product:olaplex_no_3", "preference:duft", "routine:shampoo_frequency". Bei neuem Widerspruch denselben memory_key verwenden, damit die neueste Aussage gewinnt.
- Wenn nichts Neues speicherwürdig ist: {"memories":[]}.

{{EXISTING_MEMORY_SECTION}}

Gespräch:
{{TRANSCRIPT}}`
