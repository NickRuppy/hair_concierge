# Hair Concierge Quiz Flow – Screen-by-Screen Spezifikation
## Fuer Development-Team | Stand: 13. Februar 2026

---

## FLOW-UEBERSICHT (14 Screens)

```
1. Landing Page
2. Quiz: Haartextur
3. Quiz: Haarstaerke
4. Quiz: Oberflaechentest
5. Quiz: Zugtest
6. Quiz: Kopfhaut
7. Quiz: Chemische Behandlung
8. Quiz: Ziele (letzte Frage)
9. Lead Capture: Animated Checklist → Name → E-Mail
10. Analyse-Animation
11. Ergebnis / Haarprofil
12. Paywall
13. Payment
14. Welcome / Onboarding
```

---

## SCREEN 1: LANDING PAGE

**Typ:** Fullscreen, zentriert, CTA unten fixiert

**Headline:**
FINDE IN 2 MINUTEN HERAUS, WAS DEINE HAARE WIRKLICH BRAUCHEN

**Subheadline:**
Hair Concierge analysiert dein Haar und sagt dir, was DEINE Haare tatsaechlich brauchen.

**Bulletpoints (mit Checkmark-Icon):**
- Individuelle Analyse statt pauschaler Tipps
- Versteht Ursachen wie Proteinmangel, Trockenheit oder Kopfhautstress
- Bereitet deinen persoenlichen Pflegeplan vor

**CTA Button:** QUIZ STARTEN
**Subtext unter CTA:** Dauert ca. 2 Minuten. Du kannst nichts falsch machen.

---

## SCREEN 2: QUIZ – HAARTEXTUR
**Frage 1 von 7**

**Titel:** WAS IST DEINE NATUERLICHE HAARTEXTUR?

**Anleitung:**
Mach eine Straehne richtig nass – sie muss tropfnass sein. Halte sie am Ansatz fest, druecke sie oben zusammen und lass los. Schau, was passiert:

**Optionen (Single Select):**
| Option | Beschreibung | Emoji |
|--------|-------------|-------|
| Glatt | Es passiert nichts – die Straehne haengt einfach glatt runter | 〰️ |
| Wellig | Es bildet sich eine S-Kurve, aber keine richtige 3D-Windung | 🌊 |
| Lockig | Die Straehne formt sich zu einer deutlichen 3D-Locke | 🔄 |
| Kraus | Enge Windungen, die sich zusaetzlich in sich selbst drehen | 🌀 |


**Motivation:** Super, du bist gerade erst gestartet. Noch 6 kurze Fragen.

---

## SCREEN 3: QUIZ – HAARSTAERKE
**Frage 2 von 7**

**Titel:** WIE DICK SIND DEINE EINZELNEN HAARE?

**Anleitung:**
Nimm ein einzelnes Haar und halte es zwischen Daumen und Zeigefinger. Vergleiche es mit einem Naehfaden – das ist der beste Referenzpunkt.

**Optionen (Single Select):**
| Option | Beschreibung | Emoji |
|--------|-------------|-------|
| Fein | Kaum spuerbar – viel duenner als ein Naehfaden | 🪶 |
| Mittel | Spuerbar, aber nicht grob – aehnlich wie ein Naehfaden | ✋ |
| Dick | Fuehlt sich an wie Naehgarn – deutlich spuerbar und fest | 💪 |


**Motivation:** Top, schon ein gutes Stueck geschafft.

---

## SCREEN 4: QUIZ – OBERFLAECHENTEST
**Frage 3 von 7**

**Titel:** DER OBERFLAECHENTEST

**Anleitung:**
Nimm ein gewaschenes, trockenes Haar aus deiner Buerste – es darf kein Produkt mehr drauf sein. Schliesse die Augen und fahre ganz langsam mit zwei Fingern von der Wurzel zur Spitze. Konzentrier dich darauf, was du fuehlst:

**Optionen (Single Select):**
| Option | Beschreibung | Emoji |
|--------|-------------|-------|
| Glatt wie Glas | Keine Unebenheiten – die Finger gleiten gleichmaessig durch | ✨ |
| Leicht uneben | Kleine Huegel spuerbar, aber nicht durchgehend rau | 〽️ |
| Richtig rau und huckelig | Deutliche Hoehen und Tiefen – die Oberflaeche fuehlt sich kaputt an | 🏔️ |


**Motivation:** Klasse – du hilfst uns, deine Haare richtig einzuschaetzen.

---

## SCREEN 5: QUIZ – ZUGTEST
**Frage 4 von 7**

**Titel:** DER ZUGTEST

**Anleitung:**
Nimm dasselbe Haar. Klemm es zwischen Ringfinger und Zeigefinger auf der einen Seite und zwischen Ringfinger und Mittelfinger auf der anderen. Zieh jetzt vorsichtig – wirklich mit Gefuehl, nicht reissen. Beobachte genau, was passiert:

**Optionen (Single Select):**
| Option | Beschreibung | Emoji |
|--------|-------------|-------|
| Dehnt sich und geht zurueck | Es gibt nach, federt aber in den Ursprungszustand zurueck – dein Haar ist gut balanciert | 🎯 |
| Dehnt sich, bleibt ausgeleiert | Es gibt nach, kommt aber nicht mehr zurueck – wie ein ausgeleiertes Gummiband. Zeichen fuer Proteinmangel | 📏 |
| Reisst sofort | Es bricht bei leichtem Zug direkt ab – kaum Dehnung moeglich. Zeichen fuer Feuchtigkeitsmangel | ⚡ |


**Motivation:** Jetzt sind wir mitten in der Profi-Analyse.

---

## SCREEN 6: QUIZ – KOPFHAUT
**Frage 5 von 7**

**Titel:** WIE VERHAELT SICH DEINE KOPFHAUT?

**Anleitung:**
Sei ehrlich: Wie oft musst du wirklich waschen? Wenn nach einem Tag die Ansaetze fettig sind, ist deine Kopfhaut schnell fettend. Wenn du eine Woche ohne Waschen auskommst, ist sie eher trocken. Deine Gesichtshaut gibt dir einen guten Hinweis – oelige T-Zone deutet auf fettige Kopfhaut hin.

**Optionen (Single Select):**
| Option | Beschreibung | Emoji |
|--------|-------------|-------|
| Schnell fettend | Nach 1–2 Tagen sind die Ansaetze schon wieder platt und oelig | 💧 |
| Trocken / Schuppen | Spannt, juckt, trockene weisse Schuppen – Zeichen fuer gestoerte Hautbarriere | ❄️ |
| Fettig + gelbliche Schuppen | Fettet schnell UND schuppt – deutet auf Hefepilz hin, braucht spezielles Shampoo | 🌡️ |
| Unauffaellig | Kein Jucken, keine Roetung, kein auffaelliges Fetten – alles im gruenen Bereich | 👍 |


**Motivation:** Nur noch 2 Fragen – du machst das super.

---

## SCREEN 7: QUIZ – CHEMISCHE BEHANDLUNG
**Frage 6 von 7**

**Titel:** SIND DEINE HAARE CHEMISCH BEHANDELT?

**Anleitung:**
Chemische Prozesse wie Blondieren oder Faerben veraendern die innere Struktur deiner Haare grundlegend. Blondieren bricht Brueckenverbindungen auf und entzieht Protein – das muss in der Pflege ausgeglichen werden.

**Optionen (Multi Select):**
| Option | Beschreibung | Emoji |
|--------|-------------|-------|
| Naturhaar | Keine Farbe, kein Blondieren – unbehandelt | 🌿 |
| Gefaerbt / Getoent | Farbveraenderung, aber kein Aufhellen | 🎨 |
| Blondiert / Aufgehellt | Gebleacht, Straehnchen oder Balayage | ☀️ |


**Motivation:** Noch eine Frage – gleich siehst du dein Profil.

---

## SCREEN 8: QUIZ – ZIELE
**Frage 7 von 7**

**Titel:** WAS NERVT DICH AM MEISTEN?

**Anleitung:**
Waehle bis zu 3 Punkte – Hair Concierge richtet deinen Plan danach aus, was dich wirklich stoert.

**Optionen (Multi Select, max. 3):**
| Option | Emoji |
|--------|-------|
| Spliss / Haarbruch | 💔 |
| Frizz / fliegende Haare | 🌫️ |
| Kein Volumen | 📉 |
| Zu viel Volumen | 📈 |
| Glanzlos | 🌑 |
| Kopfhautprobleme | 🧴 |
| Haarausfall / Ausduennen | 💇‍♀️ |


**Motivation:** Letzte Frage – gleich siehst du dein persoenliches Haarprofil.

---

## SCREEN 9: LEAD CAPTURE
**3 Sub-Steps innerhalb eines Screens**

**Persistentes Banner (oben, auf allen 3 Steps sichtbar):**
Gruener Checkmark-Icon + "Dein persoenlicher Pflegeplan ist bereit!"
(Referenz: Screenshot 1+2 – gruenes Checkbox-Icon mit weissem Text)

### Step 9a: Name

**Banner:** [Gruener Checkmark] Dein persoenlicher Pflegeplan ist bereit!

**Titel:** WIE HEISST DU?

**Input:** Textfeld, Placeholder "Dein Vorname"
**CTA:** WEITER (disabled bis Feld nicht leer)

*(Kein Subtext, clean und minimal wie im Referenz-Screenshot)*

### Step 9b: E-Mail

**Banner:** [Gruener Checkmark] Dein persoenlicher Pflegeplan ist bereit!

**Titel:** DEINE E-MAIL ADRESSE

**Input:** E-Mail-Feld, Placeholder "name@beispiel.de"

**Trust-Hinweis (mit Schloss-Icon):**
🔒 Wir schuetzen deine Daten und nehmen Datenschutz sehr ernst – kein Spam.

**CTA:** WEITER (disabled bis valide E-Mail)

### Step 9c: Marketing Consent (Bottom-Sheet / Modal)

**Hintergrund:** Step 9b bleibt sichtbar aber gedimmt (opacity ~15%)

**Bottom-Sheet kommt von unten hoch mit:**

**Icon:** Briefumschlag-Icon (gelb, zentriert)

**Titel:** DUERFEN WIR DIR HAARPFLEGE-TIPPS SCHICKEN?

**Trennlinie:** Kurzer gelber Strich

**Untertitel (bold):** Experten-Tipps, Produkt-News und exklusive Angebote.

**Kleingedrucktes:** Du kannst dich jederzeit abmelden ueber den Link in unseren E-Mails. Unsere Datenschutzerklaerung findest du hier.

**CTA (Primary):** JA, WEITER ZU MEINEM PLAN
**CTA (Ghost/Link):** Nein, nur meinen Plan schicken

*(Referenz: Screenshot 3 – Bottom-Sheet-Overlay mit Consent-Abfrage)*

**Daten die hier erfasst werden:**
- name (string)
- email (string)
- marketing_consent (boolean)

---

## SCREEN 10: ANALYSE-ANIMATION

**Titel:** [NAME], DEIN PROFIL WIRD ERSTELLT
**Subtext:** Einen Moment noch...

**Animierte Steps (nacheinander, je ~1.2s):**
1. Haarstruktur wird analysiert ...
2. Protein-Feuchtigkeits-Balance wird berechnet ...
3. Dein persoenliches Profil wird erstellt ...

**UI:** Spinner oben, Checkmarks erscheinen nacheinander
→ Auto-Transition nach ~3.8s zu Screen 11

---

## SCREEN 11: ERGEBNIS / HAARPROFIL

**Titel:** [NAME], DEIN HAARPROFIL
**Subtext:** Basierend auf deinen Antworten sieht dein Profil so aus:

### Profil-Karten (dynamisch basierend auf Antworten):

**Karte 1 – HAARTYP** 🧬
Zusammengesetzter Label aus Staerke + Textur, z.B. "Feine, wellige Haare"

**Karte 2 – HAARSTAERKE** 📐
| Antwort | Ergebnis-Text |
|---------|--------------|
| Fein | Fein – braucht leichte, waessrige Produkte. Dicke Cremes druecken feine Haare platt, weil der Haardurchmesser zu gering ist. |
| Mittel | Mittel – gute Basis. Du kannst sowohl leichtere als auch reichhaltigere Produkte nutzen. |
| Dick | Dick – vertraegt reichhaltige Pflege mit hohem Oelanteil. Dickere Haare brauchen mehr Fett und Inhaltsstoffe. |

**Karte 3 – OBERFLAECHE** 🔬
| Antwort | Ergebnis-Text |
|---------|--------------|
| Glatt wie Glas | Deine Schuppenschicht ist intakt – die aeussere Haarschicht liegt glatt an. Beste Voraussetzung fuer Glanz. |
| Leicht uneben | Deine Schuppenschicht ist leicht aufgeraut. Ein guter Conditioner gleicht das aus. |
| Richtig rau und huckelig | Deine Schuppenschicht ist deutlich geschaedigt. Du brauchst einen dichteren Conditioner und ein gutes Leave-in. |

**Karte 4 – PROTEIN VS. FEUCHTIGKEIT** ⚖️
| Antwort | Ergebnis-Text |
|---------|--------------|
| Dehnt sich und geht zurueck | Dein Zugtest zeigt: Dein Haar dehnt sich und federt zurueck – die Balance stimmt. Du brauchst gute Basispflege, keinen speziellen Repair-Conditioner. |
| Dehnt sich, bleibt ausgeleiert | Dein Zugtest zeigt: Deine Haare sind ueberdehnt und gehen nicht zurueck. Das Protein hat nicht mehr genug Spannkraft. Du brauchst einen Protein-Conditioner als Hauptprodukt. |
| Reisst sofort | Dein Zugtest zeigt: Deine Haare reissen bei leichtem Zug sofort. Sie brauchen dringend Feuchtigkeit – Fettalkohole, Glycerin und feuchtigkeitsbindende Inhaltsstoffe. |

**Karte 5 – KOPFHAUT** 🧴
| Antwort | Ergebnis-Text |
|---------|--------------|
| Schnell fettend | Deine Kopfhaut fettet schnell – du brauchst ein klares, tiefenreinigendes Shampoo. Evtl. ein Saeurepeeling als Vorreinigung. |
| Trocken / Schuppen | Deine Kopfhaut ist dehydriert. Du brauchst ein mildes Shampoo und evtl. ein Serum mit Niacinamid und Ceramiden. |
| Fettig + gelbliche Schuppen | Fettige Kopfhaut plus Schuppen – das deutet auf Hefepilz. Du brauchst ein therapeutisches Anti-Schuppen-Shampoo. |
| Unauffaellig | Deine Kopfhaut ist unauffaellig – keine speziellen Massnahmen noetig. |

**Karte 6 – DEINE ZIELE** 🎯
Komma-separierte Liste der gewaehlten Ziele

### Aha-Moment Box:

**Titel:** WAS BISHER WAHRSCHEINLICH SCHIEF LIEF

| Zugtest-Ergebnis | Aha-Text |
|-------------------|----------|
| Dehnt sich, bleibt ausgeleiert (Protein) | Wahrscheinlich gibst du deinen Haaren gerade vor allem Feuchtigkeit. Aber dein Zugtest zeigt: Dir fehlt Protein. Deshalb fuehlen sich deine Haare nie richtig stabil an. |
| Reisst sofort (Feuchtigkeit) | Wahrscheinlich setzt du auf Repair-Produkte. Aber dein Zugtest zeigt: Dir fehlt Feuchtigkeit und Fett. Deshalb werden sie immer sproeder statt weicher. |
| Dehnt sich und geht zurueck (Balanciert) | Deine Balance stimmt – aber mit der richtigen Reihenfolge (Shampoo, Maske, dann Conditioner) holst du noch deutlich mehr raus. |

**Hoffnungs-Text (immer gleich):**
Das Gute: Deine Haare sind nicht hoffnungslos. Sie brauchen nur die richtige Reihenfolge aus Reinigung, Pflege und Schutz. Genau das baut Hair Concierge jetzt fuer dich.

**CTA:** DEINEN PLAN STARTEN

---

## SCREEN 12: PAYWALL

**Headline Variante A (Plan-Fokus):**
[NAME], HOL DIR DEINEN HAARPFLEGE-PLAN

**Headline Variante B (Experten-Fokus):**
DEIN HAAR-EXPERTE IN DER HOSENTASCHE

**Toggle:** Zwei Buttons "Plan-Fokus" / "Experten-Fokus" zum Wechseln

**Subheadline:**
Teste Hair Concierge 7 Tage komplett kostenlos. Jederzeit kuendbar. Danach 11,90 EUR alle 28 Tage.

**Benefits (3 Karten):**
| Icon | Titel | Beschreibung |
|------|-------|-------------|
| 📋 | Individueller Pflegeplan | Basierend auf deinem Profil und deinen Zielen |
| 🛒 | Konkrete Produkt-Empfehlungen | Drogerie und Profi, passend zu deinem Budget |
| 💬 | 24/7-Chat mit Hair Concierge | Fuer alle Fragen zu Waschen, Pflege und Styling |

**Preis-Card:**
- Label: 7 TAGE KOSTENLOS TESTEN
- Preis: 0 EUR fuer 7 Tage
- Subtext: Danach 11,90 EUR alle 28 Tage

**CTA:** 7 TAGE KOSTENLOS STARTEN
**Trust-Text:** Wir erinnern dich vor Ablauf. Keine versteckten Kosten, jederzeit kuendbar.
**Ghost-Link:** Vielleicht spaeter

---

## SCREEN 13: PAYMENT

**Titel:** ZAHLUNG ABSCHLIESSEN UND TEST STARTEN

**Info-Box:**
Heute zahlst du **0 EUR**. Deine Testphase endet am **[Datum +7 Tage]**. Danach 11,90 EUR alle 28 Tage. Jederzeit kuendbar.

**Formular-Felder:**
- Karteninhaber (Textfeld)
- Kartennummer (Textfeld)
- MM/JJ (Textfeld, halbe Breite links)
- CVC (Textfeld, halbe Breite rechts)

**CTA:** TEST STARTEN
**Trust-Text:** Verschluesselte Zahlung • Jederzeit kuendbar

---

## SCREEN 14: WELCOME / ONBOARDING

**Titel:** WILLKOMMEN, [NAME]

**Subtext:**
Dein Haarprofil ist gespeichert. Heute machen wir nur einen Schritt: Wir zeigen dir, wie du beim naechsten Waschen vorgehst.

**Naechste Schritte (3 Karten):**
| Icon | Text |
|------|------|
| 🚿 | 3-Minuten-Anleitung fuer deine naechste Haarwaesche |
| 💬 | Danach kannst du Hair Concierge jederzeit Fragen stellen |
| 📅 | In den naechsten Tagen bauen wir deinen Plan Schritt fuer Schritt auf |

**CTA:** ERSTEN SCHRITT ANSEHEN

---

## DESIGN-SPECS

**Farben:**
- Primary Yellow: #F5C518
- Yellow Dark: #D4A800
- Background: #0A0A0A
- Glass Background: rgba(255,255,255,0.07)
- Glass Border: rgba(255,255,255,0.11)
- Text Primary: #FFFFFF
- Text Secondary: rgba(255,255,255,0.6)
- Text Muted: rgba(255,255,255,0.38)

**Fonts:**
- Headlines: Bebas Neue
- Body: DM Sans (400, 500, 600)

**UI-Patterns:**
- Glassmorphism: backdrop-filter: blur(20px), semi-transparenter Background
- Active State: Gelber Gradient-Overlay, leichtes Scale (1.015)
- Buttons: Gelber Gradient (Primary), Underline-Text (Ghost)
- Progress Bar: Gelber Gradient, 3px Hoehe
- Cards: 16px Border-Radius, 13px 16px Padding
- Animations: Fade-in mit translateY(14px), 0.5s cubic-bezier
- Max-Width: 420px (Mobile-first)
- Screen-Height: 100dvh

**Daten die gespeichert werden muessen:**
- Quiz-Antworten (7 Felder): structure, thickness, fingertest, pulltest, scalp, treatment, goals
- Lead-Daten: name, email
- Zahlungsdaten: via Payment-Provider
