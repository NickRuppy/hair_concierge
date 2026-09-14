const areas = {
  opening: {
    label: "Einstieg nach dem Quiz",
    description: "#534 zeigt den Scanner-Nutzen sofort mit einem kompakten Profil; #535 beginnt mit einem ausführlicheren Profil und einer Diagnose, bevor der Scanner eingeführt wird."
  },
  profile: {
    label: "Persönlicher Kontext",
    description: "#534 leitet eine kurze Profilzeile und Scanner-Kriterien aus Quizantworten ab. #535 arbeitet mit Profil-Chips, Diagnosekarten und einer festen Ermutigung."
  },
  proof: {
    label: "Scanner-Beweis und Vertrauen",
    description: "#534 bündelt Scanner-Demo (hier als Standbild) und App-Einblicke. #535 zeigt Regalbild, ein großes Ergebnisbeispiel und das neue Steffi-Video. Hinweis: Ergebnisbild und Erklärung sind in Jonas’ Vorlage noch nicht konsistent."
  },
  pricing: {
    label: "Preisdarstellung",
    description: "#534 integriert den geteilten Checkout-Preisslot; #535 illustriert einen lokalen Monats-/Jahreswähler. Die Vorschau führt keine echte Zahlung aus."
  },
  unknown: {
    label: "Wenn ein Produkt unbekannt ist",
    description: "#534 beschreibt Kategorie wählen, Prüfung und Nachricht im Chat. #535 verspricht ein Verpackungsfoto und E-Mail binnen 48 Stunden; das weicht vom aktuellen Ablauf ab."
  },
  footer: {
    label: "Rechtlicher Abschluss",
    description: "#534s betrachtete Angebotsfläche endet ohne den gemeinsamen Legal-Footer. #535 zeigt Impressum, AGB, Widerruf, Kontakt und Cookie-Einstellungen."
  },
  mobile: {
    label: "Mobile CTAs",
    description: "#534 nutzt einen oberen Angebotslink und eine finale CTA. #535 ergänzt einen WhatsApp-Kontakt und eine feste untere CTA, sobald der Preisbereich nach oben aus dem Sichtfeld läuft."
  },
  quiz: {
    label: "Quiz-Vorbereitung",
    description: "#534 enthält zehn Fragen und drei antwortabhängige Scanner-Beispiele. #535 skizziert ein anderes Quiz mit Fortschritt, interaktivem Beispielscan und Produktanzahl-Frage."
  },
  handover: {
    label: "Trial-Handover: Vorschläge im Text",
    description: "Dies ist kein bestehender Checkout: links stehen die bestätigten Leitplanken des separaten Trial-Plans, rechts Jonas’ vorgeschlagene Trial- und Erinnerungsbegriffe."
  },
  measurement: {
    label: "Integration und Messung · Textvergleich",
    description: "Hier geht es um die Übergabe hinter der Oberfläche: vorhandene Route und Events links, vorgeschlagene neue Events rechts. Es werden keine Events ausgelöst."
  },
  full: {
    label: "Ganze Seiten",
    description: "Die vollständigen statischen Seiten helfen, Dichte, Reihenfolge und Umfang zu beurteilen. Die Bereiche oben fokussieren jeweils die relevante Passage."
  }
};

const nickFrame = document.querySelector("#nick-frame");
const jonasFrame = document.querySelector("#jonas-frame");
const nickLink = document.querySelector("#nick-full-link");
const jonasLink = document.querySelector("#jonas-full-link");
const description = document.querySelector("#area-description");
const context = document.querySelector("#comparison-context");
const tabs = [...document.querySelectorAll("[data-area]")];

function selectArea(area) {
  area = Object.hasOwn(areas, area) ? area : "opening";
  const content = areas[area];
  nickFrame.src = `nick.html?area=${area}`;
  jonasFrame.src = `jonas.html?area=${area}`;
  nickLink.href = "nick.html?area=full";
  jonasLink.href = "jonas.html?area=full";
  description.textContent = content.description;
  context.textContent = content.label;
  tabs.forEach((tab) => tab.setAttribute("aria-current", String(tab.dataset.area === area)));
  const url = new URL(window.location.href);
  url.searchParams.set("area", area);
  history.replaceState({}, "", url);
}

tabs.forEach((tab) => tab.addEventListener("click", () => selectArea(tab.dataset.area)));
selectArea(new URLSearchParams(window.location.search).get("area") || "opening");
