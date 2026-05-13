# Chat Test Prompts

Source session: `019dcafa-77f1-7800-a868-0b20dd8f0fb4`

Purpose: reusable prompts for future chat, agent-compare, and regression testing. These prompts were extracted from the shampoo-focused `select_products` and Compare Lab work in the source session, then extended with realistic follow-up cases.

## Prompt List: Shampoo

- `Welches Shampoo passt am besten zu mir?`
- `Wie soll ich mein Shampoo anwenden?`
- `Meine Längen sind trocken, brauche ich ein anderes Shampoo?`
- `Welches Shampoo macht meine Haare glänzender?`
- `Mein Ansatz fettet schnell, welches Shampoo soll ich nehmen?`
- `Vergleich mir bitte passende Shampoos.`
- `Welches Shampoo passt zu meinem feinen Haar, wenn der Ansatz schnell fettig wird?`
- `Ich habe Schuppen und meine Kopfhaut juckt, welches Shampoo soll ich nehmen?`
- `Mein Shampoo macht meine Haare platt, was soll ich ändern?`
- `Ich habe schnell fettigen Ansatz, aber trockene Spitzen. Welches Shampoo passt da?`
- `Brauche ich ein Tiefenreinigungsshampoo, wenn meine Haare stumpf und belegt wirken?`
- `Welches Shampoo ist gut für coloriertes Haar und empfindliche Kopfhaut?`

## Shampoo: Extracted From Session

| Prompt | Intent under test | Expected behavior | Notes from source session |
| --- | --- | --- | --- |
| `Welches Shampoo passt am besten zu mir?` | Generic shampoo product pick | Route as `product_pick/shampoo`; load `playbook:recommend_products`; call `select_products`; recommend only tool-selected products. | Appeared in the Shampoo QA pack and real-data smoke run. Earlier runs sometimes skipped the playbook, so keep this as a path-completeness check. |
| `Wie soll ich mein Shampoo anwenden?` | Usage/application question mentioning shampoo | Route as `usage`; load `playbook:usage_and_application`; do not call `select_products`. | Live Compare Lab run behaved correctly. It also showed the new wrong-kind guidance warning, which is useful trace coverage. |
| `Meine Längen sind trocken, brauche ich ein anderes Shampoo?` | Compare/decide question where shampoo may be the wrong lever | Redirect away from shampoo-first advice. Ideally still recognize `product_category: shampoo` so product-policy trace is visible. | Live answer behavior was good, but route trace missed `product_category: shampoo`, so no `select_products` or product-policy trace ran. Keep as a classifier hardening case. |
| `Welches Shampoo macht meine Haare glänzender?` | Product-pick wording where the stated goal is shine | Route as `product_pick/shampoo`; call `select_products`; return `not_recommended` with `product_response_policy: redirect_to_better_lever`; show no shampoo products. | Live run behaved very well and redirected toward conditioner, leave-in, surface, or styling levers. |
| `Mein Ansatz fettet schnell, welches Shampoo soll ich nehmen?` | Shampoo recommendation for oily roots | Route as `product_pick/shampoo`; carry `oily_roots`; load `overlay:oily_scalp`; call `select_products`; explain then recommend. | Live run mostly behaved correctly, but the answer still recommended normal/balanced-scalp shampoos with a weak caveat. Use to test whether oily-root concern should override a balanced scalp profile more strongly. |
| `Vergleich mir bitte passende Shampoos.` | Shampoo comparison | Route as `compare_or_decide`; load `playbook:compare_or_decide`; call `select_products`; expose useful `comparison_facts`. | Appeared in the saved Shampoo QA judgments. Path was correct, but product differentiation was weak. |
| `Welches Shampoo passt zu meinem feinen Haar, wenn der Ansatz schnell fettig wird?` | Example happy path for profile-grounded shampoo selection | Load profile context and relevant overlays, call `select_products("shampoo")`, preserve tool ranking, and explain 1-3 picks without inventing product logic. | Used in the session as the concrete example path for the clean split between tool, category logic, playbook, and overlays. |

## Shampoo: Additional Realistic Prompts

| Prompt | Intent under test | Expected behavior | Why this is useful |
| --- | --- | --- | --- |
| `Ich habe Schuppen und meine Kopfhaut juckt, welches Shampoo soll ich nehmen?` | Shampoo ask with flakes/itch and scalp sensitivity | Route with `dandruff_or_flakes` and/or `irritation`; be conservative; avoid over-medical certainty; recommend only if the product policy supports it. | Covers the dandruff/itch case called out in session notes, where the agent still risked recommending too casually. |
| `Mein Shampoo macht meine Haare platt, was soll ich ändern?` | Troubleshooting, likely fine hair or buildup | Route as `troubleshoot_hair_issue`; explain likely causes before products; only recommend shampoo if the user asks for a concrete replacement or trace supports it. | Tests whether the agent avoids jumping straight to product picking for a problem diagnosis. |
| `Ich habe schnell fettigen Ansatz, aber trockene Spitzen. Welches Shampoo passt da?` | Mixed oily-root and dry-length signals | Carry both `oily_roots` and `dry_lengths`; keep shampoo focused on the scalp while warning that lengths need conditioner/leave-in care. | Covers mixed symptoms, one of the follow-up seams mentioned in the session. |
| `Brauche ich ein Tiefenreinigungsshampoo, wenn meine Haare stumpf und belegt wirken?` | Compare/decide between regular shampoo and deep cleansing | Route as `compare_or_decide`; distinguish buildup/reset logic from everyday shampoo; avoid making deep cleansing a default frequent step. | Tests deep-cleansing routing and cadence caveats. |
| `Welches Shampoo ist gut für coloriertes Haar und empfindliche Kopfhaut?` | Product pick with color-treated hair plus sensitivity | Route as `product_pick/shampoo`; carry sensitivity caveats; prefer gentle/color-aware reasoning; avoid harsh cleansing unless clearly justified. | Realistic shopping prompt with two constraints that can conflict. |

## Prompt List: Conditioner

- `Welche Spülung passt zu meinem feinen Haar, ohne es zu beschweren?`
- `Mein Haar ist nach dem Waschen trocken und strohig, welchen Conditioner soll ich nehmen?`
- `Brauche ich eine proteinreiche Spülung oder lieber mehr Feuchtigkeit?`
- `Welche Spülung passt zu coloriertem, strapaziertem Haar?`
- `Meine Locken fühlen sich weich, aber frizzig an, welcher Conditioner hilft?`
- `Kann ich Conditioner nur in die Längen geben, wenn mein Ansatz schnell fettet?`
- `Vergleich mir bitte zwei passende Conditioner für feines Haar.`
- `Mein Conditioner macht die Haare platt, soll ich wechseln?`
- `Welche Spülung passt, wenn ich Spliss und trockene Spitzen habe?`
- `Wie oft sollte ich Conditioner verwenden, wenn meine Haare schnell überpflegt wirken?`

## Prompt List: Leave-In

- `Welches Leave-in passt zu meinen welligen Haaren gegen Frizz?`
- `Brauche ich ein Leave-in oder reicht Conditioner?`
- `Mein feines Haar braucht Pflege, wird aber schnell beschwert. Welches Leave-in passt?`
- `Welches Leave-in mit Hitzeschutz passt, wenn ich föhne oder glätte?`
- `Wie wende ich Leave-in richtig an, ohne fettige Längen zu bekommen?`
- `Meine Locken verlieren Definition am zweiten Tag, welches Leave-in hilft?`
- `Vergleich mir bitte ein Spray-Leave-in und eine Creme für meine Haare.`
- `Ich habe trockene Spitzen, aber normalen Ansatz. Brauche ich Leave-in?`
- `Welches Leave-in passt nach einer Blondierung?`
- `Sollte ich Leave-in auf nassem oder trockenem Haar verwenden?`

## Prompt List: Oil

- `Welches Haaröl passt zu meinem feinen Haar, ohne fettig auszusehen?`
- `Ich will meine Spitzen versiegeln, welches Öl soll ich nehmen?`
- `Soll ich Öl vor der Wäsche oder nach dem Styling verwenden?`
- `Meine Kopfhaut ist trocken und schuppig, hilft ein Öl?`
- `Ich habe schnell fettigen Ansatz. Ist Haaröl überhaupt sinnvoll?`
- `Welches Öl passt gegen Frizz bei lockigem Haar?`
- `Wie viel Öl soll ich in die Längen geben?`
- `Vergleich mir bitte ein leichtes Finish-Öl und ein Pre-Wash-Öl.`
- `Ich mache CWC oder OWC. Wo passt Öl in die Routine?`
- `Mein Haar ist coloriert und trocken. Ist Öl oder Leave-in besser?`

## Prompt List: Mask

- `Welche Haarmaske passt zu trockenem, strapaziertem Haar?`
- `Brauche ich eine Feuchtigkeitsmaske oder eine Proteinmaske?`
- `Wie oft sollte ich eine Maske verwenden, ohne mein Haar zu überpflegen?`
- `Welche Maske passt nach einer Blondierung?`
- `Meine Haare sind fein und trocken. Gibt es eine leichte Maske?`
- `Kann eine Maske Spliss reparieren oder nur kaschieren?`
- `Vergleich mir bitte eine Maske und einen Conditioner für meine Situation.`
- `Mein Haar fühlt sich weich, aber kraftlos an. Welche Kur passt?`
- `Welche Maske hilft bei Frizz und stumpfen Längen?`
- `Soll ich Maske vor oder nach Conditioner verwenden?`

## Prompt List: Bondbuilder

- `Brauche ich einen Bondbuilder nach einer Blondierung?`
- `Welcher Bondbuilder passt, wenn mein Haar brüchig ist?`
- `Ist Bondbuilder sinnvoll, wenn ich nur trockenes Haar habe?`
- `Wie oft sollte ich Bondbuilder verwenden?`
- `Kann ich Bondbuilder und Proteinmaske in derselben Routine nutzen?`
- `Vergleiche Bondbuilder und Haarmaske für geschädigtes Haar.`
- `Mein Haar ist fein und coloriert. Ist ein intensiver Bondbuilder zu viel?`
- `Welche Anwendung passt besser: vor dem Shampoo oder als Leave-in?`
- `Ich glätte oft. Brauche ich Bondbuilder oder Hitzeschutz?`
- `Woran merke ich, dass ein Bondbuilder nicht der richtige Hebel ist?`

## Prompt List: Deep-Cleansing Shampoo

- `Brauche ich ein Tiefenreinigungsshampoo bei Build-up?`
- `Wie oft sollte ich Tiefenreinigungsshampoo verwenden?`
- `Meine Haare sind stumpf und fühlen sich belegt an. Ist Tiefenreinigung sinnvoll?`
- `Kann ich Tiefenreinigungsshampoo bei trockener Kopfhaut verwenden?`
- `Welches Tiefenreinigungsshampoo passt zu schnell fettendem Ansatz?`
- `Sollte ich nach Tiefenreinigung immer eine Maske verwenden?`
- `Vergleiche normales Shampoo und Tiefenreinigungsshampoo für meine Routine.`
- `Ich nutze viel Stylingprodukt. Brauche ich regelmäßig Tiefenreinigung?`
- `Ist Tiefenreinigung gut vor einer Kur oder Farbe?`
- `Mein Haar ist blondiert und trocken. Sollte ich Tiefenreinigung vermeiden?`

## Prompt List: Dry Shampoo

- `Welches Trockenshampoo passt zu schnell fettendem Ansatz?`
- `Wie benutze ich Trockenshampoo, ohne weiße Rückstände zu bekommen?`
- `Ist Trockenshampoo schlecht für empfindliche Kopfhaut?`
- `Kann Trockenshampoo eine Haarwäsche ersetzen?`
- `Welches Trockenshampoo passt für dunkles Haar?`
- `Mein Ansatz wird nach Sport schnell fettig. Was ist sinnvoll?`
- `Vergleich mir bitte Trockenshampoo für Volumen vs. Öl-Kontrolle.`
- `Wie oft darf ich Trockenshampoo verwenden?`
- `Ich habe trockene Kopfhaut, aber der Ansatz sieht schnell platt aus. Soll ich Trockenshampoo nutzen?`
- `Hilft Trockenshampoo bei Geruch im Haar?`

## Prompt List: Peeling

- `Brauche ich ein Kopfhautpeeling bei Schuppen?`
- `Welches Peeling passt zu öliger Kopfhaut?`
- `Ist ein Säure-Peeling oder ein mechanisches Peeling besser für mich?`
- `Wie oft sollte ich Kopfhautpeeling verwenden?`
- `Kann Kopfhautpeeling bei juckender Kopfhaut helfen?`
- `Ich habe empfindliche Kopfhaut. Sollte ich Peeling vermeiden?`
- `Wo passt Peeling in meine Waschroutine?`
- `Vergleich mir bitte Kopfhautpeeling und Tiefenreinigungsshampoo.`
- `Meine Kopfhaut fühlt sich belegt an, aber die Längen sind trocken. Was tun?`
- `Kann ich Peeling und Schuppenshampoo kombinieren?`

## Recommended Additional Coverage

Beyond product picks, the test bank should exercise these user jobs:

- Routine structure: build a realistic plan, choose core vs optional steps, and respect routine preference.
- Routine debugging: simplify crowded routines, identify likely friction, and avoid adding more products by default.
- Usage, cadence, and order: answer "how exactly do I use this?" without turning it into product selection.
- Compare/decide: help the user choose a path, not just list options.
- Troubleshooting and safety: explain likely causes conservatively, especially for scalp symptoms or hair loss.
- Ingredients and claims: avoid myths, overclaiming, and unsupported ingredient certainty.
- Follow-ups and context: carry prior answers, profile details, and earlier constraints without re-asking.

## Prompt List: Routine Structure

- `Kannst du mir eine einfache Routine für Waschtage zusammenstellen?`
- `Was sollte meine minimale Haarpflege-Routine sein, wenn ich nur drei Produkte nutzen will?`
- `Wie sieht eine ausgewogene Routine für welliges, trockenes Haar aus?`
- `Welche Schritte sind bei meiner Routine wirklich Pflicht und welche optional?`
- `Ich wasche zweimal pro Woche. Wie sollte ich Shampoo, Conditioner und Leave-in einplanen?`
- `Baue mir bitte eine Routine für feines Haar, die nicht beschwert.`
- `Wie sollte meine Routine aussehen, wenn ich oft föhne und glätte?`
- `Kannst du meine Routine für Locken strukturieren?`
- `Ich will eine Routine gegen Frizz, aber ohne zehn Schritte. Was ist sinnvoll?`
- `Welche Routine passt, wenn mein Ansatz schnell fettet und die Spitzen trocken sind?`

## Prompt List: Routine Debugging

- `Meine Routine dauert zu lange. Was kann ich streichen?`
- `Ich nutze Shampoo, Conditioner, Maske, Leave-in, Öl und Hitzeschutz. Ist das zu viel?`
- `Meine Haare fühlen sich trotz Pflege trocken an. Wo könnte der Fehler in der Routine liegen?`
- `Meine Haare sind nach der Routine platt und belegt. Was sollte ich ändern?`
- `Ich bekomme Frizz, obwohl ich Leave-in und Öl nutze. Was läuft falsch?`
- `Meine Locken sehen am Waschtag gut aus, fallen aber am nächsten Tag zusammen. Was kann ich anpassen?`
- `Ich habe ständig Knoten in den Längen. Fehlt ein Schritt in meiner Routine?`
- `Meine Kopfhaut wird schnell fettig, seit ich mehr Pflegeprodukte nutze. Was sollte ich reduzieren?`
- `Ich benutze jede Woche eine Maske und Bondbuilder. Ist das zu viel Reparaturpflege?`
- `Meine Routine hilft nicht gegen trockene Spitzen. Welche Stellschraube würdest du zuerst prüfen?`

## Prompt List: Usage, Cadence, And Order

- `In welcher Reihenfolge nutze ich Shampoo, Maske, Conditioner und Leave-in?`
- `Wie oft sollte ich eine Haarmaske verwenden?`
- `Soll Conditioner vor oder nach der Maske kommen?`
- `Wie viel Leave-in ist für schulterlanges Haar realistisch?`
- `Soll ich Öl vor der Wäsche oder nach dem Styling verwenden?`
- `Wann benutze ich Hitzeschutz, wenn ich danach noch Leave-in nehme?`
- `Wie oft darf ich Tiefenreinigung machen, ohne meine Haare auszutrocknen?`
- `Wie lange sollte ich Conditioner einwirken lassen?`
- `Soll ich Stylingprodukte auf nassem oder handtuchtrockenem Haar auftragen?`
- `Wie baue ich Trockenshampoo ein, wenn ich nur alle drei Tage wasche?`

## Prompt List: Compare And Decide

- `Soll ich eher CWC oder OWC ausprobieren?`
- `Brauche ich Leave-in oder reicht ein guter Conditioner?`
- `Ist bei trockenem Haar eine Maske oder Öl sinnvoller?`
- `Soll ich Bondbuilder oder Proteinmaske nehmen?`
- `Was ist besser gegen Build-up: Kopfhautpeeling oder Tiefenreinigungsshampoo?`
- `Soll ich meine Routine vereinfachen oder ein Produkt ergänzen?`
- `Ist Frizz bei mir eher ein Pflege- oder Stylingproblem?`
- `Soll ich bei fettigem Ansatz häufiger waschen oder ein anderes Shampoo nehmen?`
- `Brauche ich Hitzeschutz, wenn ich nur lauwarm föhne?`
- `Soll ich erst meine Kopfhaut beruhigen oder zuerst die trockenen Längen behandeln?`

## Prompt List: Troubleshooting And Safety

- `Meine Kopfhaut juckt seit ein paar Wochen. Was kann ich ausprobieren?`
- `Ich verliere plötzlich deutlich mehr Haare. Kann ein Shampoo helfen?`
- `Meine Kopfhaut brennt nach dem Waschen. Was sollte ich tun?`
- `Ich habe Schuppen, aber auch eine trockene Kopfhaut. Wie unterscheide ich das?`
- `Meine Haare brechen ab. Liegt das an Trockenheit oder Schaden?`
- `Ich bekomme kleine Pickel am Haaransatz. Kann das von Produkten kommen?`
- `Meine Haare riechen schnell unangenehm. Was könnte dahinterstecken?`
- `Meine Kopfhaut ist rot und gereizt. Welche Pflege ist sicher?`
- `Kann zu viel Protein meine Haare härter und brüchiger machen?`
- `Meine Haare fühlen sich klebrig an, obwohl ich ausgespült habe. Was ist wahrscheinlich?`

## Prompt List: Ingredients And Claims

- `Sind Silikone schlecht für meine Haare?`
- `Soll ich Sulfate komplett vermeiden?`
- `Hilft Rosmarinöl wirklich gegen Haarausfall?`
- `Ist Keratin sinnvoll, wenn meine Haare trocken sind?`
- `Was bedeutet proteinfreie Pflege und brauche ich das?`
- `Sind Parabene in Haarpflege problematisch?`
- `Ist Biotin im Shampoo sinnvoll?`
- `Welche Inhaltsstoffe können bei empfindlicher Kopfhaut eher reizen?`
- `Was ist der Unterschied zwischen Feuchtigkeit und Reparatur in Haarpflege?`
- `Kann ein Shampoo Spliss reparieren?`

## Prompt List: Follow-Ups And Context

- `Und was davon soll ich zuerst ändern?`
- `Kannst du das auf eine Minimalroutine kürzen?`
- `Was wäre die günstigste Variante davon?`
- `Ich habe aber feines Haar. Ändert das deine Empfehlung?`
- `Ich wasche nur einmal pro Woche. Passt der Plan trotzdem?`
- `Kannst du mir das als Morgen- und Waschtag-Routine aufteilen?`
- `Was, wenn ich das Öl nicht vertrage?`
- `Welche Frage würdest du mir stellen, bevor du ein Produkt empfiehlst?`
- `Kannst du die Antwort ohne neue Produkte formulieren?`
- `Was wäre die nächste beste Alternative, wenn ich keine Maske verwenden will?`

## Regression Themes

- Do not turn usage questions into product recommendations just because they mention a product category.
- Do not recommend shampoo when the user's stated goal is better served by conditioner, leave-in, surface treatment, or styling.
- Keep `not_recommended` and `no_catalog_match` distinct in product-policy traces.
- Keep product-policy trace visible when a prompt explicitly mentions shampoo, even if the final answer redirects away from shampoo.
- Watch for profile/concern conflicts, especially oily-root asks against a balanced scalp profile.
- Treat flakes, irritation, and sensitivity conservatively; do not present medically adjacent scalp claims as hard product promises.
- Keep mixed-signal answers explicit: shampoo mainly treats scalp/cleansing needs, while dry lengths usually need conditioning or leave-in support.
