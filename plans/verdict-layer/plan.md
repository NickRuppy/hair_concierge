# Verdict-Schicht (Slice 3) — Plan Rev. 1

Datum: 2026-09-28 · Worktree: `.worktrees/verdict-layer` (`codex/verdict-layer`, Base `3a774a20` = origin/main nach Slice-1-Merge, verifiziert). Läuft PARALLEL zur Slice-2-Lane (`consult-agent`); Schreib-Scopes sind disjunkt (Authority/Vergleich/Preise vs. Brief-Generator); Merge-Reihenfolge: wer zuerst fertig ist, der andere rebased.

## 1. Outcome und Quellkontext

Programm-Plan Slice 3 (`plans/consult-runsheet/plan.md` auf main): Die Verdict-/Vergleichs-Schicht wird korrekt und call-tauglich — Masken-Pflegerichtung ehrlich statt Always-Pass, akzeptierte Sets sichtbar, Preise + Sortierung auf Alternativen, Frequenz-Delta-Chips, neutrale Cockpit-Stimme vollständig. Autorisierung: Nicks Interview-Rulings R12/R19 + „correct this then" + Beschleunigungs-Go für parallele Opus-Lanes (2026-09-28).

## 2. Bindende Rulings (geerbt)

- R12: `mask.care_direction`-Always-Pass (src/lib/personal-plan/products/authority/categories/mask.ts, axisResult) wird GLOBAL korrigiert — an die Conditioner-Semantik (`careDirectionAxisFitResult`) angeglichen; einzelne Mitglieder-Scan-Verdicts dürfen von „passt" zu „mit Einschränkung" kippen. Fixtures-first (author-cannot-verify-Regel: Rule-ID-Fixtures + adversariale Fälle).
- R19: Alternativen sortierbar nach Fit (Default) und Preis; Preis + Händler auf jeder Karte; Preis kippt NIE passt/passt-nicht. Budget-Band-Annotation bleibt geparkt.
- O4-Schließung: geteilte Verdict-Texte erhalten Cockpit-Varianten in neutraler dritter Person — als Anzeige-Override im Cockpit, die Teilnehmer-Strings (App/Scan) bleiben unverändert du-Stimme.
- Standing Rules: deterministische Logik TDD; Preis-Daten nur wo Katalog sie hat (dm-Enrichment ist eine ANDERE, geparkte Lane — kein neuer Datenimport hier).

## 3. Scope und Non-Goals

**Scope:** Authority-Fix Maske + akzeptiertes Set in der Zielspalte; Preise/Händler + Fit/Preis-Sortierung auf Cockpit-Swap-/Neu-Karten; Frequenz-Delta-Chips im Cockpit; neutrale Cockpit-Textvarianten. **Non-Goals:** keine Engine-Umstrukturierung (Slice 4), kein PDF (Slice 5), keine iOS-Änderungen (Info-Karten-Regeln bleiben; iOS-Parität der Zielspalte als Follow-up notieren), keine neuen Preisdatenquellen, keine Teilnehmer-Copy-Änderungen.

## 4. Zieltopologie

- Authority: `src/lib/personal-plan/products/authority/categories/mask.ts` (axisResult-Zweig `mask.care_direction`); Vergleich `comparison-dimensions.ts` (Ziel als akzeptiertes Set via `supported_stops` statt Einzel-Stop, wo die Regel mehrere akzeptiert); Anzeige `src/lib/mobile/result-presentation.ts` (targetValue-Label „X · Y ok") + Cockpit-Tabelle.
- Preise/Sortierung: Cockpit-Karten in `src/components/discovery/cockpit/` (StepDecision/Swap-Listen); Datenquelle `presentation.priceLabel`/`netContentLabel` aus den Vergleichs-Contracts — durchreichen, wo vorhanden; Sortier-Toggle (Fit | Preis) pro Alternativen-Liste, Fit = Default, Preis-Sort nur über Karten MIT Preis (ohne Preis ans Ende, stabil).
- Frequenz-Chips: pure Ableitung (neues Modul `src/lib/discovery/runsheet/frequency.ts`): Mapping Schritt-Kadenz-Prosa → numerisches Wochen-Band (verankert an Waschfrequenz: „nach jeder Haarwäsche" = Waschfrequenz; „1× pro Woche" = 1; „nach Bedarf"/„nach Herstellerangabe" = kein Band → kein Chip), Ist-Frequenz (Intake) vs. Band → Chip `zu oft | zu selten | passt`; Anzeige an gebundenen Produkteinträgen in Phase 3/4.
- Neutrale Stimme: Override-Map im Cockpit-Präsentationspfad (z. B. `discovery/cockpit-copy.ts`): du-Formen der geteilten Verdict-Kernsätze („Passt nicht zu deinem Haar" → „Passt nicht zu ihrem Haar", „Deine Kopfhaut…" → neutral) — NUR im Cockpit-Renderpfad angewandt; geteilte Quellen unberührt; nicht gemappte Strings fallen unverändert durch.

## 5. Entscheidungs-Coverage

Status: **confirmed**. Confirmed with Nick: R12, R19, O4-Richtung, Parallel-Lane-Go. Inherited: Verdict-Flip akzeptiert (R12-Ruling); Preis nie verdict-wirksam; Fixtures-first für Authority. Implementation defaults: Sortier-Toggle als lokaler UI-State; Kadenz-Band-Tabelle normativ im Code mit Fixture-Tests; Override-Map statt Fork der geteilten Copy; preislose Karten am Listenende bei Preis-Sort. Open consequential assumptions: none. Undiscussed consequential assumptions affecting this handoff: none.

## 6. Operator-Journey (Cockpit, admin-only)

Nick öffnet ein Enrollment: Masken-Vergleich zeigt ehrliche Pflegerichtung (✓ nur bei akzeptiert, Zielspalte nennt das Set); Karten tragen Preis + Händler wo vorhanden; über Alternativen-Listen ein Sortier-Toggle Fit|Preis; gebundene Produkte tragen Frequenz-Chip („2×/Wo · Ziel 1×/Wo → zu oft"); alle Cockpit-Sätze lesen sich in neutraler dritter Person. Teilnehmerinnen-Flächen: einzige Änderung ist die korrigierte Masken-Regel (Verdicts können ehrlicher/strenger werden) + Ziel-Set-Label in der geteilten Web-Vergleichsanzeige. Fehler-/Leerzustände: ohne Preisdaten keine Preiszeile, ohne Band kein Chip.

## 7. Geordnete Tasks

**T1 — Masken-Regel-Fix (fixtures-first, global).** Failing-Fixtures zuerst: Protein-Maske vs. Feuchtigkeits-Ziel ohne Repair-Bedarf → caution; MIT hohem Repair-Bedarf → akzeptiertes Set {Ziel, Protein} → pass; adversariale Fälle je Richtungspaar. Regel an `careDirectionAxisFitResult`-Semantik angleichen; `comparison-dimensions.ts` liefert das akzeptierte Set als `supported_stops`-Target, wo >1 akzeptiert; `result-presentation.ts`/Cockpit-Zielspalte rendert „A · B ok". Alle bestehenden Masken-Fixtures aktualisieren; benennen, welche Verdicts kippen (Report-Liste). Kriterium: Rule-ID-Fixtures grün, Kipp-Liste dokumentiert, volle Suite grün.

**T2 — Preise + Sortierung auf Alternativen.** `priceLabel`/Händler-Ableitung an die Cockpit-Swap-/Neu-Karten durchreichen; Sortier-Toggle Fit|Preis (Preis numerisch aus Label geparst; ohne Preis ans Ende, stabil); Fit bleibt Default. Tests: Karten mit/ohne Preis, Sortierstabilität, Toggle-Rendering. Kriterium: Nomi-artige Fixture zeigt Preise, Sortierung nachweisbar.

**T3 — Frequenz-Delta-Chips (pure, TDD).** `frequency.ts` Mapping-Tabelle + `deriveFrequencyDelta(entry, washFrequency)`; Fixtures: jede Kadenz-Prosa-Form, fehlende Intake-Frequenz (kein Chip), „Weiß ich nicht" (kein Chip), zu oft/zu selten/passt-Grenzen. UI: Chip an gebundenen Einträgen Phase 3 + Wochenzeilen Phase 4. Kriterium: Mapping total über die real vorkommenden Kadenz-Strings (aus dem Idealroutine-Code zitiert, nicht geraten).

**T4 — Neutrale Cockpit-Stimme (O4-Schließung).** Override-Map + Anwendung im Cockpit-Renderpfad; Inventar der im Cockpit sichtbaren du-Strings (grep-basiert, im Report gelistet); geteilte Quellen unverändert (Diff-Beweis). Tests: gemappte Strings neutral im Cockpit, Teilnehmer-Pfad unverändert (bestehende Scan-/Plan-Tests grün), unbekannte Strings unverändert. Kriterium: kein „dein/deine" mehr in Cockpit-eigener Darstellung außer Zitat-Kontexten (Referral-Text, „So sagst du es", Phase-1-Skript).

## 8. Verifikation

Automatisiert: neue Fixture-/UI-Suiten, volles `npm run ci:verify` auf finalem Baum; bestehende Scan-/Personal-Plan-Suiten als Regressionsnetz für den Authority-Fix. Manuell: Nicks Sammel-Walkthrough (nach Slice 2, wie vereinbart) deckt die Cockpit-Seite ab; die Masken-Kipp-Liste geht in den PR-Body, damit ein Stichproben-Scan möglich ist. Keine Migration.

## 9. Review & Handoff

SDD (Opus-Implementierer, Reviews pro Task), ein Codex-Whole-Branch-Review vor Push, /ship, Merge separat. Parallel-Lane-Regeln: keine Schreibzugriffe außerhalb der §4-Flächen; falls Slice 2 zuerst merged, vor Review auf origin/main rebasen. Artefakte: Plan committen; transienter Review-Output wird verworfen.
