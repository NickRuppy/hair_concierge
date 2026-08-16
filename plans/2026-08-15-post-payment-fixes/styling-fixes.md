# Styling-Fix-Vorschläge — Post-Payment-Flow

Stand 2026-08-15. Alle Ursachen im Code verifiziert (file:line). Ausgenommen: Idealplan-Karten-Platzhalter (macht Nick selbst). Reine Vorschläge — noch nichts implementiert.

---

## 1. Vergleichstabelle: Label kollidiert mit Wert, Wörter brechen mitten im Wort (Major)

**Ursache** — `src/components/personal-plan-products/product-fit-comparison.tsx:1072–1143`:
- `<table className="w-full table-fixed …">` mit `<th className="w-[34%] px-2 …">` (Zeile 1075) neben `<td className="… px-1 …">` (1117): auf 375px hat die Label-Spalte ~103px Innenbreite. „Reinigungsintensität" (11px, semibold) füllt sie exakt aus → optisch 0px Abstand zum Wert.
- Alle Zellen nutzen `break-words` (= `overflow-wrap: break-word`), keine `hyphens` → „ausgegli/chen" ohne Trennstrich, einzelnes „n" in der Ziel-Spalte.
- Gleiche Struktur in der 3-Spalten-Variante (owned-only) ab ~Zeile 1305 (`w-[42%]`).

**Fix (empfohlen, klein):**
1. Atemraum zwischen Spalte 1 und 2: `th` (1098–1105) `px-2` → `pl-2 pr-3`, alle `td` `px-1` → `px-1.5`.
2. Saubere Trennung statt harter Brüche: auf dem `<table>`-Element `break-words` durch `hyphens-auto` ergänzen und `lang="de"` setzen (Tailwind: `[hyphens:auto]` falls kein Plugin; `lang` am `<section>` in 1062 reicht). `break-words` als Fallback behalten.
3. Schriftgröße der Label-Spalte auf 375px von `text-[11px]` auf `text-[10px]` — zusammen mit (1) reicht das, damit „Reinigungsintensität" einzeilig passt oder sauber mit Trennstrich bricht.

**Option B (größerer Eingriff, nur falls A nicht genügt):** unter `sm` auf ein 2-spaltiges Layout wechseln (Prüfpunkt + „Deins vs. Alternative" gestapelt, Ziel als kleine Zeile darunter). Mehr Aufwand, neue Mockup-Runde nötig — A zuerst probieren.

---

## 2. Footer-CTA „Jetzt auf meine Produkte abstimmen" ragt aus dem Viewport (Major)

**Ursache** — Kombination aus zwei Dateien:
- `src/components/ui/button.tsx:9`: Basisklasse enthält `whitespace-nowrap` → der lange Label-Text definiert die Mindestbreite des Buttons (~340px, kein Umbruch möglich).
- `button.tsx:19` (`funnelCta`): `w-full`.
- `src/components/personal-plan-start/need-plan-screen.tsx:67–94`: Flex-Row (`max-w-[430px]`, Container 351px auf 375px-Viewport) mit „Zur Basis" (72px) + Gap davor. Flex kann den CTA nicht unter seine nowrap-Mindestbreite schrumpfen → rechte Kante bei 443px.

**Fix (empfohlen):** am Button in `need-plan-screen.tsx:84–93`:
```tsx
<Button
  variant="funnelCta"
  className="min-w-0 flex-1 whitespace-normal px-4"
  …
>
```
`min-w-0` erlaubt Schrumpfen, `whitespace-normal` lässt das Label bei Bedarf zweizeilig umbrechen (die `min-h-14`-Pille verträgt das), `flex-1` füllt den Restplatz neben „Zur Basis".

**Zusätzlich empfohlen:** Label kürzen — „Auf meine Produkte abstimmen" (Zeile 59) sagt dasselbe und bleibt auf 375px einzeilig. Dann ist der Umbruch nur noch Sicherheitsnetz.

**Hinweis fürs Repo:** `whitespace-nowrap` in der Button-Basisklasse ist eine generelle Overflow-Falle bei langen deutschen Labels in Flex-Rows — bei Gelegenheit prüfen, ob es in die Varianten statt in die Basis gehört. Für jetzt reicht der lokale Override.

---

## 3. Kicker-Orphan: „…PRODUKT 1 VON / 8" (Cosmetic)

**Ursache** — `product-fit-comparison.tsx:132`: ein einziger Template-String
`` `${categoryLabel} · ${roleLabel} · Produkt ${reviewPosition} von ${reviewTotal}` `` — der Browser bricht vor der Zahl um.

**Fix:** im `ReviewHeader` (ab Zeile 331) den String aus Spans zusammensetzen und den Zähler unbrechbar machen:
```tsx
<p className="…">
  {categoryLabel} · {roleLabel} ·{" "}
  <span className="whitespace-nowrap">Produkt {reviewPosition} von {reviewTotal}</span>
</p>
```

---

## 4. „Mein Produkt trotzdem behalten" wirkt nicht klickbar (Cosmetic)

**Ursache** — `product-fit-comparison.tsx:274–284`: `variant="ghost"` (nur Hover-Hintergrund, `button.tsx:23`) + `text-muted-foreground` → grauer Fließtext in weißer Karte.

**Fix (empfohlen):** bewusst sekundär, aber als Aktion erkennbar — ghost behalten, Fläche geben:
```tsx
className="h-auto justify-start whitespace-normal rounded-[12px] border border-border bg-muted/30 px-3 py-3 text-left text-foreground/80 hover:bg-muted/60"
```
Damit bleibt die Hierarchie (Coral-CTA ≫ Behalten), aber der Behalten-Pfad ist als tappbare Karte lesbar. Der „Vorerst ohne Produkt fortfahren"-Link (Zeile 290–301) kann bleiben wie er ist — als dritter, schwächster Pfad ist Link-Styling korrekt.

---

## 5. Doppelter Header mit zwei Wortmarken auf /routine & /anwendung (Minor)

**Ursache** — zwei unabhängige Komponenten stapeln sich:
- App-Shell-Header (Wortmarke + Profil-Icon): `src/components/layout/personal-plan-navigation.tsx:31–45`, eingebunden über `authenticated-app-shell.tsx:29–52`.
- Plan-Header (zweite Wortmarke + „Gespeichert" + Stufenleiste): `src/components/personal-plan-journey/journey-header.tsx:18–120` (Grid `grid-cols-[44px_minmax(0,1fr)_7rem]`), von den Seiten selbst gerendert (`routine-page.tsx:110`, `application-page.tsx:178`, `personal-plan-routine-client.tsx:516`).

**Fix (empfohlen):** `journey-header.tsx` bekommt eine Prop `showWordmark` (default `true`). Auf /routine und /anwendung (wo die App-Shell schon brandet) wird sie `false` gesetzt → der Plan-Header wird zur schlanken Statusleiste: Stufenleiste volle Breite, „Gespeichert"-Badge rechts, Grid auf `grid-cols-[minmax(0,1fr)_7rem]`. Im Wizard (/plan-start, ohne App-Shell) bleibt alles wie heute. Spart ~56px Höhe auf Mobile und die doppelte Marke verschwindet, ohne dass irgendwo die Orientierung (Stufen/Speicherstatus) verloren geht.

---

## 6. Mobile Tab-Bar läuft auf Desktop volle 1440px (Minor)

**Ursache** — `personal-plan-navigation.tsx:47–76`: `fixed inset-x-0 bottom-0 … grid` mit `gridTemplateColumns: repeat(n, 1fr)`, keinerlei Breakpoint-Klassen. Wichtig: Die Tab-Bar ist die EINZIGE Navigation (Chat/Routine/Anwendung/Profil) — einfach `lg:hidden` würde Desktop navigationslos machen.

**Fix (empfohlen, sauber):**
1. Header-Links für Desktop: in den App-Header (Zeile 31–44) die vier Items als `hidden md:flex`-Linkzeile neben die Wortmarke setzen (gleiche `items`-Quelle, aktiver Zustand wie in der Tab-Bar).
2. Tab-Bar `md:hidden` (Zeile 49) und das kompensierende Body-Padding in `authenticated-app-shell.tsx:23–46` ebenfalls auf `md:` konditionieren.

**Quick-Win-Alternative (5 Minuten):** Tab-Bar auf Desktop als zentriertes Dock: `md:inset-x-auto md:left-1/2 md:w-[430px] md:-translate-x-1/2 md:rounded-t-2xl md:border-x`. Behebt das Gestretchte sofort, ohne Header-Arbeit — als Zwischenschritt okay, Variante 1 bleibt das Ziel.

---

## 7. Grammatik-Template „Weiteres Conditioner hinzufügen" (Minor)

**Ursache** — `src/components/personal-plan-products/index.tsx:696`: `Weiteres {categoryLabel} hinzufügen` ignoriert das Genus.

**Fix:** pro Kategorie fertiges Label statt Template (dort, wo `categoryLabel` herkommt, eine Map ergänzen):
| Kategorie | Label |
|---|---|
| Shampoo | Weiteres Shampoo hinzufügen |
| Conditioner | Weiteren Conditioner hinzufügen |
| Leave-in | Weiteres Leave-in hinzufügen |
| Öl | Weiteres Öl hinzufügen |
| Maske | Weitere Maske hinzufügen |
| Bondbuilder | Weiteren Bondbuilder hinzufügen |

Prop von `categoryLabel: string` auf `addMoreLabel: string` umstellen (oder Map im Component), damit das Genus nie wieder generisch zusammengesetzt wird.

---

## 8. Dev-Sprech & irreführender Zähler in Nutzertexten (Minor)

1. `src/lib/personal-plan/routine/product-detail-service.ts:72` und `:79` — „Die Eignung stammt aus dem eingefrorenen Routine-Stand." → **„Die Bewertung basiert auf deiner bestätigten Routine."**
2. `product-fit-comparison.tsx:667` — „…oder fahre ohne Produkt fort, wenn das hier erlaubt ist." → **„…oder fahre vorerst ohne Produkt fort."** (Ob es erlaubt ist, entscheidet die UI ohnehin — der Button erscheint nur dann.)
3. `src/components/routine/personal-plan/routine-page.tsx:135` — „Dein Idealplan mit 1 aktiven Produkt…" ist doppelt falsch: grammatisch („1 aktivem Produkt") und semantisch (`activeProductCount` in Zeile 102–104 zählt nur `executable`, d. h. bereits besessene Produkte — `editor.ts:51`). **Vorschlag:** beide Zahlen zeigen, weil beide relevant sind:
   ```
   Deine Routine mit {included} Produkten – {owned} davon hast du schon.
   ```
   `included` = alle `inclusion === "included"` (ohne `executable`-Filter), `owned` = heutiger Zähler. Bei `owned === 0`: „Deine Routine mit {included} Produkten."

---

## Umsetzungsreihenfolge (Vorschlag)

1. **#2 CTA-Overflow** + **#1 Tabellenkollision** — sichtbare Bugs im Kern-Flow, kleine Diffs.
2. **#7 Grammatik** + **#8 Copy** — reine String-Änderungen.
3. **#3 Orphan** + **#4 Affordance** — Kosmetik, je 1 Zeile.
4. **#5 Doppel-Header** + **#6 Desktop-Tab-Bar** — etwas mehr Struktur, eigener kleiner Branch.

Alle Punkte sind Bugfix/Polish am bestehenden Design (kein neuer Flow). Als Evidenz für die Gates: Vorher-Screenshots liegen in `screenshots/` (08, 15, 13, 14, 21, 26); nach Umsetzung jeweils Nachher-Screenshot auf 375px + 1440px gegenchecken.
