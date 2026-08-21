# Tool-Fragen mit Bildkarten (Bürsten & Hitze-Tools)

**Datum:** 2026-08-21 · **Status:** Evidence review + Journey-Sign-off durch Nick bestätigt (Variante A)

## Problem

Nutzer-Feedback: Bei den Tool-Fragen sagen die Namen allein vielen Nutzern nichts
("Detangling-Bürste", "Heißluft-Multistyler"). Die bisherigen Lucide-Mini-Icons waren
generisch — mehrere Tools teilten fast dasselbe Symbol. Die Haarstruktur-Frage zeigt das
Zielmuster: Bild ansehen, Bild auswählen.

## Entscheidung (mit Nick abgestimmt)

- **Variante A — Bild-Grid** für alle drei Tool-Fragen (2-spaltiges Grid aus Foto-Karten,
  wie die Haarstruktur-Frage). Variante B (Foto-Zeilen, 64-px-Thumbnails) wurde im Mockup
  verglichen und verworfen: zu kleine Bilder für den Wiedererkennungs-Zweck.
- Betroffene Fragen:
  1. Onboarding `brush_type` — "Welche Bürsten oder Kämme nutzt du?"
  2. Onboarding `styling_tools` (HeatToolsScreen) — "Welche Hitzetools nutzt du?"
  3. Stage-2-Refinement `additional_heat_tools` — "Welche weiteren Hitze-Tools nutzt du?"
- "Nichts davon" bleibt jeweils im bestehenden Mechanismus (Refinement: Karte über volle
  Breite; Onboarding: bestehender Pill-Button). Keine Änderung an gespeicherten Werten,
  Frage-Logik oder DB.
- Mockup-Evidenz: Artifact "Tool-Fragen mit Bildern" (klickbarer A/B-Vergleich mit finalen
  Fotos), Review durch Nick am 2026-08-21.

## Assets

14 webp (1216×640, `public/images/tools/`), generiert mit Codex `image_gen`
(gpt-image, built-in mode) aus einem gemeinsamen Stil-Prompt: fotorealistischer Packshot,
einzelnes Objekt, heller Lavendel-Hintergrund `#f2eefa` (Plum-Ice), weicher Schatten,
matte Anthrazit-Materialien, keine Logos/Texte, 1024².

Nachbearbeitung (sharp): jedes 1024²-PNG auf eine 1946×1024-Leinwand (1,9:1) erweitert —
Basis ist das stark geblurte, gestreckte Bild selbst (Letterbox-Blur), Original mittig
komponiert — dann auf 1216×640 webp q82 verkleinert. Grund (Codex-Review-Finding): mit
quadratischen Assets schnitt `object-cover` auf breiten Karten bis ~50 % des Tools ab;
`object-contain` erzeugte sichtbare Kanten, weil der Foto-Hintergrund (Studio-Falloff)
nicht exakt Plum-Ice ist. Mit 1,9:1-Assets füllt `object-cover` jedes Media-Well
(Seitenverhältnis stets < 1,9) randlos, ohne das Tool je vertikal zu beschneiden.

Regenerier-Prompts (Stil-Block + je Tool) für Erweiterungen:

> Photorealistic product photography, single object only, centered, floating on a plain
> very light lavender studio background (hex #f2eefa, uniform, edge-to-edge, no gradient,
> no surface line), soft even studio lighting, one gentle soft shadow directly beneath the
> object, slight three-quarter viewing angle, high detail, realistic materials, no brand
> names, no logos, no text, no watermark, no props, no hands, square 1024x1024. Matte
> charcoal-gray/black plastic, handle pointing down, object fills ~70% of frame height.

| Datei | Tool-Prompt-Kern |
| --- | --- |
| wide_tooth_comb | wide-tooth comb, 8–10 thick rounded teeth, wide gaps, teeth down |
| detangling | palm-sized handleless detangling brush (Tangle-Teezer-like), two bristle lengths |
| paddle | large flat paddle brush, air-cushion pad, ball-tipped nylon pins |
| round | round-barrel blow-dry brush, bristles all around |
| boar_bristle | oval beech-wood brush, dense natural boar bristles |
| fingers | close-up of a hand, fingers spread, combing through loose brown hair (exception: hand allowed) |
| dryer_brush | hot-air dryer brush, thick oval bristled barrel, chunky vented handle |
| hot_air_styler | Airwrap-like multi-styler, slim barrel attachment, copper accent ring |
| straightener | flat iron slightly open in a narrow V, ceramic plates visible |
| curling_or_wave_iron | curling iron, long barrel, spring clamp, tip guard |
| thermal_rollers | three velcro-surface thermal rollers, loosely grouped |
| blow_dryer | classic handheld hair dryer, pistol grip |
| diffuser | standalone diffuser attachment, bowl interior with pins visible |
| wave_iron | triple-barrel waver, hinged upper arm |

## Implementierung

- `src/components/quiz/tool-visuals.ts` (neu): Bild-Maps + Beschreibungen für alle drei
  Fragen; Onboarding-Hitzetools teilen 4 Bilder mit dem Refinement-Set.
- `QuizOptionCard`: neues Prop `alwaysShowDescription` (nur Grid) — Beschreibung bleibt
  auf Mobile sichtbar, Karte füllt die Zeilenhöhe (`h-full`), sodass Karten einer Reihe
  trotz unterschiedlich langer Texte bündig abschließen. Bestehende Grid-Nutzer
  (Haarstruktur etc.) bleiben pixel-identisch.
- `RefinementOptions` + `MultiSelectScreen`: neues Prop `layout="grid"` reicht
  `visual`/`visualLayout` an `QuizOptionCard` durch; nur die drei Tool-Fragen nutzen es.
- `HeatToolsScreen`: Zeilen → Bild-Grid, bestehende Beschreibungen (Markenbeispiele) bleiben.
