# THE.BEAUTIFUL.PEOPLE // Web App Design Guidelines

**Version:** 1.0
**Theme:** Edutainment, Rock 'n' Roll, Urban Grunge, High Contrast.

---

## 1. Brand Philosophy & Mood
**Context:** Based on "Brief / Moodboard from Tom"

The web application should feel like a backstage pass mixed with a masterclass. It bridges the gap between professional hair/beauty education and high-energy entertainment.

* **Core Vibe:** "Edgy," "Authentic," "Funny."
* **Aesthetic:** Urban Grunge meets Esports. Think Marilyn Manson poster art mixed with modern TikTok UI.
* **User Experience Goal:** The user should feel energized. Avoid sterile, corporate minimalism. Embrace "controlled chaos."

---

## 2. Color Palette
**Context:** Based on "CI Proposal"

The palette is dominated by a high-contrast "Hazard" theme (Yellow/Black), softened by off-white text and accented with a mystical purple.

### Primary Colors
| Color Name | Hex Code | RGB | Usage |
| :--- | :--- | :--- | :--- |
| **Warning Yellow** | `#FFBE10` | `255, 190, 16` | **Primary Action Color.** Buttons, links, highlighting key text, brush stroke backgrounds. |
| **Charcoal Black** | `#231F20` | `35, 31, 32` | **App Background.** Main surface color. Never use pure #000000; use this rich dark grey. |

### Secondary & Accents
| Color Name | Hex Code | RGB | Usage |
| :--- | :--- | :--- | :--- |
| **Off-White** | `#E9E6DE` | `233, 230, 222` | **Body Text.** Use on top of Charcoal Black. Softer on the eyes than pure white. |
| **Mystic Purple** | `#8052A0` | `128, 82, 160` | **Accent.** Secondary buttons, gradients, "Level 2" gamification elements. |

### Gradients
* **Purple Haze:** Linear gradient from `#8052A0` (Purple) to transparent/white. Used for subtle overlays on images.
* **Chrome/Silver:** Linear gradient (White to Grey to Black) used for metallic text effects.

---

## 3. Typography
**Context:** Based on "CI Proposal"

Typography is the loudest element of the brand.

### Header Font: **BEBAS NEUE**
* **Style:** Condensed, Bold, Uppercase.
* **Implementation:** `font-family: 'Bebas Neue', cursive;`
* **Usage:** Page Titles, H1-H3, "Shouting" text, Navigation Items.
* **Styling Note:** Often used with tight letter spacing or slightly rotated (-2deg to 2deg) to mimic posters.

### Body Font: **GOTHAM**
*(Fallback: Montserrat or Proxima Nova)*
* **Style:** Geometric Sans-Serif.
* **Weights:** Light (300), Book (400), Bold (700), Black (900).
* **Implementation:** `font-family: 'Gotham', 'Montserrat', sans-serif;`
* **Usage:** Paragraph text, UI labels, settings menus.

---

## 4. UI Components & Textures
**Context:** Based on "Slide Backgrounds & Textures" and "Graphical Moodboard"

**Do not use flat colors for containers.** The app needs texture.

### Backgrounds
* **The "Grunge" Base:** The app background should not be a flat hex code. Use the Charcoal Black `#231F20` with a subtle overlay of concrete texture, watercolor noise, or ink wash.
* **Card Containers:** Use dark purple or black ink-wash textures.

### Buttons & CTAs
* **Style:** Not rounded rectangles. Use "torn paper" edges or "brush stroke" shapes.
* **Primary Button:** Warning Yellow background, Black Bebas Neue text.
* **Hover State:** Slight rotation or a "paint splatter" expansion effect.

### Iconography (The "Doodles")
Replace standard SVG icons with hand-drawn marker styles (Black or Yellow strokes):
* **Arrows:** Scribbled, imperfect lines.
* **Emphasis:** Crowns (for user avatars), Stars (for favorites), Lightning Bolts (for trending).
* **Dividers:** Instead of `<hr>`, use white/yellow horizontal brush strokes.

---

## 5. Gamification & Mascots
**Context:** Based on "Graphical Element Development"

The "Lucky Cat" (Maneki-neko) is the dynamic mascot for user feedback and progress.

### Mascot States (The "Hot Tip" System)
Use these assets for success messages, tip pop-ups, or level progression:
1.  **Standard Mode:** Black Cat, Red Eyes, "Rock On" paw. (Basic UI helper).
2.  **Heating Up:** Purple Cat, Flame Aura. (Intermediate achievement/streak).
3.  **Super Mode:** Golden Cat, Raging Fire Background. (High achievement/Top tier).

---

## 6. Layout & Composition
**Context:** Based on "Example Layout"

* **Z-Index Layering:**
    1.  **Bottom:** Dark Textured Background.
    2.  **Middle:** "Splash" of Yellow paint/brush stroke.
    3.  **Top:** Subject (Video/Image/Avatar) + White Text.
    4.  **Overlay:** Hand-drawn scribbles (Arrows pointing to buttons).
* **Alignment:**
    * Text: Left-aligned or chaotic center.
    * Media: Off-center, overlapping the paint splashes.

---

## 7. Character Usage
**Context:** Based on "Character Element 'Tom'"

* **The Avatar:** Use the illustrated "Tom" character for system messages or empty states (e.g., "No internet connection").
* **Style:** Vector illustration, denim jacket, glasses. Avoid photorealistic stock photos for generic UI elements; use the illustration style.

---

## 8. CSS / Implementation Snippets

### Color Variables
```css
:root {
    --color-primary-yellow: #FFBE10;
    --color-bg-charcoal: #231F20;
    --color-text-offwhite: #E9E6DE;
    --color-accent-purple: #8052A0;
    --font-header: 'Bebas Neue', cursive;
    --font-body: 'Gotham', 'Montserrat', sans-serif;
}
```
