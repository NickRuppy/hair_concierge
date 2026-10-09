// Planning fixture only. No real catalog, persistence, recommendation engine or analytics.
// Revision 49 (2026-10-08): adversarial design-review fixes on top of the rev-48 live-app look.
const app = document.querySelector("#app")
const scenario = document.querySelector("#scenario")
const failNext = document.querySelector("#fail-next")
const hint = document.querySelector("#review-hint")
const route = location.pathname
const consulting = route === "/beratung"
const cockpit = route === "/cockpit"
const direct = route === "/direkt"
const scanner = route === "/scanner"
document.body.classList.toggle("consulting", consulting)
document.body.classList.toggle("cockpit", cockpit)
document
  .querySelectorAll(".review-links a")
  .forEach((a) => a.pathname === route && a.setAttribute("aria-current", "page"))

const budgets = {
  cheap: { label: "Bis 5 €", ceiling: 5 },
  middle: { label: "Bis 15 €", ceiling: 15 },
  open: { label: "Keine feste Preisgrenze", ceiling: null },
}
// One reason string for the same exception on every surface.
const REASON = "Passt beim Pflegegewicht deutlich besser als die Option im Budget."
const hints = {
  "/": "Personal Plan: letzter Produktschritt → Budget → Shampoo → Conditioner → Maske → Routine. Szenarien wechseln Vorschlag, Gespeichert, Strikt/Flexibel und Fehlerfälle.",
  "/beratung": "Beratungs-Vorbereitung: Deine Produkte → Budget → Deine Routine → Hitze & Styling.",
  "/cockpit":
    "Call-Cockpit, Phase 3. Szenarien: Strikt · …, Flexibel · …, Ohne Preisgrenze. Budget direkt im Panel ändern.",
  "/direkt":
    "Direkt übernehmen ohne Produkteingabe: Vorschlag → Budget (falls fehlt) → angepasster Vorschlag → Übernahme.",
  "/scanner":
    "Einzelscan: gescanntes Produkt, dann Alternativen. Gespeichertes flexibles Budget vs. kein Budget („Keine Produkte / kein Budget“).",
}
let state
const euro = (value) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(value)
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  )

// Owned products captured in Stage 3. Prices are canonical catalog package prices used only for
// the inference rule (point 30); they are never shown to the user as "what you paid".
const ownedFixtures = {
  "clear-signal": [
    { id: "shampoo-8", category: "Shampoo", name: "Feuchtigkeits-Shampoo", price: 8 },
    { id: "conditioner-10", category: "Conditioner", name: "Glanz-Conditioner", price: 10 },
    { id: "mask-14", category: "Maske", name: "Repair-Maske", price: 14 },
  ],
  "mixed-signal": [
    { id: "shampoo-4", category: "Shampoo", name: "Mild-Shampoo", price: 4 },
    { id: "conditioner-4", category: "Conditioner", name: "Basis-Conditioner", price: 4 },
    { id: "mask-25", category: "Maske", name: "Intensiv-Maske", price: 25 },
  ],
  "low-signal": [
    { id: "shampoo-3", category: "Shampoo", name: "Mild-Shampoo", price: 3 },
    { id: "conditioner-4", category: "Conditioner", name: "Basis-Conditioner", price: 4 },
    { id: "mask-5", category: "Maske", name: "Pflege-Maske", price: 5 },
  ],
  "no-products": [],
}
ownedFixtures.journey = ownedFixtures["clear-signal"]

function inferredBudget(products) {
  const seenIds = new Set()
  const distinct = products.filter((product) => {
    if (product.tool) return false
    if (!product.id) return true
    if (seenIds.has(product.id)) return false
    seenIds.add(product.id)
    return true
  })
  const priceable = distinct.filter(
    (product) =>
      product.id && product.category && Number.isFinite(product.price) && product.price > 0,
  )
  const categories = new Set(priceable.map((product) => product.category))
  const coverage = distinct.length ? priceable.length / distinct.length : 0
  if (priceable.length < 3 || categories.size < 2 || coverage < 0.8) return null
  if (priceable.some((product) => product.price > 15)) return null
  const inLowBand = priceable.filter((product) => product.price <= 5).length / priceable.length
  if (inLowBand >= 0.8) return "cheap"
  const inMiddleBand =
    priceable.filter((product) => product.price > 5 && product.price <= 15).length /
    priceable.length
  if (inMiddleBand >= 0.8) return "middle"
  return null
}

const ROLES = [
  {
    key: "Shampoo",
    heading: "Wähle dein Shampoo",
    eyebrow: "Shampoo · Hauptreinigung",
    keep: "Mein Shampoo behalten",
    skip: "Ohne neues Shampoo weiter",
    none: "kein geprüftes Shampoo",
    to: "zum Shampoo",
  },
  {
    key: "Conditioner",
    heading: "Wähle deinen Conditioner",
    eyebrow: "Conditioner · Pflege nach der Wäsche",
    keep: "Meinen Conditioner behalten",
    skip: "Ohne neuen Conditioner weiter",
    none: "keinen geprüften Conditioner",
    to: "zum Conditioner",
  },
  {
    key: "Maske",
    heading: "Wähle deine Maske",
    eyebrow: "Maske · Intensivpflege",
    keep: "Meine Maske behalten",
    skip: "Ohne neue Maske weiter",
    none: "keine geprüfte Maske",
    to: "zur Maske",
  },
]

function reset(value = "journey") {
  scenario.value = value
  failNext.checked = false
  hint.textContent = hints[route] ?? ""
  state = {
    screen: direct ? "direct-proposal" : scanner ? "scanner" : consulting ? "owned" : "capture",
    choice: null,
    flexChoice: null,
    saved: null,
    askedThisSession: false,
    error: null,
    selected: null,
    alternative: 1,
    step: 0,
    picks: [],
    mode: "new", // new | edit (single role in an accepted routine) | draft (remaining roles)
    accepted: null,
    editing: false,
    editOrigin: null,
    refresh: false,
    savedRevision: 1,
    proposalRevision: null,
    draftSelections: null,
    conflictPending: false,
    inferred: null,
    pendingEdit: null,
    frequency: 2,
    justAccepted: false,
    adjusted: null,
    cockpitEdit: false,
  }
  state.inferred = inferredBudget(ownedFixtures[value] ?? ownedFixtures.journey)
  if (value === "no-products") state.inferred = null
  if (state.inferred) state.choice = state.inferred
  if (!["journey", "clear-signal", "mixed-signal", "low-signal", "no-products"].includes(value)) {
    state.choice = value === "open" ? "open" : "cheap"
    state.flexChoice = value.startsWith("flex") ? "flex" : "strict"
    state.saved = {
      budget: state.choice,
      flexibility: state.choice === "open" ? null : state.flexChoice,
    }
    state.screen = consulting ? "owned" : direct ? "direct-proposal" : "products"
    chooseDefault()
  }
  if (value === "saved-reuse" || (value === "shortcut" && direct)) {
    state.saved = { budget: "middle", flexibility: "flex" }
    state.choice = "middle"
    state.flexChoice = "flex"
    state.screen = direct ? "direct-proposal" : consulting ? "owned" : "capture"
  }
  if (value === "existing-edit") {
    state.saved = null
    state.choice = null
    state.flexChoice = null
    state.accepted = routineFor(null).map((p) => ({ ...p, legacy: true }))
    state.screen = "summary"
  }
  if (["mid-edit", "save-conflict", "stale-refresh"].includes(value)) {
    state.saved = { budget: "cheap", flexibility: "strict" }
    state.draftSelections = [
      {
        category: "Shampoo",
        name: "Sanftes Basis-Shampoo",
        price: 4.45,
        quantity: "250 ml",
        tier: "Drogerie",
        tone: "sage",
      },
      { category: "Maske", name: null, price: null },
    ]
    state.screen = "draft-summary"
    if (value === "save-conflict") {
      state.editing = true
      state.editOrigin = "draft-summary"
      state.choice = "middle"
      state.flexChoice = "flex"
      state.conflictPending = true
      state.screen = "flexibility"
    }
    if (value === "stale-refresh") {
      state.saved = { budget: "middle", flexibility: "strict" }
      state.savedRevision = 2
      state.proposalRevision = 1
      state.refresh = true
      state.mode = "draft"
      state.step = 2
      state.screen = "products"
      chooseDefault()
    }
  }
  if (cockpit) {
    const cockpitScenario = [
      "strict-many",
      "strict-one",
      "strict-zero",
      "flex-fit",
      "flex-gap",
      "open",
    ].includes(value)
      ? value
      : "flex-fit"
    scenario.value = cockpitScenario
    state.saved = {
      budget: cockpitScenario === "open" ? "open" : "cheap",
      flexibility:
        cockpitScenario === "open" ? null : cockpitScenario.startsWith("flex") ? "flex" : "strict",
    }
    state.choice = state.saved.budget
    state.flexChoice = state.saved.flexibility
    state.screen = "cockpit"
  }
  if (scanner) {
    state.saved = value === "no-products" ? null : { budget: "middle", flexibility: "flex" }
    state.screen = "scanner"
  }
  render(true)
}

function currentBudget() {
  return state.saved ? budgets[state.saved.budget] : null
}
function ceiling() {
  return currentBudget()?.ceiling ?? null
}
function isOver(price) {
  return ceiling() !== null && price !== null && price !== undefined && price > ceiling()
}
function budgetText(saved = state.saved) {
  if (!saved) return "Noch kein Budget gespeichert"
  if (saved.budget === "open") return "Ohne feste Preisgrenze"
  const limit = budgets[saved.budget].ceiling
  return saved.flexibility === "flex"
    ? `Bis ${limit} € · einzelne dürfen mehr kosten`
    : `Bis ${limit} € für jedes Produkt`
}
function budgetLine(editable = true) {
  return `<div class="budget-line"><span>Budget: <b>${budgetText()}</b></span>${editable ? '<button class="link" data-action="edit-budget">Ändern</button>' : ""}</div>`
}

/* ---------- candidate fixtures ---------- */
function shampooPool() {
  const middle = ceiling() === 15
  const products = [
    {
      id: "a",
      name: "Pflege-Shampoo Balance für feines Haar",
      price: middle ? 11.95 : 4.45,
      quantity: "250 ml",
      tier: "Drogerie",
      tone: "sage",
    },
    {
      id: "b",
      name: "Sanftes Pflege-Shampoo für leichte Geschmeidigkeit",
      price: middle ? 14.95 : 4.95,
      quantity: "200 ml",
      tier: middle ? "Profi" : "Drogerie",
      tone: "",
    },
    {
      id: "c",
      name: "Pflege-Shampoo Leicht & Geschmeidig für trockene Längen",
      price: 24.9,
      quantity: "250 ml",
      tier: "Profi",
      tone: "rose",
    },
    {
      id: "d",
      name: "Pflege-Shampoo Intensiv Balance mit leichter Pflege",
      price: 70,
      quantity: "300 ml",
      tier: "Profi",
      tone: "",
    },
  ]
  if (scenario.value === "none") return []
  let eligible = products
  if (scenario.value === "strict-one" || scenario.value === "flex-fit")
    eligible = products.filter((p) => p.id !== "b")
  if (scenario.value === "strict-zero" || scenario.value === "flex-gap")
    eligible = products.filter((p) => p.price > (ceiling() ?? 5))
  if (state.saved?.budget === "open") return [products[2], products[0], products[3]]
  return arrange(eligible)
}
function secondaryPool(role) {
  const middle = ceiling() === 15
  const open = ceiling() === null
  const sets = {
    Conditioner: [
      {
        id: "c1",
        name: "Leichter Glanz-Conditioner",
        price: middle || open ? 10.95 : 4.95,
        quantity: "200 ml",
        tier: "Drogerie",
        tone: "rose",
      },
      {
        id: "c2",
        name: "Feuchtigkeits-Conditioner ohne Silikone",
        price: middle || open ? 13.95 : 3.95,
        quantity: "250 ml",
        tier: middle || open ? "Profi" : "Drogerie",
        tone: "sage",
      },
      {
        id: "c3",
        name: "Repair-Conditioner für trockene Längen",
        price: 21.5,
        quantity: "200 ml",
        tier: "Profi",
        tone: "",
      },
    ],
    Maske: [
      {
        id: "m1",
        name: "Feuchtigkeitsmaske Längen",
        price: middle || open ? 12.95 : 3.95,
        quantity: "200 ml",
        tier: "Drogerie",
        tone: "",
      },
      {
        id: "m2",
        name: "Leichte Pflegemaske",
        price: middle || open ? 9.95 : 4.75,
        quantity: "250 ml",
        tier: "Drogerie",
        tone: "sage",
      },
      {
        id: "m3",
        name: "Hydra Repair Maske",
        price: middle || open ? 24.9 : 12.95,
        quantity: "200 ml",
        tier: middle || open ? "Profi" : "Drogerie",
        tone: "rose",
        leads: true,
      },
    ],
  }
  const products = sets[role]
  if (open) {
    // No ceiling: aim for round(0.6 × 3) = 2 products above €15 when fit is comparable.
    const highSoFar = state.picks.filter((p) => p && p.price > 15).length
    const high = products.find((p) => p.price > 15)
    const rest = products.filter((p) => p !== high)
    return highSoFar < 2 && high ? [high, ...rest] : [...rest, high]
  }
  return arrange(products, role === "Maske")
}
// Capped ordering. Strict: affordable only when ≥2, else affordable first. Flexible: one
// automatic exception per routine (N = 3 → A = 1); it leads only while it is still unused.
function arrange(eligible, exceptionCandidate = true) {
  const affordable = eligible.filter((p) => p.price <= ceiling())
  const higher = eligible.filter((p) => p.price > ceiling())
  if (state.saved?.flexibility === "strict")
    return (affordable.length >= 2 ? affordable : [...affordable, ...higher]).slice(0, 3)
  if (exceptionUsed() || !exceptionCandidate)
    return (affordable.length >= 2 ? affordable : [...affordable, ...higher]).slice(0, 3)
  return [...higher.slice(0, 1), ...affordable, ...higher.slice(1)].slice(0, 3)
}
function exceptionUsed() {
  return state.picks.some((p) => p && isOver(p.price))
}
function pool() {
  const role = ROLES[state.step].key
  return role === "Shampoo" ? shampooPool() : secondaryPool(role)
}
function chooseDefault() {
  const candidates = pool()
  state.alternative = 1
  state.selected =
    state.saved?.flexibility === "strict"
      ? (candidates.find((p) => p.price <= ceiling())?.id ?? null)
      : (candidates[0]?.id ?? null)
}

// Direct-accept proposals for three new purchases (N = 3).
function routineFor(budget, flexibility) {
  const r = (category, name, price, quantity, tier, tone, extra = {}) => ({
    category,
    name,
    price,
    quantity,
    tier,
    tone,
    ...extra,
  })
  if (budget === "cheap" && flexibility === "strict")
    return [
      r("Shampoo", "Sanftes Basis-Shampoo", 4.45, "250 ml", "Drogerie", "sage"),
      r("Conditioner", "Leichter Basis-Conditioner", 4.95, "200 ml", "Drogerie", "rose"),
      r("Maske", "Basis-Pflegemaske", 3.95, "200 ml", "Drogerie", ""),
    ]
  if (budget === "cheap")
    return [
      r("Shampoo", "Sanftes Basis-Shampoo", 4.45, "250 ml", "Drogerie", "sage"),
      r("Conditioner", "Leichter Basis-Conditioner", 4.95, "200 ml", "Drogerie", "rose"),
      r("Maske", "Hydra Repair Maske", 12.95, "200 ml", "Drogerie", "", { reason: REASON }),
    ]
  if (budget === "middle" && flexibility === "strict")
    return [
      r("Shampoo", "Pflege-Shampoo Balance", 11.95, "250 ml", "Drogerie", "sage"),
      r("Conditioner", "Leichter Glanz-Conditioner", 10.95, "200 ml", "Drogerie", "rose"),
      r("Maske", "Feuchtigkeitsmaske Längen", 12.95, "200 ml", "Drogerie", ""),
    ]
  if (budget === "middle")
    return [
      r("Shampoo", "Pflege-Shampoo Balance", 11.95, "250 ml", "Drogerie", "sage"),
      r("Conditioner", "Leichter Glanz-Conditioner", 10.95, "200 ml", "Drogerie", "rose"),
      r("Maske", "Hydra Repair Maske", 24.9, "200 ml", "Profi", "", { reason: REASON }),
    ]
  if (budget === "open")
    return [
      r("Shampoo", "Pflege-Shampoo Leicht & Geschmeidig", 24.9, "250 ml", "Profi", "sage"),
      r("Conditioner", "Leichter Glanz-Conditioner", 10.95, "200 ml", "Drogerie", "rose"),
      r("Maske", "Hydra Repair Maske", 24.9, "200 ml", "Profi", ""),
    ]
  return [
    r("Shampoo", "Pflege-Shampoo Balance", 11.95, "250 ml", "Drogerie", "sage"),
    r("Conditioner", "Leichter Glanz-Conditioner", 10.95, "200 ml", "Drogerie", "rose"),
    r("Maske", "Hydra Repair Maske", 24.9, "200 ml", "Profi", ""),
  ]
}

/* ---------- shared pieces ---------- */
function header() {
  const atStart =
    ["capture", "owned", "draft-summary", "scanner", "cockpit"].includes(state.screen) ||
    (state.screen === "direct-proposal" && !state.adjusted) ||
    (state.screen === "summary" && !state.editing)
  return `<header class="journey-header"><div class="header-inner"><button class="back" data-action="back" aria-label="Zurück" ${atStart ? "disabled" : ""}>←</button><span class="wordmark">${cockpit ? "Beratung" : "chaarlie"}</span><span class="header-state"></span></div></header>`
}
function dock(label, action, disabled = false) {
  return `<footer class="dock"><div class="dock-inner"><button class="primary" data-action="${action}" ${disabled ? "disabled" : ""}>${label}</button></div></footer>`
}
function choice(id, title, checked, desc = "", chip = "") {
  return `<button class="choice ${checked ? "selected" : ""}" role="radio" aria-checked="${checked}" data-choice="${id}"><span class="choice-text"><span class="choice-title">${title}${chip ? `<span class="chip">${chip}</span>` : ""}</span>${desc ? `<span class="choice-desc">${desc}</span>` : ""}</span><span class="radio" aria-hidden="true"></span></button>`
}
function head(eyebrow, title, lead = "") {
  return `<div class="screen-head">${eyebrow ? `<p class="eyebrow">${eyebrow}</p>` : ""}<h1>${title}</h1>${lead ? `<p class="lead">${lead}</p>` : ""}</div>`
}
function badgesFor(p, { budgetAware = true } = {}) {
  const over = budgetAware && !p.legacy && isOver(p.price)
  if (!p.tier && !over) return ""
  return `<span class="badges">${p.tier ? `<span class="badge">${p.tier}</span>` : ""}${over ? '<span class="badge over">Über deinem Budget</span>' : ""}</span>`
}
function row(p, i, { budgetAware = true } = {}) {
  const tone = p.tone ?? ["sage", "rose", ""][i % 3]
  const meta = p.name
    ? `<b>${escape(p.name)}</b>${p.quantity ? `<span class="row-note">${p.quantity}</span>` : ""}${badgesFor(p, { budgetAware })}${budgetAware && p.reason && isOver(p.price) ? `<span class="row-note">${p.reason}</span>` : ""}`
    : '<span class="row-note">Noch offen</span>'
  return `<div class="row"><span class="thumb ${tone}" aria-hidden="true"></span><div class="row-copy"><small>${p.category}</small>${meta}</div><span class="row-price ${p.price === null || p.price === undefined ? "open" : ""}">${p.price === null || p.price === undefined ? "–" : euro(p.price)}</span></div>`
}

/* ---------- screens ---------- */
function captureScreen() {
  const products = ownedFixtures[scenario.value] ?? ownedFixtures.journey
  const mask = products.find((p) => p.category === "Maske")
  const picked = mask
    ? `<div class="picked"><span class="thumb rose" aria-hidden="true"></span><div class="picked-copy"><small>Beispielmarke</small><b>${mask.name}</b></div><span class="chip">Ausgewählt</span></div>`
    : ""
  return `<main><section class="screen">${head("", "Deine Maske", "Zusätzliche intensive Pflege")}<p class="field-label">Produkt suchen</p><div class="search" aria-hidden="true">⌕ Marke oder Produktname</div>${picked}</section></main>${dock("Weiter", "owned-next")}`
}
function ownedScreen() {
  const products = ownedFixtures[scenario.value] ?? ownedFixtures.journey
  const shelf = products.length
    ? products
        .map(
          (p, i) =>
            `<div class="row"><span class="thumb ${["sage", "rose", ""][i % 3]}" aria-hidden="true"></span><div class="row-copy"><small>${p.category}</small><b>${p.name}</b><span class="row-note">Beispielmarke</span></div></div>`,
        )
        .join("")
    : '<p class="notice">Noch keine Produkte hinzugefügt.</p>'
  return `<main><section class="screen">${head("Vorbereitung", "Deine Produkte", "Was du aktuell benutzt.")}<div class="search" aria-hidden="true">⌕ Produkt suchen oder scannen</div><div class="shelf">${shelf}</div></section></main>${dock("Weiter", "owned-next")}`
}
function budgetScreen() {
  // The suggestion chip stays on the suggested answer, whatever is currently selected.
  const suggested = !state.saved && state.inferred
  const options = Object.entries(budgets)
    .map(([id, b]) =>
      choice(
        id,
        b.label,
        state.choice === id,
        "",
        suggested && state.inferred === id ? "Wie deine bisherigen Produkte" : "",
      ),
    )
    .join("")
  const context = state.pendingEdit
    ? '<p class="notice">Kurz eine Frage, dann geht es mit deiner Änderung weiter.</p>'
    : state.editing && state.accepted
      ? '<p class="notice">Deine Routine bleibt, bis du neue Vorschläge übernimmst.</p>'
      : ""
  const cancel =
    state.editing || (direct && !state.saved) || state.pendingEdit
      ? '<button class="link" data-action="cancel-budget">Abbrechen</button>'
      : ""
  const saveError =
    state.error === "save"
      ? '<p class="notice error" role="alert">Nicht gespeichert. Deine Auswahl bleibt erhalten.</p>'
      : ""
  return `<main><section class="screen">${head("Dein Budget", "Was darf ein Pflegeprodukt ungefähr kosten?", "Preis pro Packung – gilt für jedes Produkt deiner Routine.")}<div class="choices" role="radiogroup" aria-label="Budget pro Packung">${options}</div>${context}${saveError}${cancel}</section></main>${dock(state.error === "save" ? "Erneut versuchen" : "Weiter", "budget-next", !state.choice)}`
}
function flexibilityScreen() {
  const limit = budgets[state.choice].ceiling
  let notice = ""
  let cta = "Weiter"
  if (state.error === "conflict") {
    notice = `<p class="notice error" role="alert">Dein Budget wurde gerade an anderer Stelle geändert: ${budgetText()}. Deine Auswahl ist noch nicht gespeichert.<button class="link" data-action="keep-other-budget">${budgetText()} behalten</button></p>`
    cta = "Meine Auswahl speichern"
  } else if (state.error === "save") {
    notice =
      '<p class="notice error" role="alert">Nicht gespeichert. Deine Auswahl bleibt erhalten.</p>'
    cta = "Erneut versuchen"
  }
  return `<main><section class="screen">${head("Dein Budget", `Bis ${limit} € für jedes Produkt?`)}<div class="choices" role="radiogroup" aria-label="Flexibilität beim Budget">${choice("strict", "Ja, für jedes.", state.flexChoice === "strict", "Teurere zeigen wir nur, wenn es im Budget kaum Passendes gibt.")}${choice("flex", "Einzelne dürfen mehr kosten.", state.flexChoice === "flex", "Nur einzelne – wenn sie deutlich besser passen.")}</div>${notice}</section></main>${dock(cta, "save-budget", !state.flexChoice)}`
}
function cardLabel(product, index) {
  if (ceiling() === null) return index === 0 ? "Passende Option" : `Alternative ${index}`
  if (!isOver(product.price)) return "Im Budget"
  if (index === 0 && state.saved.flexibility === "flex") return "Empfohlen"
  return "Alternative"
}
function productCard(product, index) {
  const over = isOver(product.price)
  const chosen = state.selected === product.id
  const label = cardLabel(product, index)
  const aria = [
    product.name,
    label,
    euro(product.price),
    product.quantity,
    product.tier,
    over ? "über deinem Budget" : "",
  ]
    .filter(Boolean)
    .join(", ")
  return `<button class="pcard ${chosen ? "chosen" : ""}" role="radio" aria-checked="${chosen}" data-product="${product.id}" aria-label="${escape(aria)}"><span class="pcard-label ${!over ? "ok" : ""}">${label}</span><span class="pcard-check" aria-hidden="true">${chosen ? "✓" : ""}</span><span class="thumb lg ${product.tone}" aria-hidden="true"></span><span class="pcard-name">${escape(product.name)}</span><span class="pcard-meta">${product.quantity} · <b>${euro(product.price)}</b></span>${badgesFor(product)}</button>`
}
function productsScreen() {
  const role = ROLES[state.step]
  const candidates = pool()
  const limit = ceiling()
  const affordable = candidates.filter((p) => limit !== null && p.price <= limit)
  const strict = state.saved.flexibility === "strict"
  const selected = candidates.find((p) => p.id === state.selected)
  const stale = state.refresh && state.proposalRevision !== state.savedRevision
  let guidance = ""
  if (!candidates.length)
    guidance = `Für deinen Bedarf haben wir gerade ${role.none} – unabhängig vom Preis.`
  else if (strict && selected && isOver(selected.price))
    guidance = `Liegt über deinem Budget. Dein Budget bleibt bei ${limit} €.`
  else if (strict && affordable.length === 0)
    guidance = `Bis ${limit} € gibt es hier nichts, das zu deinem Haar passt. Du kannst eine teurere Option wählen oder ohne neues Produkt weitergehen.`
  else if (strict && affordable.length === 1)
    guidance = `Nur eine passende Option bis ${limit} €. Weitere Optionen liegen über deinem Budget.`
  else if (state.saved.flexibility === "flex" && isOver(candidates[0].price))
    guidance =
      scenario.value === "flex-gap" && role.key === "Shampoo"
        ? `Bis ${limit} € gibt es hier nichts Passendes. Diese Option liegt darüber.`
        : REASON
  else if (state.saved.flexibility === "flex" && exceptionUsed() && role.key !== "Shampoo")
    guidance = "Ein Produkt liegt schon über deinem Budget. Hier bleiben wir im Budget."
  const notice = stale
    ? '<p class="notice" role="status">Dieser Vorschlag ist nicht mehr aktuell. Lade die aktuellen Vorschläge.</p>'
    : guidance
      ? `<p class="notice" role="status">${guidance}</p>`
      : ""
  const current = state.mode === "edit" ? state.accepted.find((p) => p.category === role.key) : null
  const currentRow = current?.name
    ? `<div class="current"><span class="eyebrow">Dein Produkt</span><span>${escape(current.name)} · ${euro(current.price)}</span></div>`
    : ""
  const cards = candidates.length
    ? `<div class="compare ${candidates.length === 1 ? "single" : ""} ${stale ? "dimmed" : ""}" role="radiogroup" aria-label="${role.heading}">${productCard(candidates[0], 0)}${candidates.length > 1 ? productCard(candidates[state.alternative], state.alternative) : ""}</div>${candidates.length > 2 ? `<div class="alt-nav"><button class="nav-arrow" data-action="previous-alt" aria-label="Vorherige Alternative" ${state.alternative === 1 ? "disabled" : ""}>‹</button><span>Alternative ${state.alternative} von ${candidates.length - 1}</span><button class="nav-arrow" data-action="next-alt" aria-label="Nächste Alternative" ${state.alternative === candidates.length - 1 ? "disabled" : ""}>›</button></div>` : ""}`
    : ""
  const keepLabel = state.mode === "edit" ? role.keep : role.skip
  const keepAction = state.mode === "edit" ? "keep-routine" : "skip-product"
  const details = candidates.length
    ? '<details class="more"><summary>Details zur Auswahl</summary><p>Milde Reinigung und leichte Pflege für feines Haar mit trockenen Längen.</p><p>Drogerie und Profi sind Produktgruppen, keine Qualitätsstufen. Das betrifft insbesondere Shampoo, Conditioner und Maske.</p></details>'
    : ""
  let ctaLabel = "Dieses Produkt einplanen"
  let ctaAction = "accept-product"
  if (stale) {
    ctaLabel = "Vorschläge neu laden"
    ctaAction = "refresh-routine"
  } else if (!selected) {
    ctaLabel = keepLabel
    ctaAction = keepAction
  }
  const inlineKeep =
    selected && !stale
      ? `<button class="link" data-action="${keepAction}">${keepLabel}</button>`
      : ""
  const total =
    state.mode === "draft" ? state.draftSelections.length : state.mode === "edit" ? 1 : ROLES.length
  const position =
    state.mode === "draft"
      ? state.draftSelections.findIndex((p) => p.category === role.key) + 1
      : state.mode === "edit"
        ? 1
        : state.step + 1
  return `<main><section class="screen">${head(state.mode === "edit" ? role.eyebrow : `${role.eyebrow} · Produkt ${position} von ${total}`, candidates.length ? role.heading : `Dein${role.key === "Maske" ? "e" : ""} ${role.key}`)}${candidates.length ? budgetLine() : ""}${currentRow}${notice}${cards}${details}${inlineKeep}</section></main>${dock(ctaLabel, ctaAction)}`
}
function summaryScreen() {
  const intro = state.justAccepted
    ? '<p class="notice">Übernommen. Deine Routine ist gespeichert.</p>'
    : ""
  const budget = state.saved ? budgetLine() : ""
  const overCount = state.accepted.filter((p) => p.legacy && isOver(p.price)).length
  const overNotice =
    !state.justAccepted && overCount
      ? `<p class="notice">${overCount === 1 ? "Ein Produkt liegt" : `${overCount} Produkte liegen`} über deinem Budget. Sie bleiben, bis du neue Vorschläge übernimmst.<button class="link" data-action="review-products">Neue Vorschläge ansehen</button></p>`
      : ""
  return `<main><section class="screen">${head("Dein Plan", "Deine Routine", `Haarwäsche ${state.frequency}× pro Woche`)}${intro}${budget}${overNotice}<div class="list">${state.accepted.map((p, i) => row(p, i)).join("")}</div><div class="inline-actions"><button class="secondary" data-action="review-products">Produkte ändern</button><button class="secondary" data-action="edit-frequency">Häufigkeit ändern</button></div></section></main>`
}
function nextOpenRole() {
  const open = state.draftSelections?.find((p) => !p.name)
  return open ? ROLES.findIndex((r) => r.key === open.category) : -1
}
function refreshScreen() {
  const unfinished = !!state.draftSelections
  const rows = (state.draftSelections ?? state.accepted).map((p, i) => row(p, i)).join("")
  const openRole = nextOpenRole()
  const cta =
    unfinished && openRole >= 0
      ? `Weiter ${ROLES[openRole].to}`
      : state.error === "refresh"
        ? "Erneut versuchen"
        : "Neue Vorschläge ansehen"
  const action = unfinished && openRole >= 0 ? "continue-draft" : "refresh-routine"
  return `<main><section class="screen">${head(unfinished ? "Produkte prüfen" : "Dein Plan", unfinished ? "Deine Produktauswahl" : "Deine Routine")}${budgetLine()}<p class="notice">${unfinished ? "Dein Budget gilt für die verbleibenden Vorschläge. Bereits gewählte Produkte bleiben erhalten." : "Dein Budget ist geändert. Deine Produkte bleiben, bis du neue Vorschläge übernimmst."}</p>${state.error === "refresh" ? '<p class="notice error" role="alert">Vorschlag nicht geladen. Deine Auswahl bleibt unverändert.</p>' : ""}<div class="list">${rows}</div>${unfinished ? "" : '<button class="link" data-action="keep-routine">Nicht jetzt</button>'}</section></main>${dock(cta, action)}`
}
function draftSummaryScreen() {
  const openRole = nextOpenRole()
  return `<main><section class="screen">${head("Produkte prüfen", "Deine Produktauswahl")}${budgetLine()}<div class="list">${state.draftSelections.map((p, i) => row(p, i)).join("")}</div></section></main>${openRole >= 0 ? dock(`Weiter ${ROLES[openRole].to}`, "continue-draft") : ""}`
}
function directProposalScreen() {
  const proposal = routineFor(state.saved?.budget ?? null, state.saved?.flexibility ?? null)
  let note = ""
  if (state.adjusted) {
    const before = routineFor(null)
    const changed = proposal.filter(
      (p, i) => p.name !== before[i].name || p.price !== before[i].price,
    ).length
    note = `<p class="notice">${changed ? `An dein Budget angepasst: ${changed === 1 ? "1 Produkt" : `${changed} Produkte`} getauscht.` : "Passt schon zu deinem Budget. Nichts getauscht."}</p>`
  }
  return `<main><section class="screen">${head("Dein Plan", "Dein Routine-Vorschlag", state.saved ? "" : "Passend zu deinem Haarprofil.")}${state.saved ? budgetLine() : ""}${note}<div class="list">${proposal.map((p, i) => row(p, i, { budgetAware: !!state.saved })).join("")}</div></section></main>${dock(state.saved ? "Routine übernehmen" : "Weiter", "direct-accept")}`
}
function scannerScreen() {
  const saved = !!state.saved
  const alternatives = [
    {
      name: "Pflege-Shampoo Balance",
      price: 11.95,
      quantity: "250 ml",
      tier: "Drogerie",
      why: "Mildere Reinigung, leichte Pflege.",
      tone: "sage",
    },
    {
      name: "Pflege-Shampoo Intensiv",
      price: 24.9,
      quantity: "250 ml",
      tier: "Profi",
      why: "Mildere Reinigung und mehr Pflege für sehr trockene Längen.",
      tone: "rose",
    },
  ]
  // Without a saved budget the existing fit order applies; with one, affordable comes first.
  const ordered = saved ? alternatives : [alternatives[1], alternatives[0]]
  const rows = ordered
    .map((p) => {
      const over = saved && p.price > 15
      return `<div class="row"><span class="thumb ${p.tone}" aria-hidden="true"></span><div class="row-copy"><span class="verdict ok">Passt</span><b>${p.name}</b><span class="row-note">${p.quantity} · ${euro(p.price)}</span><span class="badges"><span class="badge">${p.tier}</span>${over ? '<span class="badge over">Über deinem Budget</span>' : ""}</span><span class="row-note">${p.why}</span></div></div>`
    })
    .join("")
  const caption = saved ? `<p class="caption">Bis ${ceiling()} € zuerst</p>` : ""
  return `<main><section class="screen"><div class="scan-result"><div class="scan-top"><span class="thumb lg" aria-hidden="true"></span><div class="row-copy"><small>Gescannt</small><b>Volumen-Shampoo Frische</b><span class="row-note">250 ml · 3,95 €</span><span class="badges"><span class="badge">Drogerie</span></span></div></div><span class="verdict">Passt teilweise</span><p class="row-note">Reinigt für deine trockenen Längen etwas zu stark.</p></div><div class="section-head"><p class="section-title">Passende Alternativen</p>${caption}</div><div class="list">${rows}</div></section></main>`
}
function consultRoutineScreen() {
  return `<main><section class="screen">${head("Vorbereitung", "Deine Routine")}${budgetLine()}<div class="list"><div class="row"><span class="thumb sage" aria-hidden="true"></span><div class="row-copy"><small>Waschtag</small><b>Dein bisheriges Shampoo</b><span class="row-note">2–3× pro Woche</span></div></div></div></section></main>${dock("Stimmt so", "consult-next")}`
}
function consultHeatScreen() {
  return `<main><section class="screen">${head("Vorbereitung", "Hitze & Styling", "Weiter mit deinen Styling-Gewohnheiten.")}</section></main>`
}
function cockpitBudgetPanel() {
  if (!state.cockpitEdit)
    return `<aside class="panel"><h2>Kundenbudget</h2><div class="kv"><small>Angabe der Kundin / des Kunden</small><b>${budgetText()}</b></div><button class="link" data-action="cockpit-edit">Ändern</button></aside>`
  const radio = (name, value, label, checked) =>
    `<label class="staff-radio"><input type="radio" name="${name}" value="${value}" ${checked ? "checked" : ""}> ${label}</label>`
  const flex =
    state.choice !== "open"
      ? `<fieldset class="staff-set"><legend>Gilt die Grenze für jedes Produkt?</legend>${radio("flex", "strict", "Ja, für jedes", state.flexChoice === "strict")}${radio("flex", "flex", "Einzelne dürfen mehr kosten", state.flexChoice === "flex")}</fieldset>`
      : ""
  return `<aside class="panel"><h2>Kundenbudget ändern</h2><fieldset class="staff-set"><legend>Preis pro Packung</legend>${radio("budget", "cheap", "Bis 5 €", state.choice === "cheap")}${radio("budget", "middle", "Bis 15 €", state.choice === "middle")}${radio("budget", "open", "Keine feste Preisgrenze", state.choice === "open")}</fieldset>${flex}<div class="inline-actions"><button class="secondary" data-action="cockpit-save" ${state.choice !== "open" && !state.flexChoice ? "disabled" : ""}>Speichern</button><button class="link" data-action="cockpit-cancel">Abbrechen</button></div></aside>`
}
function cockpitScreen() {
  state.step = 0
  const candidates = pool()
  const top = candidates[0]
  const alt = candidates[1]
  const flex = state.saved.flexibility === "flex"
  const exception = flex && top && isOver(top.price)
  const budgetCell = (p) =>
    isOver(p.price)
      ? `<span class="badge over">+${euro(p.price - ceiling())}</span>`
      : ceiling() === null
        ? "–"
        : "Im Budget"
  const tr = (p, label) =>
    `<tr><td>${label}</td><td><b>${escape(p.name)}</b><br><span class="row-note">${p.quantity}</span></td><td>${euro(p.price)}</td><td>${p.tier}</td><td>${budgetCell(p)}</td></tr>`
  const products = top
    ? `${exception ? `<p class="notice">${scenario.value === "flex-gap" ? `Bis ${ceiling()} € nichts Passendes.` : REASON} Ausnahmen: 1 von 1 genutzt.</p>` : ""}<div class="table-wrap"><table class="table"><thead><tr><th></th><th>Produkt</th><th>Preis</th><th>Gruppe</th><th>Budget</th></tr></thead><tbody>${tr(top, state.saved.flexibility === "strict" && isOver(top.price) ? "Option" : "Empfohlen")}${alt ? tr(alt, "Alternative") : ""}</tbody></table></div><div class="table-wrap"><table class="table"><thead><tr><th>Prüfpunkt</th><th>Ziel</th><th>Empfohlen</th><th>Alternative</th></tr></thead><tbody><tr><td>Reinigung</td><td>Mild</td><td>✓ Mild</td><td>✓ Mild</td></tr><tr><td>Pflegegewicht</td><td>Leicht</td><td>✓ Leicht</td><td>✓ Leicht</td></tr><tr><td>Pflege trockene Längen</td><td>Hoch</td><td>✓ Hoch</td><td>${exception ? "~ Mittel" : "✓ Hoch"}</td></tr></tbody></table></div>`
    : '<p class="notice">Kein geprüftes Shampoo für diesen Bedarf.</p>'
  return `<main><section class="screen">${head("Phase 3", "Produkte")}<div class="cockpit-grid">${cockpitBudgetPanel()}<section class="panel"><h2>Shampoo</h2>${products}</section></div></section></main>`
}

function render(scroll = false) {
  const screens = {
    capture: captureScreen,
    owned: ownedScreen,
    budget: budgetScreen,
    flexibility: flexibilityScreen,
    products: productsScreen,
    summary: summaryScreen,
    refresh: refreshScreen,
    "draft-summary": draftSummaryScreen,
    "direct-proposal": directProposalScreen,
    scanner: scannerScreen,
    "consult-routine": consultRoutineScreen,
    "consult-heat": consultHeatScreen,
    cockpit: cockpitScreen,
  }
  app.innerHTML = header() + screens[state.screen]()
  if (scroll) {
    window.scrollTo({ top: 0, behavior: "instant" })
    const h1 = app.querySelector("h1")
    h1?.setAttribute("tabindex", "-1")
    h1?.focus({ preventScroll: true })
  }
}

function startProducts(mode, step) {
  state.mode = mode
  state.step = step
  if (mode === "new") state.picks = []
  state.screen = "products"
  chooseDefault()
}
function saveBudget() {
  if (state.conflictPending) {
    // Stub readback of a competing save from another device; the user's draft is kept.
    state.conflictPending = false
    state.saved = { budget: "cheap", flexibility: "strict" }
    state.savedRevision += 1
    state.error = "conflict"
    render()
    return
  }
  if (failNext.checked) {
    failNext.checked = false
    state.error = "save"
    render()
    return
  }
  state.saved = {
    budget: state.choice,
    flexibility: state.choice === "open" ? null : state.flexChoice,
  }
  state.savedRevision += 1
  state.error = null
  state.askedThisSession = true
  const origin = state.editOrigin
  if (state.pendingEdit === "frequency") {
    state.frequency += 1
    state.pendingEdit = null
    state.screen = "summary"
  } else if (state.pendingEdit === "products") {
    state.pendingEdit = null
    state.refresh = true
    state.proposalRevision = state.savedRevision
    startProducts("edit", 0)
  } else if (consulting) {
    state.screen = "consult-routine"
  } else if ((state.draftSelections || state.accepted) && state.editing) {
    state.screen = "refresh"
  } else if (state.editing && origin === "products") {
    startProducts(state.mode, state.step)
  } else if (direct) {
    state.adjusted = true
    state.screen = "direct-proposal"
  } else {
    startProducts("new", 0)
  }
  state.editing = false
  state.editOrigin = null
  render(true)
}
function pickToRow(role, selected) {
  return selected
    ? {
        category: role,
        name: selected.name,
        price: selected.price,
        quantity: selected.quantity,
        tier: selected.tier,
        tone: selected.tone,
        reason: isOver(selected.price) && state.saved.flexibility === "flex" ? REASON : undefined,
      }
    : { category: role, name: null, price: null }
}
function acceptProduct(skip = false) {
  const role = ROLES[state.step].key
  const selected = skip ? null : pool().find((p) => p.id === state.selected)
  if (!skip && !selected) return
  const rowValue = pickToRow(role, selected)
  if (state.mode === "edit") {
    // Only the edited role changes; every other product stays.
    state.accepted = state.accepted.map((p) => (p.category === role ? rowValue : p))
    finish()
    return
  }
  if (state.mode === "draft") {
    state.draftSelections = state.draftSelections.map((p) => (p.category === role ? rowValue : p))
    const openRole = nextOpenRole()
    if (openRole >= 0) startProducts("draft", openRole)
    else {
      state.accepted = state.draftSelections
      state.draftSelections = null
      finish()
      return
    }
    render(true)
    return
  }
  state.picks[state.step] = selected
  if (state.step < ROLES.length - 1) {
    startProducts("new-continue", state.step + 1)
    state.mode = "new"
    render(true)
    return
  }
  state.accepted = ROLES.map((r, i) => pickToRow(r.key, state.picks[i]))
  finish()
}
function finish() {
  state.refresh = false
  state.mode = "new"
  state.justAccepted = true
  state.screen = "summary"
  render(true)
}

app.addEventListener("change", (event) => {
  if (!cockpit || !state.cockpitEdit) return
  if (event.target.name === "budget") {
    state.choice = event.target.value
    state.flexChoice =
      state.choice === "open"
        ? null
        : state.saved.budget === state.choice
          ? state.saved.flexibility
          : null
  }
  if (event.target.name === "flex") state.flexChoice = event.target.value
  render()
})
app.addEventListener("click", (event) => {
  const choiceButton = event.target.closest("[data-choice]")
  if (choiceButton) {
    if (state.error === "save") state.error = null
    if (state.screen === "budget") {
      state.choice = choiceButton.dataset.choice
      state.flexChoice = state.saved?.budget === state.choice ? state.saved.flexibility : null
    } else state.flexChoice = choiceButton.dataset.choice
    render()
    return
  }
  const productButton = event.target.closest("[data-product]")
  if (productButton) {
    if (state.refresh && state.proposalRevision !== state.savedRevision) return
    state.selected = productButton.dataset.product
    render()
    return
  }
  const action = event.target.closest("[data-action]")?.dataset.action
  if (!action) return
  if (action !== "save-budget") state.error = null
  state.justAccepted = false
  if (action === "owned-next") {
    if (state.saved) {
      if (consulting) state.screen = "consult-routine"
      else startProducts("new", 0)
    } else state.screen = "budget"
  }
  if (action === "consult-next") state.screen = "consult-heat"
  if (action === "budget-next") {
    if (state.choice === "open") {
      saveBudget()
      return
    }
    state.screen = "flexibility"
  }
  if (action === "keep-other-budget") {
    state.choice = state.saved.budget
    state.flexChoice = state.saved.flexibility
    state.editing = false
    state.screen = state.editOrigin ?? "draft-summary"
    state.editOrigin = null
  }
  if (action === "cancel-budget") {
    state.choice = state.saved?.budget ?? state.inferred
    state.flexChoice = state.saved?.flexibility ?? null
    state.pendingEdit = null
    state.editing = false
    state.screen =
      state.editOrigin ?? (direct ? "direct-proposal" : state.accepted ? "summary" : "capture")
    state.editOrigin = null
  }
  if (action === "direct-accept") {
    if (!state.saved) {
      state.choice = null
      state.flexChoice = null
      state.inferred = null
      state.screen = "budget"
    } else {
      state.accepted = routineFor(state.saved.budget, state.saved.flexibility)
      state.justAccepted = true
      state.screen = "summary"
    }
  }
  if (action === "save-budget") {
    saveBudget()
    return
  }
  if (action === "back") {
    if (state.screen === "flexibility") state.screen = "budget"
    else if (state.screen === "budget") {
      state.screen = state.pendingEdit
        ? "summary"
        : (state.editOrigin ?? (direct ? "direct-proposal" : consulting ? "owned" : "capture"))
      if (direct && !state.editing) {
        state.choice = state.saved?.budget ?? null
        state.flexChoice = state.saved?.flexibility ?? null
      }
      state.pendingEdit = null
      state.editing = false
      state.editOrigin = null
    } else if (state.screen === "direct-proposal") {
      state.editing = true
      state.editOrigin = "direct-proposal"
      state.choice = state.saved.budget
      state.flexChoice = state.saved.flexibility
      state.screen = "budget"
    } else if (state.screen === "consult-routine")
      state.screen = state.saved?.budget === "open" ? "budget" : "flexibility"
    else if (state.screen === "consult-heat") state.screen = "consult-routine"
    else if (state.screen === "products") {
      if (state.mode === "edit") state.screen = "summary"
      else if (state.mode === "draft") state.screen = "draft-summary"
      else if (state.step > 0) {
        state.step -= 1
        chooseDefault()
      } else if (!state.askedThisSession) state.screen = "capture"
      else state.screen = state.saved.budget === "open" ? "budget" : "flexibility"
      state.refresh = false
    } else if (state.screen === "refresh")
      state.screen = state.draftSelections ? "draft-summary" : "summary"
    else return
  }
  if (action === "edit-budget") {
    state.editing = true
    state.editOrigin = state.screen
    state.choice = state.saved.budget
    state.flexChoice = state.saved.flexibility
    state.screen = "budget"
  }
  if (action === "cockpit-edit") state.cockpitEdit = true
  if (action === "cockpit-cancel") {
    state.cockpitEdit = false
    state.choice = state.saved.budget
    state.flexChoice = state.saved.flexibility
  }
  if (action === "cockpit-save") {
    state.saved = {
      budget: state.choice,
      flexibility: state.choice === "open" ? null : state.flexChoice,
    }
    state.cockpitEdit = false
  }
  if (action === "next-alt") state.alternative = Math.min(pool().length - 1, state.alternative + 1)
  if (action === "previous-alt") state.alternative = Math.max(1, state.alternative - 1)
  if (action === "accept-product") {
    acceptProduct()
    return
  }
  if (action === "skip-product") {
    acceptProduct(true)
    return
  }
  if (action === "continue-draft") {
    state.refresh = false
    startProducts("draft", nextOpenRole())
  }
  if (action === "review-products") {
    if (!state.saved) {
      state.pendingEdit = "products"
      state.choice = null
      state.flexChoice = null
      state.screen = "budget"
    } else {
      state.refresh = true
      state.proposalRevision = state.savedRevision
      startProducts("edit", 0)
    }
  }
  if (action === "edit-frequency") {
    if (!state.saved) {
      state.pendingEdit = "frequency"
      state.choice = null
      state.flexChoice = null
      state.screen = "budget"
    } else state.frequency += 1
  }
  if (action === "keep-routine") {
    state.refresh = false
    state.mode = "new"
    state.screen = state.draftSelections ? "draft-summary" : "summary"
  }
  if (action === "refresh-routine") {
    if (failNext.checked) {
      failNext.checked = false
      state.error = "refresh"
    } else if (state.screen === "products") {
      state.proposalRevision = state.savedRevision
      chooseDefault()
    } else {
      state.refresh = true
      state.proposalRevision = state.savedRevision
      startProducts("edit", 0)
    }
  }
  render(
    !["next-alt", "previous-alt", "cockpit-edit", "cockpit-cancel", "cockpit-save"].includes(
      action,
    ),
  )
})
scenario.addEventListener("change", () => reset(scenario.value))
document.querySelector("#reset").addEventListener("click", () => reset(scenario.value))
app.addEventListener("keydown", (event) => {
  const radio = event.target.closest('[role="radio"]')
  if (!radio || !["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight"].includes(event.key)) return
  event.preventDefault()
  const group = [...radio.closest('[role="radiogroup"]').querySelectorAll('[role="radio"]')]
  const forward = event.key === "ArrowDown" || event.key === "ArrowRight"
  const next = group[(group.indexOf(radio) + (forward ? 1 : -1) + group.length) % group.length]
  const selector = next.dataset.choice
    ? `[data-choice="${next.dataset.choice}"]`
    : `[data-product="${next.dataset.product}"]`
  next.click()
  app.querySelector(selector)?.focus()
})
reset()
