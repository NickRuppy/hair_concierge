/* Scanner-Funnel Klick-Prototyp (Legacy-Quiz-Basis) — Wegwerf-Artefakt, kein Produktionscode. */
(function () {
  "use strict";
  const A = "assets/";
  const CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
  const BACK = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 19-7-7 7-7M19 12H5"/></svg>';

  /* ————— Varianten ————— */
  const VARIANTS = {
    A: { key: "A", name: "Vorschau", tag: "Zeigen, was man bekommt",
      desc: "Drei Einfügungen zeigen den Scanner mit einem Ergebnis, das aus der gerade gegebenen Antwort entsteht: nach Dichte, nach Kopfhaut, nach Zielen. Angebot: „Dein Scanner ist startklar“.",
      note: "<b>Variante A – Vorschau.</b> Statische Demo-Bilder mit dem echten Ergebnis-Layout. Jede Einfügung nutzt die Antwort davor (Haardicke, Kopfhaut, Pflegegewicht). Günstigster Produktionsweg: drei neue Schritte im Legacy-Quiz, umformulierte Lead-Erfassung, Ladeseite und Angebot." },
    B: { key: "B", name: "Regal-Moment", tag: "Problem zuerst, dann der Scanner",
      desc: "Einstieg vorm Regal: raten, kaufen, enttäuscht sein. Die erste Einfügung zeigt das Problem, die zweite den Scanner als Antwort. Angebot: „Nie wieder raten vorm Regal“.",
      note: "<b>Variante B – Regal-Moment.</b> Emotionaler Einstieg über das Regal-Problem (echte Umfragezahl), dann Scanner als Lösung für die Kopfhaut, dann das Badezimmer. Risiko: Plan und Chat wirken nachrangig." },
    C: { key: "C", name: "Probier-Scan", tag: "Mittendrin selbst ausprobieren",
      desc: "Wie A, aber die Kopfhaut-Einfügung ist interaktiv: ein Produkt antippen, Beispiel-Ergebnis sehen. Angebot mit Live-Demo im Hero.",
      note: "<b>Variante C – Probier-Scan.</b> Nach der Kopfhaut-Frage kann man drei bekannte Produkte antippen und sieht ein Beispiel-Ergebnis (klar als Beispiel markiert – das echte Ergebnis braucht das fertige Profil)." },
  };

  /* ————— Die 10 Fragen des Legacy-Quiz (/quiz), Reihenfolge und Copy wie heute ————— */
  const Q = [
    { id: "texture", n: 1, kind: "visual", title: "Welche Haarstruktur haben die meisten deiner Haare?", helper: "Wähle die natürliche Form deiner Haare, so gut du sie erkennen kannst. Wenn deine Längen chemisch geglättet oder dauergewellt sind, hilft der unbehandelte Ansatz als Orientierung.",
      options: [["straight", "Glatt", "texture-straight.webp"], ["wavy", "Wellig", "texture-wavy.webp"], ["curly", "Lockig", "texture-curly.webp"], ["coily", "Kraus", "texture-coily.webp"]] },
    { id: "thickness", n: 2, kind: "thumb", title: "Wie dick fühlt sich ein einzelnes Haar bei dir meistens an?",
      options: [["fine", "Fein", "Kaum spürbar – dünner als ein Nähfaden", "thickness-fine.webp"], ["normal", "Mittel", "Spürbar – ähnlich wie ein Nähfaden", "thickness-normal.webp"], ["coarse", "Dick", "Deutlich spürbar – dicker als ein Nähfaden", "thickness-coarse.webp"]] },
    { id: "density", n: 3, kind: "list", title: "Wie dicht ist dein Haar insgesamt?",
      options: [["low", "Wenig Haare", "Der Scheitel wirkt breiter oder die Kopfhaut scheint schnell durch."], ["medium", "Mittlere Dichte", "Du hast weder auffällig wenig noch auffällig viele Haare."], ["high", "Viele Haare", "Dein Haar fühlt sich insgesamt voll an, ein Zopf wirkt eher dick."]] },
    { id: "ins1", kind: "insert", label: "Einfügung 1 · nach Dichte" },
    { id: "length", n: 4, kind: "list", title: "Wie lang sind deine Haare aktuell?",
      options: [["very_short", "Sehr kurz", "Über den Ohren"], ["short", "Kurz", "Bis zum Kinn oder Kiefer"], ["medium", "Mittellang", "Bis zu den Schultern"], ["long", "Lang", "Bis zur Brust"], ["very_long", "Sehr lang", "Bis zur Taille oder länger"]] },
    { id: "surface", n: 5, kind: "list", title: "Wie fühlt sich deine Haaroberfläche an?",
      options: [["glatt", "Glatt wie Glas", "Die Finger gleiten gleichmäßig durch"], ["leicht_uneben", "Leicht uneben", "Kleine Hügel spürbar, nicht durchgehend"], ["rau", "Richtig rau und huckelig", "Durchgehend rau und uneben"]] },
    { id: "elastic", n: 6, kind: "list", title: "Wie elastisch ist dein Haar?",
      options: [["stretches_bounces", "Dehnt sich und geht zurück", "Federt in den Ursprungszustand zurück"], ["stretches_stays", "Dehnt sich, bleibt ausgeleiert", "Kommt nicht mehr zurück – bleibt länglich"], ["snaps", "Reißt sofort", "Bricht bei leichtem Zug direkt ab"]] },
    { id: "chemical", n: 7, kind: "multi", title: "Sind deine Haare chemisch behandelt?",
      options: [["natur", "Naturhaar"], ["gefaerbt", "Gefärbt / getönt"], ["blondiert", "Blondiert / aufgehellt"], ["dauerwelle", "Dauerwelle"], ["chemisch_geglaettet", "Chemisch geglättet"]] },
    { id: "scalpType", n: 8, kind: "list", title: "Wie fühlt sich deine Kopfhaut normalerweise an?", helper: "Denk dabei an deine Kopfhaut und Ansätze – nicht an trockene Längen oder Spitzen.",
      options: [["oily", "Eher fettig", "Meine Ansätze werden meist nach 1–2 Tagen ölig"], ["balanced", "Ausgeglichen", "Meine Kopfhaut fühlt sich weder fettig noch trocken an"], ["dry", "Eher trocken", "Meine Kopfhaut spannt manchmal oder fühlt sich rau an"]] },
    { id: "scalpConditions", n: 8, sub: true, kind: "multi", eyebrow: "Noch eine Kopfhautfrage.", title: "Hast du zusätzlich Beschwerden wie Schuppen, Juckreiz oder Rötungen?",
      options: [["dandruff", "Schuppen", "Weiße oder gelbliche Flocken"], ["dry_dandruff", "Trockene Schuppen", "Kleine, weiße, trockene Flocken — Kopfhaut spannt"], ["irritated", "Gereizte Kopfhaut", "Jucken, Rötungen oder Brennen"], ["none", "Nein, nichts davon"]] },
    { id: "ins2", kind: "insert", label: "Einfügung 2 · nach Kopfhaut" },
    { id: "concerns", n: 9, kind: "multi", title: "Was beschäftigt dich gerade?", helper: "Wähle alles aus, was du bemerkst.",
      options: [["hair_damage", "Mein Haar wirkt insgesamt strapaziert oder geschädigt"], ["dry_lengths", "Trockene oder strohige Längen"], ["frizz_flyaways", "Frizz oder viele abstehende Haare"], ["low_shine", "Wenig Glanz"], ["split_ends", "Spliss"], ["breakage", "Haarbruch"], ["lost_shape", "Meine Form oder Definition hält nicht so, wie ich es möchte"], ["low_volume_or_weighed_down", "Mein Ansatz wirkt flach oder meine Längen schnell beschwert"], ["tangling", "Verknotungen"]] },
    { id: "goals", n: 10, kind: "multi", title: null, helper: "Wähle alles aus, was sich für deinen Plan wichtig anfühlt. Wir priorisieren daraus die Reihenfolge.", options: null },
    { id: "ins3", kind: "insert", label: "Einfügung 3 · nach Zielen" },
    { id: "lead_name", kind: "lead", label: "Lead: Vorname" },
    { id: "lead_email", kind: "lead", label: "Lead: E-Mail" },
    { id: "lead_consent", kind: "lead", label: "Lead: Tipps-Einwilligung" },
    { id: "commit", kind: "commit", label: "Bereit-Screen" },
    { id: "loading", kind: "loading", label: "Ladeseite" },
    { id: "offer", kind: "offer", label: "Angebot" },
    { id: "checkout", kind: "checkout", label: "Kauf (Demo)" },
    { id: "welcome", kind: "welcome", label: "Nach dem Kauf" },
  ];
  const SEQ = [{ id: "landing", kind: "landing", label: "Landing" }].concat(Q);
  const TOTAL_Q = 10;

  const GOALS_BY_TEXTURE = {
    straight: [["lost_shape", "Mein Haar verliert schnell Form und Halt"], ["flat", "Mein Haar wirkt schnell platt oder beschwert"]],
    wavy: [["lost_shape", "Meine Wellen verlieren schnell ihre Form"], ["flat", "Mein Ansatz wirkt flach oder meine Längen schnell beschwert"]],
    curly: [["lost_shape", "Meine Locken verlieren schnell ihre Definition"], ["flat", "Form oder Volumen wirken schnell ungleichmäßig"]],
    coily: [["lost_shape", "Meine Definition hält nicht so, wie ich es möchte"], ["flat", "Form oder Volumen verteilen sich nicht so, wie ich es möchte"]],
  };
  const GOALS_COMMON = [["dry", "Trockene oder strohige Längen"], ["frizz", "Frizz oder viele abstehende Haare"], ["shine", "Wenig Glanz"], ["damaged", "Mein Haar wirkt insgesamt strapaziert oder geschädigt"], ["thinning", "Haarausfall oder dünner werdendes Haar"], ["breakage", "Mein Haar bricht in den Längen ab"], ["split", "Meine Spitzen sind sichtbar gespalten oder ausgefranst"]];

  /* ————— Beispiel-Produkte + Urteilslogik (Demo, an die Antworten gekoppelt) ————— */
  const TH_LABEL = { fine: "fein", normal: "mittel", coarse: "dick" };
  const TX_ADJ = { straight: "glattes", wavy: "welliges", curly: "lockiges", coily: "krauses" };
  const SCALP_LABEL = { oily: "fettig", balanced: "ausgeglichen", dry: "trocken" };
  const DENS_LABEL = { low: "wenig Haaren", medium: "mittlerer Dichte", high: "vielen Haaren" };

  const PRODUCTS = {
    ogx: { name: "OGX Argan Oil of Morocco Shampoo", cat: "Shampoo", price: "ca. 6,95 €", img: "ogx.png", kind: "shampoo", vals: { clean: "regulär", scalp: "jede", thick: "dick" } },
    isana: { name: "Isana Anti-Schuppen Shampoo", cat: "Shampoo", price: "ca. 1,45 €", img: "isana.png", kind: "shampoo", vals: { clean: "klärend", scalp: "Schuppen", thick: "jede" } },
    balea: { name: "Balea Feuchtigkeits-Spülung", cat: "Spülung", price: "ca. 1,25 €", img: "balea.png", kind: "conditioner", vals: { weight: "leicht", dir: "Feuchtigkeit", thick: "fein" } },
    monday: { name: "MONDAY Moisture Shampoo", cat: "Shampoo", price: "ca. 3,95 €", img: "monday.png", kind: "shampoo" },
    alverde: { name: "Alverde Feuchtigkeits-Shampoo", cat: "Shampoo", price: "ca. 2,45 €", img: "alverde.png", kind: "shampoo" },
  };
  function targets(ans) {
    const th = TH_LABEL[ans.thickness] || "fein";
    const cond = ans.scalpConditions || [];
    let sc = SCALP_LABEL[ans.scalpType] || "ausgeglichen";
    if (cond.includes("dandruff")) sc = "Schuppen"; else if (cond.includes("dry_dandruff")) sc = "trockene Schuppen"; else if (cond.includes("irritated")) sc = "gereizt";
    return { clean: ans.scalpType === "oily" ? "klärend" : "regulär", scalp: sc, thick: th, weight: th === "dick" ? "reichhaltig" : th === "mittel" ? "mittel" : "leicht", dir: "Feuchtigkeit" };
  }
  const AX = { shampoo: [["clean", "Reinigung"], ["scalp", "Kopfhaut"], ["thick", "Haar-­dicke"]], conditioner: [["weight", "Pflege-­gewicht"], ["dir", "Pflege-­richtung"], ["thick", "Haar-­dicke"]] };
  function judge(pid, ans) {
    const p = PRODUCTS[pid], t = targets(ans);
    const rows = AX[p.kind].map(([k, label]) => {
      const pv = p.vals[k], tv = t[k];
      let st = "ok";
      if (pv === "jede" || pv === tv) st = "ok";
      else if (k === "scalp") st = "bad";
      else if (k === "thick") st = (pv === "dick" && tv === "mittel") || (pv === "fein" && tv === "mittel") ? "warn" : "bad";
      else if (k === "clean") st = "warn";
      else if (k === "weight") st = pv === "leicht" && tv === "mittel" ? "warn" : "bad";
      else st = "warn";
      return { k, label, pv, tv, st };
    });
    const bad = rows.filter(r => r.st === "bad"), warn = rows.filter(r => r.st === "warn");
    let verdict, cls;
    if (bad.length) { verdict = bad[0].k === "scalp" ? "Passt nicht zu deiner Kopfhaut" : "Passt nicht zu deinem Haar"; cls = "bad"; }
    else if (warn.length) { verdict = "Passt mit Einschränkung"; cls = "warn"; }
    else { verdict = "Passt zu deinem Haar"; cls = "ok"; }
    const dev = rows.filter(r => r.st !== "ok").map(r => `${r.label.replace(/­/g, "")}: ${r.pv} statt ${r.tv}`).join(" · ") || "Alles im Ziel.";
    return { p, rows, verdict, cls, dev, alts: cls === "ok" ? [] : ["monday", "alverde"] };
  }
  const glyph = { ok: "✓", warn: "!", bad: "✕" };
  function sheetHTML(j) {
    return `<div class="sheetwrap" data-a="closeSheet"><div class="sheet" onclick="event.stopPropagation()">
      <div class="grab"><i></i></div><button class="x" data-a="closeSheet" aria-label="Schließen">×</button>
      <div class="body"><span class="bsp">Beispiel</span>
        <div class="prod"><div class="pk"><img src="${A}${j.p.img}" alt=""></div><div><div class="nm">${j.p.name}</div><div class="ct">${j.p.cat} · ${j.p.price}</div></div></div>
        <p class="verdict ${j.cls === "warn" ? "warn" : ""}">${j.verdict}</p><p class="devline">${j.dev}</p>
        <div class="tbl"><div class="hd"><span></span><span></span><span>Produkt</span><b>Dein Ziel</b><span></span></div>
          ${j.rows.map(r => `<div class="r ${r.st}"><span class="n">${r.label}</span><span class="s">${glyph[r.st]}</span><span class="p">${r.pv}</span><span class="g">${r.tv}</span><span class="i">i</span></div>`).join("")}</div>
        ${j.alts.length ? `<div class="alts"><h4>Alternativen</h4><p class="sub">Passen gleich gut oder besser · ${j.alts.length}</p><div class="car">${j.alts.map(a => `<div class="card"><div class="band"><img src="${A}${PRODUCTS[a].img}" alt=""></div><div class="cn">${PRODUCTS[a].name}</div></div>`).join("")}</div></div>` : ""}
      </div><div class="foot"><button class="b1">Kaufen ↗</button><button class="b2">Merken</button></div></div></div>`;
  }
  function floatCard(j, tag) {
    return `<div class="vcardf">${tag ? `<span class="demo">${tag}</span>` : ""}<div class="ph2"><div class="pk"><img src="${A}${j.p.img}" alt=""></div><div><div class="nm">${j.p.name}</div><div class="ct">${j.p.cat} · ${j.p.price}</div></div></div><div class="vd ${j.cls === "warn" ? "warn" : ""}">${j.verdict}</div><div class="dev">${j.dev}</div></div>`;
  }
  const photo = (name, cls, tag) => `<div class="comp ${cls || ""}"><img class="bg" src="${A}${name}" alt="">${tag ? `<span class="ptag">${tag}</span>` : ""}</div>`;
  const composite = (name, j, tag, cls) => `<div class="comp ${cls || ""}"><img class="bg" src="${A}${name}" alt="">${floatCard(j, tag)}</div>`;
  function profileLine(ans) {
    const tx = TX_ADJ[ans.texture] || "welliges";
    const th = ans.thickness === "coarse" ? "dickes" : ans.thickness === "normal" ? "mittelstarkes" : "feines";
    const de = DENS_LABEL[ans.density] || "mittlerer Dichte";
    return `${tx.charAt(0).toUpperCase() + tx.slice(1)}, ${th} Haar mit ${de}.`;
  }
  const hairLabel = ans => `${TX_ADJ[ans.texture] || "welliges"} Haar`;

  /* ————— State ————— */
  const S = { v: "A", i: 0, ans: {}, sheet: null, plan: "year", multi: {}, name: "Lena" };
  const $ = sel => document.querySelector(sel);
  const screen = $("#screen");
  const step = () => SEQ[S.i];
  const total = SEQ.length;

  /* ————— Legacy-Chrome: Zurück · Balken · n/10, Info-Strip auf Frage 1 ————— */
  function qhead(n, opts) {
    const o = opts || {};
    const pct = n ? Math.round((n / TOTAL_Q) * 100) : (o.pct ?? 100);
    return `<div class="lq">${o.strip ? `<div class="strip"><span class="si">i</span><span><b>Lass uns deine Haare verstehen — Schritt für Schritt.</b> 10 schnelle Fragen zur Basis, dann urteilt der Scanner über deine Produkte.</span><button class="sx" aria-label="Hinweis schließen">×</button></div>` : ""}
      <div class="pbar"><button class="back" data-a="back" aria-label="Zurück">${BACK}</button><div class="bar"><div class="fill" style="width:${pct}%"></div></div><span class="cnt">${n ? `${n}/${TOTAL_Q}` : (o.cnt || "")}</span></div></div>`;
  }
  function bottom(label, opts) {
    const o = opts || {};
    return `<div class="bottom"><button class="cta ${o.cls || ""}" data-a="${o.action || "next"}" ${o.disabled ? "disabled" : ""}>${label}</button>${o.fine ? `<p class="fineprint">${o.fine}</p>` : ""}</div>`;
  }

  /* ————— Fragen ————— */
  function renderQuestion(q) {
    const sel = S.ans[q.id];
    const ms = S.multi[q.id] || [];
    let options = q.options, title = q.title;
    if (q.id === "goals") { options = (GOALS_BY_TEXTURE[S.ans.texture] || GOALS_BY_TEXTURE.wavy).concat(GOALS_COMMON); title = `Was wünschst du dir für ${hairLabel(S.ans)}?`; }
    let opts = "";
    if (q.kind === "visual") {
      opts = `<div class="opts grid">${options.map(([v, l, img]) => `<button class="opt vis ${sel === v ? "sel" : ""}" data-a="answer" data-v="${v}"><img src="${A}${img}" alt="${l}"><div class="foot"><span class="t">${l}</span><span class="chk">${CHECK}</span></div></button>`).join("")}</div>`;
    } else if (q.kind === "thumb") {
      opts = `<div class="opts">${options.map(([v, l, d, img]) => `<button class="opt thumb ${sel === v ? "sel" : ""}" data-a="answer" data-v="${v}"><img src="${A}${img}" alt=""><span class="t">${l}<span class="d">${d}</span></span><span class="chk">${CHECK}</span></button>`).join("")}</div>`;
    } else if (q.kind === "multi") {
      opts = `<div class="opts">${options.map(([v, l, d]) => `<button class="opt ${ms.includes(v) ? "sel" : ""}" data-a="toggle" data-v="${v}"><span class="t">${l}${d ? `<span class="d">${d}</span>` : ""}</span><span class="chk sq">${CHECK}</span></button>`).join("")}</div>`;
    } else {
      opts = `<div class="opts">${options.map(([v, l, d]) => `<button class="opt ${sel === v ? "sel" : ""}" data-a="answer" data-v="${v}"><span class="t">${l}${d ? `<span class="d">${d}</span>` : ""}</span><span class="chk">${CHECK}</span></button>`).join("")}</div>`;
    }
    const foot = q.kind === "multi" ? bottom(ms.length ? `${ms.length} ausgewählt · Weiter` : "Weiter", { disabled: !ms.length }) : "";
    return `<div class="view">${qhead(q.n, { strip: q.n === 1 })}<div class="qbody">${q.eyebrow ? `<div class="eyebrow">${q.eyebrow}</div>` : ""}<h2 class="q">${title}</h2>${q.helper ? `<p class="helper">${q.helper}</p>` : ""}${opts}</div>${foot}</div>`;
  }

  /* ————— Landing ————— */
  function lhead(cta) {
    return `<div class="lhead"><span class="wm"><i><svg viewBox="0 0 24 24"><path d="M12 2C9 7 5 11 5 15a7 7 0 0014 0c0-4-4-8-7-13z"/></svg></i>chaarlie</span>${cta ? `<button class="pillbtn" data-a="next">${cta}</button>` : `<button class="lnk">Anmelden</button>`}</div>`;
  }
  const STACK = `<div class="stack"><div><i></i>Produkt-Scanner</div><div><i></i>Persönlicher Plan</div><div><i></i>Anwendung Schritt für Schritt</div><div><i></i>Chat mit Chaarlie</div></div>`;
  function renderLanding() {
    const j = judge("ogx", { thickness: "fine" });
    const v = S.v;
    let hero;
    if (v === "B") {
      hero = `<span class="pilltag">Drogerie-Regal</span><h1>200 Shampoos im Regal. Eins passt zu dir.</h1><p class="lede">Chaarlie zeigt dir per Scan, welches. Dafür braucht es dein Haarprofil – 10 Fragen, 2 Minuten.</p>${photo("frau-regal-aha.webp", "tall")}<div class="quote"><p>„Ich weiß nie, welche Produkte wirklich zu mir passen.“</p><footer>Häufigste Antwort · eigene Umfrage, 4.024 Frauen</footer></div>`;
    } else {
      hero = `<span class="pilltag">Produkt-Scanner</span><h1>Scan ein Shampoo – und du weißt, ob es zu deinem Haar passt.</h1><p class="lede">Damit das klappt, braucht Chaarlie dein Haarprofil: 10 Fragen, 2 Minuten. Danach checkst du die gängigen Drogerie-Produkte – im Regal und bei dir im Bad.${v === "C" ? " Zwischendurch kannst du den Scanner schon ausprobieren." : ""}</p>${composite("regal-hand-phone.webp", j, "Beispiel", "tall")}`;
    }
    return `<div class="view">${lhead("Haarprofil erstellen")}<div class="land">${hero}
      <div class="eyebrow" style="margin-top:6px">So funktioniert’s</div>
      <div class="steps"><div><b>1</b><div><div class="t">Haarprofil</div><div class="d">10 Fragen zu Struktur, Kopfhaut und Zielen.</div></div></div><div><b>2</b><div><div class="t">Scannen</div><div class="d">Barcode in den Rahmen halten – im Regal oder zu Hause.</div></div></div><div><b>3</b><div><div class="t">Ergebnis</div><div class="d">Passt, passt mit Einschränkung oder passt nicht – plus Alternativen, die passen.</div></div></div></div>
      <div class="eyebrow" style="margin-top:6px">Im Chaarlie-Abo</div>${STACK}
    </div>${bottom("Haarprofil erstellen", { fine: "10 Fragen · 2 Minuten · danach ist dein Scanner startklar" })}</div>`;
  }

  /* ————— Einfügungen: jede nutzt die Antwort davor ————— */
  function renderInsert(f) {
    const v = S.v, ans = S.ans;
    const th = TH_LABEL[ans.thickness] || "fein";
    const tx = TX_ADJ[ans.texture] || "welliges";
    const t = targets(ans);
    const wrap = (html, cta, opts) => `<div class="view">${qhead(0, Object.assign({ cnt: "Kurz zwischendurch" }, opts || {}))}<div class="qbody">${html}</div>${bottom(cta || "Weiter")}</div>`;

    if (f.id === "ins1") {
      const jo = judge("ogx", ans);
      if (v === "B") return wrap(`<div class="eyebrow">Das Problem</div><h2 class="q">Vorm Regal raten alle.</h2>${composite("frau-regal-aha.webp", jo, "Beispiel")}<div class="stat">63 %</div><p class="helper">suchen Klarheit, welche Produkte wirklich zu ihnen passen. Raten kostet Geld, Zeit und ein Regal voller halbleerer Flaschen.</p><p class="helper"><b>Dein Anfang der Lösung:</b> ${tx} Haar, ${th}. Drei Antworten, die der Scanner ab jetzt kennt.</p>`, "Weiter", { pct: 30 });
      return wrap(`<h2 class="q">So sieht das später aus.</h2><p class="helper">Der Scanner vergleicht jedes Produkt mit deinem Haar. Zwei Dinge weiß er jetzt schon: ${tx} Haar, ${th}.</p>${composite("frau-regal-aha.webp", jo, "Beispiel", "tall")}`, "Weiter", { pct: 30 });
    }
    if (f.id === "ins2") {
      if (v === "C") return renderProbier();
      const ji = judge("isana", ans);
      const scalpLine = `Du hast „${t.scalp}“ angegeben. Ab jetzt prüft der Scanner jedes Shampoo genau daran – und sagt dir vorm Regal, ob es passt.`;
      if (v === "B") { const bLine = `Du hast „${t.scalp}“ angegeben. Jedes Shampoo, das nicht dazu passt, erkennt der Scanner in Sekunden – bevor es im Korb landet.`; return wrap(`<div class="eyebrow">Die Lösung</div><h2 class="q">Nicht mehr raten. Scannen.</h2><p class="helper">${bLine}</p>${composite("regal-scan-flasche.webp", ji, "Beispiel", "tall")}`, "Weiter", { pct: 80 }); }
      return wrap(`<h2 class="q">Beim Shampoo entscheidet deine Kopfhaut.</h2><p class="helper">${scalpLine}</p>${composite("regal-scan-flasche.webp", ji, "Beispiel", "tall")}`, "Weiter", { pct: 80 });
    }
    if (f.id === "ins3") {
      const jb = judge("balea", ans);
      const weightLine = "";
      if (v === "B") return wrap(`<div class="eyebrow">Und zu Hause</div><h2 class="q">Dein Bad ist das erste Regal.</h2><p class="helper">Scann, was da steht. Was passt, bleibt. Was nicht passt, fliegt raus. Was fehlt, kommt in deinen Plan.</p>${composite("bad-ablage.webp", jb, "Beispiel", "tall")}`, "Weiter", { pct: 100 });
      return wrap(`<h2 class="q">Und was schon bei dir im Bad steht?</h2><p class="helper">Scannst du auch. Was passt, bleibt. Was nicht passt, siehst du sofort. Was fehlt, kommt in deinen Plan.${weightLine}</p>${composite("bad-ablage.webp", jb, "Beispiel", "tall")}`, "Weiter", { pct: 100 });
    }
    return wrap(`<h2 class="q">${f.label}</h2>`);
  }
  function renderProbier() {
    const done = S.multi.__probier || [];
    return `<div class="view">${qhead(0, { cnt: "Probier-Scan", pct: 80 })}<div class="qbody"><h2 class="q">Probier’s aus: Tipp ein Produkt an.</h2><p class="helper">Ein Beispiel auf Basis deiner Antworten bis hier. Das echte Ergebnis kommt mit dem fertigen Profil.</p>
      <div class="cam"><img src="${A}kamera-crop.png" alt=""><span class="demo-tag">Demo</span>${done.length ? "" : `<div class="line"></div>`}</div>
      <div class="chips">${["isana", "ogx", "balea"].map(p => `<button class="chip ${done.includes(p) ? "done" : ""}" data-a="probe" data-p="${p}"><img src="${A}${PRODUCTS[p].img}" alt="">${PRODUCTS[p].name.split(" ").slice(0, 2).join(" ")}</button>`).join("")}</div>
      </div>${bottom(done.length ? "Weiter" : "Erst mal weiter", { cls: done.length ? "" : "ghost" })}${S.sheet ? sheetHTML(S.sheet) : ""}</div>`;
  }

  /* ————— Lead-Erfassung (3 Teilschritte wie heute), Bereit-Screen, Laden ————— */
  function renderLead(s) {
    const head = qhead(0, { cnt: "", pct: 100 });
    if (s.id === "lead_name") return `<div class="view">${head}<div class="qbody"><div class="eyebrow">Dein Haarprofil ist fertig.</div><h2 class="q">Wie heißt du?</h2><div class="field"><input type="text" placeholder="Dein Vorname" value="${S.name}" data-f="name"></div></div>${bottom("Weiter")}</div>`;
    if (s.id === "lead_email") return `<div class="view">${head}<div class="qbody"><h2 class="q">Deine E-Mail-Adresse</h2><p class="helper">Hierhin schicken wir dein Ergebnis.</p><div class="field"><input type="email" placeholder="name@beispiel.de" value="lena@beispiel.de"></div><p class="helper" style="font-size:12.5px">Wir schützen deine Daten und nehmen Datenschutz sehr ernst – kein Spam.</p></div>${bottom("Weiter zum Ergebnis")}</div>`;
    return `<div class="view">${head}<div class="qbody"><h2 class="q">Dürfen wir dir Haarpflege-Tipps schicken?</h2><p class="helper">Dein Ergebnis bekommst du in jedem Fall. Mit Ja erlaubst du zusätzliche Tipps, Produkt-News und Angebote per E-Mail.</p><div class="opts"><button class="opt" data-a="next"><span class="t">Ja, gerne</span><span class="chk">${CHECK}</span></button><button class="opt" data-a="next"><span class="t">Nein, nur mein Ergebnis</span><span class="chk">${CHECK}</span></button></div></div></div>`;
  }
  function renderCommit() {
    return `<div class="view">${qhead(0, { cnt: "", pct: 100 })}<div class="qbody" style="justify-content:center;flex:1"><div class="ctx" style="height:190px"><img src="${A}feelgood-hair.webp" alt="" style="object-position:50% 20%"></div><h2 class="q">${S.name}, bereit für deinen ersten Scan?</h2><p class="helper">Dein Haarprofil ist komplett. Jetzt richten wir den Scanner für dich ein.</p></div>${bottom("Ja, zeig mir meinen Scanner", { cls: "plum" })}</div>`;
  }
  function renderLoading() {
    const stages = ["Haarprofil wird ausgewertet", "Passende Kriterien für Shampoo, Spülung, Kur & Co.", "Dein Plan wird vorbereitet"];
    return `<div class="view">${qhead(0, { cnt: "", pct: 100 })}<div class="qbody" style="justify-content:center;flex:1;gap:20px"><h2 class="q">Wir richten deinen Scanner ein.</h2><div class="ring" id="ring"><b id="ringv">0 %</b></div><div class="stages" id="stages">${stages.map(s => `<div><i>✓</i>${s}</div>`).join("")}</div></div></div>`;
  }

  /* ————— Angebot ————— */
  function heroDemo(ans) {
    const j = judge("ogx", ans);
    const mini = j.rows.map(r => `<span class="${r.st}-t">${r.label.replace(/­/g, "")}: ${r.pv}</span>`).join("");
    return `<div class="cam" id="heroCam"><img src="${A}kamera-crop.png" alt=""><span class="demo-tag">Demo</span><img class="bottle" src="${A}ogx.png" alt=""><div class="line"></div></div><template id="heroSheet"><div class="ms"><div class="h ${j.cls === "warn" ? "warn" : ""}">${j.verdict}</div><div class="d">${j.dev}</div><div class="mini">${mini}</div></div></template>`;
  }
  function renderOffer() {
    const ans = S.ans, v = S.v, t = targets(ans);
    const heroTitle = v === "B" ? "Nie wieder raten vorm Regal." : "Dein Scanner ist startklar.";
    const sec = (cls, html) => `<section class="osec ${cls || ""}">${html}</section>`;
    const hero = sec("", `<div class="eyebrow">Dein Haarprofil ist fertig</div><h2 class="hero">${heroTitle}</h2><p class="sub">${profileLine(ans)}</p>${heroDemo(ans)}<p class="cap">So prüft der Scanner Produkte für dein Profil – bei den gängigen Produkten von dm und Rossmann.</p>`);
    const crit = sec("alt", `<div class="eyebrow">Deine Kriterien</div><h2>Darauf achtet der Scanner bei dir.</h2><p class="sub">Abgeleitet aus deinen 10 Antworten.</p><div class="crit"><span>Haardicke: ${t.thick}</span><span>Kopfhaut: ${t.scalp}</span><span>Reinigung: ${t.clean}</span><span>Pflegegewicht: ${t.weight}</span><span>Richtung: ${t.dir}</span><span>Hitzeschutz</span><span>Repair-Pflege</span></div><p class="cap">Jede Zeile im Ergebnis lässt sich antippen und erklärt sich.</p>`);
    const tour = sec("", `<div class="eyebrow">Was du bekommst</div><h2>Scanner, Plan und Chat – in einer App.</h2><p class="sub">Alles im Chaarlie-Abo. Echte Screenshots.</p><div class="tour">
        <div class="tc"><div class="shot"><span class="tag">Scanner</span><img src="${A}kamera-crop.png" alt=""></div><div class="tt">Produkt-Scanner</div><div class="td">Barcode scannen, Ergebnis und passende Alternativen sehen – im Regal und zu Hause.</div></div>
        <div class="tc"><div class="shot"><span class="tag">Plan</span><img src="${A}routine.png" alt=""></div><div class="tt">Dein Plan</div><div class="td">Wenige Produkte, feste Reihenfolge – gebaut aus deinem Profil.</div></div>
        <div class="tc"><div class="shot"><span class="tag">Anwendung</span><img src="${A}anwendung.png" alt=""></div><div class="tt">Anwendung</div><div class="td">Waschtag für Waschtag: Menge, Reihenfolge, Einwirkzeit.</div></div>
        <div class="tc"><div class="shot"><span class="tag">Chat</span><img src="${A}chat.png" alt=""></div><div class="tt">Frag Chaarlie</div><div class="td">Antworten zu deinem Haar – Chaarlie kennt dein Profil.</div></div></div>`);
    const hl = sec("alt", `<div class="eyebrow">Die Highlights</div><h2>Was sich für dich ändert.</h2><div class="hl"><div><i>✓</i><span><strong>Vorm Regal</strong> weißt du in Sekunden, ob ein Produkt zu dir passt – statt zu raten.</span></div><div><i>✓</i><span><strong>Zu Hause</strong> sortierst du aus, was dein Haar beschwert oder austrocknet.</span></div><div><i>✓</i><span><strong>Dein Plan</strong> füllt die Lücken: wenige Produkte, klare Reihenfolge.</span></div><div><i>✓</i><span><strong>Fahr dir durch die Haare</strong> und sie fühlen sich weich an – nicht trocken und strohig.</span></div></div>`);
    const plans = sec("", `<div class="eyebrow">Freischalten</div><h2>Scanner und Plan freischalten.</h2><div class="plans" id="plans">
        <div class="plan ${S.plan === "month" ? "sel" : ""}" data-a="plan" data-p="month"><div><div class="pn">Monatlich</div><div class="pd">Jederzeit kündbar</div></div><div class="pp">14,99 €<span class="pm">pro Monat</span></div></div>
        <div class="plan ${S.plan === "quarter" ? "sel" : ""}" data-a="plan" data-p="quarter"><div><div class="pn">Quartal</div><div class="pd">3 Monate</div></div><div class="pp">34,99 €<span class="pm">≈ 11,66 € / Monat</span></div></div>
        <div class="plan ${S.plan === "year" ? "sel" : ""}" data-a="plan" data-p="year"><span class="rec">Empfohlen</span><div><div class="pn">Jährlich</div><div class="pd">12 Monate</div></div><div class="pp">99,99 €<span class="pm">≈ 8,33 € / Monat</span></div></div>
      </div><div style="margin-top:14px"><button class="cta" data-a="next">Jetzt freischalten</button><p class="fineprint">14 Tage Geld-zurück-Garantie · Details in den Bedingungen</p></div>`);
    const cov = sec("alt", `<div class="eyebrow">Kennt der Scanner mein Produkt?</div><div class="cov"><b>Die gängigen Produkte von dm und Rossmann.</b>Unbekanntes Produkt? Ein Tipp genügt – wir prüfen es und melden uns im Chat, sobald das Ergebnis da ist.</div>`);
    const method = sec("", `<h2>Dein Ergebnis basiert auf echter Haar-Diagnostik:</h2><div class="tiles"><div><strong>Zugtest</strong><span>Struktur &amp; Elastizität</span></div><div><strong>Oberflächentest</strong><span>Haaroberfläche &amp; Glanz</span></div><div><strong>Kopfhaut-Check</strong><span>Typ &amp; Zustand</span></div><div><strong>Produkt-Fakten</strong><span>Geprüfte Inhaltsstoffe je Produkt</span></div></div><p class="cap">Entwickelt gemeinsam mit Friseurmeistern.</p>`);
    const ba = sec("alt", `<h2>Vorher und <span style="color:var(--plum)">nachher</span> mit Chaarlie</h2><p class="sub">So beschreiben es Frauen in unserer Umfrage:</p><div class="ba"><article><div class="b"><span>×</span>„Ich weiß nie, welche Produkte wirklich zu mir passen.“</div><div class="a"><span>✓</span>Zu jedem Produkt ein klares Ergebnis für dein Haar</div></article><article><div class="b"><span>×</span>„Meine Haare sind trocken, strohig oder glanzlos.“</div><div class="a"><span>✓</span>Weich, geschmeidig, mit Glanz, den man sieht</div></article><article><div class="b"><span>×</span>Haare im Dutt oder Zopf verstecken</div><div class="a"><span>✓</span>Haare offen tragen, mit gutem Gefühl</div></article></div>`);
    const surv = sec("", `<div class="eyebrow">Was Frauen wirklich beschäftigt</div><h2>Über 4.000 Frauen haben uns geantwortet.</h2><div class="surv"><div><div class="n">82 %</div><div class="l">wollen verstehen, was ihr Haar wirklich braucht</div></div><div><div class="n">73 %</div><div class="l">wünschen sich eine klare Routine ohne Produktchaos</div></div><div><div class="n">63 %</div><div class="l">suchen Klarheit, welche Produkte wirklich passen</div></div></div><p class="cap">Quelle: eigene Umfrage · 4.024 Antworten · Mehrfachauswahl möglich</p>`);
    const tst = sec("alt", `<div class="eyebrow">Stimmen aus der Beta</div><h2>Das sagen Kundinnen über Chaarlie.</h2><div class="tst">
      <blockquote><div class="st">★★★★★</div><strong>Sarah · Nie wieder googeln vorm Regal</strong><p>„Bei den Produkten stehen Preis, Anwendung und der Grund dabei, warum sie empfohlen werden.“</p></blockquote>
      <blockquote><div class="st">★★★★★</div><strong>Kim · Endlich verstehe ich meine Haare</strong><p>„Der Fragebogen ist echt gut und leicht verständlich. Auch die Produktempfehlung fand ich gut.“</p></blockquote>
      <blockquote><div class="st">★★★★★</div><strong>Kerstin · Echte Antworten bekommen</strong><p>„Ich finde die Interaktion sehr gut: meine Fragen stellen zu können und dann die benötigten Antworten zu bekommen.“</p></blockquote></div>`);
    const guar = sec("", `<div class="guar"><div class="eyebrow">Ohne Risiko</div><h2 style="font-size:26px">14 Tage Geld-zurück-Garantie</h2><p class="sub" style="margin:0">Wenn Chaarlie für dich nicht hilfreich ist, bekommst du dein Geld zurück.</p></div>`);
    const faq = sec("alt", `<h2>Häufige Fragen</h2><div class="faq">
      <details><summary>Welche Produkte kennt der Scanner?</summary><p>Die gängigen Haarpflege-Produkte von dm und Rossmann: Shampoos, Spülungen, Kuren, Leave-ins, Öle, Hitzeschutz. Unbekannte Produkte nimmst du mit einem Tipp auf – wir prüfen sie und melden uns im Chat.</p></details>
      <details><summary>Brauche ich den Plan, wenn ich den Scanner habe?</summary><p>Der Scanner sagt dir, ob ein einzelnes Produkt zu dir passt. Der Plan sagt dir, welche wenigen Produkte du in welcher Reihenfolge brauchst – und was du dir sparen kannst. Beides gehört zusammen und ist im Abo enthalten.</p></details>
      <details><summary>Ist das Ergebnis wirklich auf mein Haar abgestimmt?</summary><p>Ja. Jedes Ergebnis vergleicht die Produktfakten mit deinen Kriterien aus dem Haarprofil: Haardicke, Kopfhaut, Reinigung, Pflegegewicht und mehr. Jede Zeile lässt sich antippen und erklärt sich.</p></details>
      <details><summary>Kann ich meine bisherigen Produkte weiterverwenden?</summary><p>Ja – scann sie einfach. Was passt, bleibt in deinem Plan. Was nicht passt, siehst du sofort, bevor du etwas wegwirfst.</p></details>
      <details><summary>Was passiert direkt nach dem Kauf?</summary><p>Du landest im Scanner. Dein Profil ist schon da, dein Plan wartet daneben. Scann als Erstes, was in deinem Bad steht.</p></details></div>`);
    const final = sec("", `<h2>Dein Scanner wartet.</h2><p class="sub">Scann als Erstes, was bei dir im Bad steht.</p><button class="cta" data-a="next">Jetzt freischalten</button>`);
    const order = v === "B" ? [hero, ba, crit, tour, plans, cov, hl, method, surv, tst, guar, faq, final] : [hero, crit, tour, hl, plans, cov, method, ba, surv, tst, guar, faq, final];
    return `<div class="view"><div class="lhead" style="position:sticky;top:0;z-index:5;background:rgba(250,248,245,.94);backdrop-filter:blur(8px)"><span class="wm">chaarlie</span><button class="pillbtn" data-a="scrollPlans">Angebot ansehen</button></div><div class="offer">${order.join("")}</div></div>`;
  }
  function renderCheckout() {
    const p = { month: ["Monatlich", "14,99 €"], quarter: ["Quartal", "34,99 €"], year: ["Jährlich", "99,99 €"] }[S.plan];
    return `<div class="view"><div class="lhead"><button class="back" data-a="back" aria-label="Zurück" style="border:none;background:#fff;border-radius:50%;width:38px;height:38px;display:grid;place-items:center;cursor:pointer">${BACK}</button><span class="wm">chaarlie</span><span></span></div><div class="qbody" style="gap:16px"><div class="eyebrow">Kauf (Demo)</div><h2 class="q">Scanner &amp; Plan freischalten</h2><div class="plan sel"><div><div class="pn">${p[0]}</div><div class="pd">Scanner · Plan · Anwendung · Chat</div></div><div class="pp">${p[1]}</div></div><div class="field"><label>Zahlungsart</label><div class="opts"><button class="opt sel"><span class="t">Karte</span><span class="chk">${CHECK}</span></button><button class="opt"><span class="t">PayPal</span><span class="chk">${CHECK}</span></button></div></div><p class="helper" style="font-size:12.5px">Demo: Es wird nichts berechnet. In der Produktion steht hier der bestehende Zahlungs-Slot.</p></div>${bottom(`${p[1]} bezahlen`, { fine: "14 Tage Geld-zurück-Garantie" })}</div>`;
  }
  function renderWelcome() {
    return `<div class="view"><div class="lhead"><span class="wm">chaarlie</span><span></span></div><div class="qbody" style="gap:16px"><div class="eyebrow">Willkommen, ${S.name}</div><h2 class="q">Dein Scanner ist startklar.</h2><p class="helper">Scann als Erstes, was bei dir im Bad steht. Dein Plan wartet daneben.</p><div class="cam" style="height:380px"><img src="${A}kamera-crop.png" alt=""><div class="line"></div></div><p class="helper" style="font-size:12.5px">Offene Entscheidung: Landet man nach dem Kauf im Scanner (wie hier) oder wie heute auf „Plan bereit“?</p></div>${bottom("Scanner öffnen", { action: "reset" })}</div>`;
  }

  /* ————— Render ————— */
  let loadTimer = null;
  function render() {
    clearTimeout(loadTimer);
    const s = step();
    let html = "";
    if (s.kind === "landing") html = renderLanding();
    else if (s.kind === "insert") html = renderInsert(s);
    else if (s.kind === "lead") html = renderLead(s);
    else if (s.kind === "commit") html = renderCommit();
    else if (s.kind === "loading") html = renderLoading();
    else if (s.kind === "offer") html = renderOffer();
    else if (s.kind === "checkout") html = renderCheckout();
    else if (s.kind === "welcome") html = renderWelcome();
    else html = renderQuestion(s);
    screen.innerHTML = html;
    screen.scrollTop = 0;
    $("#stepno").textContent = S.i + 1; $("#steptotal").textContent = total;
    $("#vname").textContent = `${VARIANTS[S.v].key} · ${VARIANTS[S.v].name}`;
    $("#varnote").innerHTML = VARIANTS[S.v].note;
    renderMap();
    document.querySelectorAll(".vcard").forEach(b => b.classList.toggle("on", b.dataset.v === S.v));
    if (s.kind === "loading") runLoading();
    if (s.kind === "offer") runHero();
  }
  function runLoading() {
    const stages = [...screen.querySelectorAll("#stages div")];
    const ring = $("#ring"), rv = $("#ringv");
    let p = 0; const ends = [34, 67, 100];
    const tick = () => {
      p += 1; if (!ring || !ring.isConnected) return;
      ring.style.setProperty("--p", p + "%"); rv.textContent = p + " %";
      stages.forEach((st, i) => { st.classList.toggle("act", p < ends[i] && (i === 0 || p >= ends[i - 1])); st.classList.toggle("on", p >= ends[i]); });
      if (p < 100) loadTimer = setTimeout(tick, 42); else loadTimer = setTimeout(() => { S.i += 1; render(); }, 700);
    };
    loadTimer = setTimeout(tick, 300);
  }
  function runHero() {
    const cam = $("#heroCam"); if (!cam) return;
    const tpl = $("#heroSheet");
    const play = () => {
      cam.querySelectorAll(".pill,.ms").forEach(n => n.remove());
      const line = cam.querySelector(".line"); if (line) line.style.display = "";
      setTimeout(() => { if (!cam.isConnected) return; if (line) line.style.display = "none"; cam.insertAdjacentHTML("beforeend", `<span class="pill">✓ Barcode erkannt</span>`); }, 1800);
      setTimeout(() => { if (!cam.isConnected) return; cam.insertAdjacentHTML("beforeend", tpl.innerHTML); }, 2500);
      setTimeout(() => { if (cam.isConnected) play(); }, 7500);
    };
    play();
  }
  function renderMap() {
    const m = $("#map");
    let html = `<h3>Screens</h3>`;
    let grp = "";
    SEQ.forEach((s, i) => {
      const g = s.kind === "landing" ? "Einstieg" : (s.n || s.kind === "insert") ? "Quiz (10 Fragen + 3 Einfügungen)" : s.kind === "lead" || s.kind === "commit" || s.kind === "loading" ? "Ergebnis" : "Angebot";
      if (g !== grp) { html += `<div class="grp">${g}</div>`; grp = g; }
      const isF = !s.n;
      const label = s.label || (s.sub ? `${s.n}b · ${s.title}` : `${s.n} · ${s.title || "Was wünschst du dir für … Haar?"}`);
      html += `<button class="${isF ? "f" : ""} ${i === S.i ? "on" : ""}" data-a="jump" data-i="${i}">${label}</button>`;
    });
    m.innerHTML = html;
  }

  /* ————— Aktionen ————— */
  function next() { if (S.i < total - 1) { S.i += 1; render(); } }
  function back() { if (S.i > 0) { S.i -= 1; render(); } }
  document.addEventListener("click", e => {
    const el = e.target.closest("[data-a]"); if (!el) return;
    const a = el.dataset.a; const s = step();
    const nameInput = screen.querySelector('[data-f="name"]'); if (nameInput && nameInput.value.trim()) S.name = nameInput.value.trim();
    if (a === "next") next();
    else if (a === "back") back();
    else if (a === "reset") { S.i = 0; S.ans = {}; S.multi = {}; S.sheet = null; render(); }
    else if (a === "jump") { S.i = +el.dataset.i; S.sheet = null; render(); }
    else if (a === "answer") { S.ans[s.id] = el.dataset.v; el.classList.add("sel"); setTimeout(next, 420); }
    else if (a === "toggle") { const arr = S.multi[s.id] || []; const v = el.dataset.v; const idx = arr.indexOf(v); if (idx >= 0) arr.splice(idx, 1); else arr.push(v); S.multi[s.id] = arr; S.ans[s.id] = arr.slice(); render(); }
    else if (a === "probe") { const p = el.dataset.p; S.sheet = judge(p, S.ans); const d = S.multi.__probier || []; if (!d.includes(p)) d.push(p); S.multi.__probier = d; render(); }
    else if (a === "closeSheet") { S.sheet = null; render(); }
    else if (a === "plan") { S.plan = el.dataset.p; render(); const pl = $("#plans"); if (pl) pl.scrollIntoView({ block: "center" }); }
    else if (a === "scrollPlans") { const pl = $("#plans"); if (pl) pl.scrollIntoView({ behavior: "smooth", block: "start" }); }
  });
  $("#resetBtn").addEventListener("click", () => { S.i = 0; S.ans = {}; S.multi = {}; S.sheet = null; render(); });
  $("#toOffer").addEventListener("click", () => { S.i = SEQ.findIndex(s => s.kind === "offer"); S.sheet = null; render(); });
  const vc = $("#variants");
  vc.innerHTML = Object.values(VARIANTS).map(v => `<button class="vcard ${v.key === S.v ? "on" : ""}" data-v="${v.key}"><div class="k">Variante ${v.key} · ${v.tag}</div><div class="n">${v.name}</div><div class="d">${v.desc}</div></button>`).join("");
  vc.addEventListener("click", e => { const b = e.target.closest(".vcard"); if (!b) return; S.v = b.dataset.v; S.sheet = null; render(); });

  render();
})();
