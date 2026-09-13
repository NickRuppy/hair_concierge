# ChatGPT-Bildprompts – Scanner-Funnel

Vier Bilder. Zu jedem Prompt gehört ein Screenshot als Anhang (liegt daneben):
`screen-kamera.png` (Kamera-Sucher), `screen-passt-nicht.png` (Ergebnis „Passt nicht zu deiner Kopfhaut"), `screen-passt.png` (Ergebnis „Passt zu deinem Haar"). Alle drei sind 750 × 1514 px, also exakt das Seitenverhältnis eines Handy-Displays.

Vorgehen pro Bild: Screenshot anhängen, Prompt einfügen, Format Hochkant (1024 × 1536 bzw. 2:3). Wenn ChatGPT den Screen neu zeichnet statt ihn zu übernehmen, den letzten Absatz („Screen rule") noch einmal allein nachschicken.

---

## Shared style block (vor jeden Prompt setzen)

```
Photorealistic editorial photo, natural skin, soft warm light with a faint lavender tint, shallow depth of field, calm mood. German drugstore setting where mentioned. No readable text, no brand names, no logos anywhere except on the phone screen; bottle labels generic, plain or softly blurred. No watermark. Portrait 2:3.

Screen rule: the phone is a modern slim black-bezel smartphone. Its screen shows EXACTLY the attached screenshot, fitted edge to edge, in correct perspective for the phone's angle, with a faint realistic screen glow and a subtle reflection. Do not redraw, crop, translate, retype or alter any pixel or text of the screenshot. The screenshot's German text must stay exactly as it is.
```

---

## 1 · `regal-hand-phone` – Landing + Einfügung 1 (Anhang: `screen-passt-nicht.png`)

```
Eye-level shot in a German drugstore hair-care aisle. A woman in her late twenties (natural short nails, gold hoop earrings, dark knit coat) holds the phone upright, screen facing the camera, slightly right of center, at about 60 percent of the frame height. Behind her a shelf of shampoo and conditioner bottles in pastel and white generic packaging, softly out of focus. She looks at the camera with a small, knowing smile. The phone screen is fully visible, unobstructed and sharp.
```

## 2 · `regal-scan-flasche` – Einfügung 2 (Anhang: `screen-passt-nicht.png`)

```
Over-the-shoulder shot in the same drugstore aisle. Her right hand holds the phone almost horizontally, hovering 15 cm above a single generic white shampoo bottle that her left hand has just pulled from the shelf; a small barcode is visible on the bottle. The phone screen faces the camera at a slight angle and shows the attached screenshot. Focus on phone and bottle, shelf blurred behind.
```

## 3 · `bad-ablage` – Einfügung 3 (Anhang: `screen-passt.png`)

```
Bright morning bathroom. A tidy wooden shelf with four generic hair-care bottles in white, cream, sage and lavender, a small lavender sprig in a vase, a trailing plant at the edge. A hand in a soft lilac bathrobe sleeve holds the phone frontal in front of the shelf as if it had just scanned one of the bottles. Daylight from a window on the left. The phone screen is sharp and fully visible.
```

## 4 · `frau-regal-aha` – Landing Variante B (Anhang: `screen-kamera.png`)

```
A young woman, mid twenties, shoulder-length wavy brown hair, lilac knit sweater, canvas tote on her shoulder, standing in a drugstore aisle. She looks down at her phone with a relieved, knowing half-smile and holds a generic white shampoo bottle in her other hand, as if she has just scanned it. The phone is tilted toward her, screen partly visible to the camera and showing the attached screenshot. Shelves blurred behind her.
```

---

## Optional 5 · Hero-Bild Angebotsseite (Anhang: `screen-passt.png`)

```
Studio still life on a plain warm off-white background with a faint lavender gradient. A hand holds the phone perfectly frontal in the center of the frame, screen filling about half the image height, sharp and fully visible. Next to the hand, slightly out of focus, one generic white shampoo bottle. Soft top light, gentle shadow.
```

---

Ablage im Repo, wenn die Bilder da sind: `.tmp-previews/scanner-funnel/lifestyle/` (gleiche Dateinamen, PNG). Ich baue sie dann in den Prototyp ein und ersetze die schwebenden Demo-Karten durch die echten Screens.
