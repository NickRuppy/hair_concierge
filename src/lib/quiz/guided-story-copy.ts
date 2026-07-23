export const GUIDED_STORY_PRIORITY_FAMILIES = [
  "scalp_flakes",
  "scalp_comfort",
  "strength_damage",
  "moisture_dryness",
  "surface_manageability",
  "ends_protection",
  "definition",
  "volume_weight",
  "color_protection",
] as const

export type GuidedStoryPriorityFamily = (typeof GUIDED_STORY_PRIORITY_FAMILIES)[number]

export const GUIDED_STORY_COPY_RECORDS = [
  {
    family: "scalp_flakes",
    variantId: "scalp_flakes.schuppen",
    title: "Deine Kopfhaut neigt zu Schuppen",
    finding:
      "Die sichtbaren Flöckchen zeigen, dass sich gelöste Hautzellen bei dir schneller auf Kopfhaut und Haar sammeln.",
    why: "Schuppen sind mehr als bloße Trockenheit: Hauterneuerung, Talg und das Milieu deiner Kopfhaut beeinflussen gemeinsam, wie deutlich sie entstehen und wiederkehren.",
    helps:
      "Ein Anti-Schuppen-Shampoo mit einem passenden Wirkstoff setzt direkt an der Kopfhaut an. Bleiben Schuppen, starke Rötung oder Juckreiz bestehen, sollte das dermatologisch abgeklärt werden.",
  },
  {
    family: "scalp_flakes",
    variantId: "scalp_flakes.trockene_schuppen",
    title: "Deine Kopfhaut ist trocken und schuppt",
    finding:
      "Feine trockene Flöckchen zusammen mit Spannungsgefühl sprechen bei dir für eine Kopfhaut, der gerade Ruhe und eine mildere Pflege fehlen.",
    why: "Trocken-kaltes Wetter, heißes Wasser und stark entfettende oder reizende Pflege können die Kopfhaut zusätzlich austrocknen und Flöckchen verstärken.",
    helps:
      "Milder reinigen, gründlich ausspülen und starke Hitze sowie Reibung reduzieren. So kann sich die Kopfhaut beruhigen, ohne die Längen unnötig zu belasten.",
  },
  {
    family: "scalp_comfort",
    variantId: "scalp_comfort.gereizte_kopfhaut",
    title: "Deine Kopfhaut ist gereizt",
    finding:
      "Jucken, Rötung oder Brennen zeigen, dass deine Kopfhaut gerade weniger Reize und eine einfachere Routine braucht.",
    why: "Produktrückstände, häufige Wechsel, heißes Wasser oder unverträgliche Inhaltsstoffe können die Kopfhaut immer wieder belasten.",
    helps:
      "Gründlich ausspülen, die Routine vereinfachen und neue Produkte einzeln testen. Wenn die Reizung bleibt oder stärker wird, ist eine dermatologische Abklärung der nächste sinnvolle Schritt.",
  },
  {
    family: "scalp_comfort",
    variantId: "scalp_comfort.fettige_kopfhaut",
    title: "Dein Ansatz fettet schnell nach",
    finding:
      "Deine Kopfhaut bildet sichtbar schneller Talg, als deine Längen ihn benötigen. Dadurch wirkt der Ansatz schon nach kurzer Zeit ölig.",
    why: "Die Talgproduktion ist individuell. Wird der Ansatz nicht passend gereinigt, sammeln sich Öl und Rückstände schneller an und nehmen dem Haar Frische und Volumen.",
    helps:
      "Den Ansatz so oft reinigen, wie er sichtbar ölig wird, und dafür ein Shampoo wählen, das Rückstände zuverlässig entfernt. Conditioner und reichhaltigere Produkte gehören vor allem in die Längen; leichte Stylingprodukte beschweren den Ansatz weniger.",
  },
  {
    family: "scalp_comfort",
    variantId: "scalp_comfort.trockene_kopfhaut",
    title: "Deine Kopfhaut neigt zu Trockenheit",
    finding:
      "Das Spannungsgefühl zeigt, dass deine Kopfhaut durch Reinigung und äußere Einflüsse schneller aus dem Gleichgewicht gerät.",
    why: "Heißes Wasser, trockene Luft und stark entfettende oder reizende Pflege können den natürlichen Schutzfilm der Kopfhaut zusätzlich belasten.",
    helps:
      "Milder reinigen, lauwarm ausspülen und unnötige Reize reduzieren. So bleibt die Kopfhaut sauber, ohne dass das Spannungsgefühl weiter verstärkt wird.",
  },
  {
    family: "scalp_comfort",
    variantId: "scalp_comfort.ausgeglichene_kopfhaut",
    title: "Deine Kopfhaut ist gut ausgeglichen",
    finding:
      "Sie bleibt mehrere Tage angenehm und zeigt weder starkes Nachfetten noch deutliches Spannungsgefühl.",
    why: "Reinigung und Talgproduktion passen bei dir bereits gut zusammen. Die Bedürfnisse deiner Längen können trotzdem ganz anders aussehen.",
    helps:
      "Die einfache, gut verträgliche Reinigungsbasis beibehalten und die gezielte Pflege auf deine Längen und persönlichen Haarziele konzentrieren.",
  },
  {
    family: "strength_damage",
    variantId: "strength_damage.haarbruch_schaden_basis",
    title: "Deine Längen brechen zu leicht",
    finding:
      "Der von dir beschriebene Haarbruch zeigt, dass deine Längen bereits geschwächt sind und gezielten Schutz brauchen.",
    why: "Ist die schützende Oberfläche der Haarfaser beschädigt, verliert sie an Widerstandskraft und bricht beim Entwirren, Trocknen oder Stylen leichter.",
    helps:
      "Ein gut gleitender Conditioner und eine schützende Leave-in-Pflege reduzieren Reibung. Zusätzlich helfen sanftes Entwirren und weniger Hitze dabei, weiteren Bruch zu vermeiden.",
  },
  {
    family: "strength_damage",
    variantId: "strength_damage.mit_chemischer_behandlung",
    title: "Deine behandelten Längen sind bruchanfälliger",
    finding:
      "Haarbruch trifft bei dir auf chemisch veränderte Längen – genau dort braucht die Routine mehr Schutz und weniger zusätzliche Belastung.",
    why: "Färben und besonders Aufhellen oder dauerhafte Formveränderungen greifen in die Haarfaser ein und erhöhen ihren Pflege- und Schutzbedarf.",
    helps:
      "Ein Conditioner für geschädigte Längen reduziert Reibung und verbessert die Kämmbarkeit. Ergänzend kann eine Bond-Pflege sinnvoll sein, während weniger Hitze und Zug weiteren Bruch vermeiden.",
  },
  {
    family: "strength_damage",
    variantId: "strength_damage.auffalliger_zugtest",
    title: "Deine Längen reagieren empfindlich auf Zug",
    finding:
      "Beim Zugtest bleibt dein Haar überdehnt oder reißt schnell. Zusammen mit deinem beschriebenen Haarbruch zeigt das, dass die Längen weniger belastbar sind.",
    why: "Nasses Haar lässt sich stärker dehnen; bereits geschwächte Längen halten dieser Belastung schlechter stand. Entscheidend ist deshalb das Gesamtbild aus Zugtest, Haarbruch und chemischer Behandlung.",
    helps:
      "Ein gut gleitender Conditioner schützt beim Entwirren. Bei chemisch behandelten Längen kann zusätzlich eine stärkende oder Bond-Pflege sinnvoll sein; die genaue Auswahl folgt aus deinen übrigen Quizantworten.",
  },
  {
    family: "moisture_dryness",
    variantId: "moisture_dryness.trockenheit_basis",
    title: "Deinen Längen fehlt Geschmeidigkeit",
    finding:
      "Dein Haar fühlt sich trocken an und verliert zwischen den Wäschen schneller seine Weichheit.",
    why: "Die Oberfläche bietet zu wenig Gleitfähigkeit: einzelne Fasern reiben stärker aneinander und die Längen fühlen sich dadurch stumpfer und spröder an.",
    helps:
      "Die Längen bei jeder Wäsche gezielt geschmeidig halten und Reibung beim Trocknen und Kämmen reduzieren. So bleibt das Haar länger weich und leichter formbar.",
  },
  {
    family: "moisture_dryness",
    variantId: "moisture_dryness.trocken_rau_behandelt",
    title: "Deine trockenen Längen sind an der Oberfläche beansprucht",
    finding:
      "Trockenheit und ein raues Gefühl treten bei dir gemeinsam auf – dadurch verhaken sich die Fasern leichter und verlieren Geschmeidigkeit.",
    why: "Färben, Aufhellen, Hitze und wiederholte Reibung rauen die Oberfläche mit der Zeit stärker auf und erhöhen den Pflegebedarf.",
    helps:
      "Schonend reinigen, konsequent pflegen und unnötige Reibung oder Hitze reduzieren. So lassen sich die Längen leichter entwirren und fühlen sich wieder glatter an.",
  },
  {
    family: "surface_manageability",
    variantId: "surface_manageability.frizz",
    title: "Dein Haar braucht mehr Bündelung und Kontrolle",
    finding:
      "Frizz und abstehende Härchen zeigen, dass deine Längen nicht gleichmäßig zusammenliegen und schneller unruhig wirken.",
    why: "Reibung und Luftfeuchtigkeit verändern die Ausrichtung einzelner Fasern. Bei Wellen und Locken verliert dabei besonders die natürliche Bündelung an Klarheit.",
    helps:
      "Ein passendes Leave-in hält die Längen geschmeidig; ein leichtes Stylingprodukt bündelt die natürliche Struktur und gibt Halt. Weniger Reibung beim Trocknen unterstützt zusätzlich ein ruhigeres Haarbild.",
  },
  {
    family: "surface_manageability",
    variantId: "surface_manageability.verknotungen",
    title: "Deine Längen verhaken sich zu schnell",
    finding:
      "Dein Haar bildet schnell Knoten und braucht beim Entwirren mehr Zug – besonders in den längeren oder raueren Partien.",
    why: "Mehr Haar-zu-Haar-Reibung, Länge und eine ungleichmäßigere Oberfläche lassen einzelne Fasern leichter aneinander hängen.",
    helps:
      "Die Gleitfähigkeit erhöhen und das Haar behutsam in Abschnitten entwirren. So lösen sich Knoten leichter und einzelne Haare werden weniger stark belastet.",
  },
  {
    family: "surface_manageability",
    variantId: "surface_manageability.frizz_knoten_glanz",
    title: "Eine glattere Oberfläche löst mehrere deiner Themen",
    finding:
      "Frizz, Knoten und fehlender Glanz hängen bei dir an demselben Hebel: den Längen fehlt gleichmäßige Gleitfähigkeit.",
    why: "Wenn Fasern stärker aneinander reiben und weniger geordnet liegen, verheddern sie sich leichter und reflektieren Licht ungleichmäßiger.",
    helps:
      "Geschmeidigkeit erhöhen, schonend entwirren und die Oberfläche zwischen den Wäschen schützen. Das macht die Längen ruhiger, leichter kämmbar und sichtbar glänzender.",
  },
  {
    family: "surface_manageability",
    variantId: "surface_manageability.nur_glanz_ziel",
    title: "Dein Haar kann mehr Glanz zeigen",
    finding:
      "Deine Oberfläche wirkt bereits relativ glatt – jetzt geht es darum, Lichtreflexion und Geschmeidigkeit besser sichtbar zu machen.",
    why: "Glanz entsteht, wenn die Fasern gleichmäßiger ausgerichtet sind und Licht ruhiger von der Oberfläche zurückgeworfen wird.",
    helps:
      "Die Längen geschmeidig halten und Pflege sowie Styling so dosieren, dass sie Glanz unterstützen, ohne Volumen oder natürliche Bewegung zu beschweren.",
  },
  {
    family: "ends_protection",
    variantId: "ends_protection.spliss_lange_spitzen",
    title: "Deine Spitzen sind stärker abgenutzt",
    finding:
      "Spliss zeigt, dass die ältesten Partien deiner Haare bereits aufgefasert sind und jetzt vor weiterem Abbrechen geschützt werden müssen.",
    why: "Reibung, Bürsten, Hitze und chemische Behandlungen sammeln sich besonders in den Spitzen und tragen die Faser dort Schritt für Schritt ab.",
    helps:
      "Vorhandenen Spliss schneiden lassen und neuen Abrieb mit Pflege, sanfterem Entwirren und weniger Hitze bremsen. Bis zum Schnitt lassen sich die Spitzen glatter und geschützter halten.",
  },
  {
    family: "definition",
    variantId: "definition.wellig_lockig_oder_coily",
    title: "Deine natürliche Struktur braucht mehr Bündelung",
    finding:
      "Deine Wellen, Locken oder Coils sind vorhanden, finden aber noch nicht gleichmäßig zu klaren Strähnen zusammen.",
    why: "Reibung, Entwirren und eine weniger geschmeidige Oberfläche trennen Bündel schneller auf und lassen die natürliche Form unruhiger wirken.",
    helps:
      "Die Struktur beim Pflegen und Stylen gezielt bündeln, Reibung reduzieren und ausreichend Halt geben. So wird deine vorhandene Form klarer und gleichmäßiger sichtbar.",
  },
  {
    family: "definition",
    variantId: "definition.glattes_haar_definitions_ziel",
    title: "Dein glattes Haar braucht mehr Form und Definition",
    finding:
      "Bei deiner glatten Struktur bedeutet Definition vor allem: geordnete Längen, sichtbare Bewegung und ein Styling, das seine Form hält.",
    why: "Wie klar diese Form sichtbar bleibt, hängt davon ab, wie gleichmäßig die einzelnen Haare liegen und wie gut das Styling Halt gibt.",
    helps:
      "Eine leichte Pflege hält die Längen geschmeidig, ohne sie zu beschweren. Ein Stylingprodukt mit passendem Halt gibt ihnen anschließend mehr Form und Definition.",
  },
  {
    family: "volume_weight",
    variantId: "volume_weight.mehr_volumen_fein_niedrige_dichte",
    title: "Dein Haar braucht mehr sichtbare Fülle",
    finding:
      "Feine Fasern oder eine geringere Dichte lassen deinen Ansatz schneller flach wirken und reduzieren das sichtbare Gesamtvolumen.",
    why: "Weniger Durchmesser und weniger gegenseitige Abstützung geben dem Haar am Ansatz weniger natürliche Aufrichtung.",
    helps:
      "Eine leichte, formunterstützende Routine wählen, reichhaltige Pflege vom Ansatz fernhalten und die Bewegung dort aufbauen, wo du mehr Fülle sehen möchtest.",
  },
  {
    family: "volume_weight",
    variantId: "volume_weight.mehr_volumen_allgemein",
    title: "Dein Ansatz kann mehr Aufrichtung zeigen",
    finding:
      "Du möchtest mehr Präsenz und Volumen, ohne dass dein natürlicher Fall oder deine Bewegung verloren gehen.",
    why: "Länge, Struktur und die Bündelung der Strähnen bestimmen gemeinsam, wie stark sich das Haar gegenseitig stützt oder nach unten zieht.",
    helps:
      "Die Routine am Ansatz leichter halten und Styling gezielt für Aufrichtung einsetzen. So entsteht mehr sichtbare Fülle, ohne die Längen auszutrocknen.",
  },
  {
    family: "volume_weight",
    variantId: "volume_weight.weniger_volumen_viel_kraftig_texturiert",
    title: "Deine starke Fülle braucht mehr Kontrolle",
    finding:
      "Viele oder kräftige Haare zusammen mit deiner natürlichen Struktur erzeugen viel Präsenz und lassen den Gesamtlook schneller breit wirken.",
    why: "Dichte, Faserdurchmesser und natürliche Bewegung stützen sich gegenseitig und bauen dadurch mehr sichtbares Volumen auf.",
    helps:
      "Die Längen gleichmäßiger bündeln, den Fall glätten und das Volumen gezielt verteilen. So bleibt deine Fülle erhalten, wirkt aber ruhiger und kontrollierter.",
  },
  {
    family: "volume_weight",
    variantId: "volume_weight.weniger_volumen_allgemein",
    title: "Dein Haar braucht einen ruhigeren Fall",
    finding:
      "Du wünschst dir weniger Aufplustern und einen kompakteren Look, der kontrollierter anliegt.",
    why: "Wenn einzelne Strähnen unterschiedlich liegen und sich gegenseitig abstützen, wirkt das Gesamtvolumen größer und unruhiger.",
    helps:
      "Die Längen geschmeidiger ausrichten und den Fall beim Styling gezielt bündeln. So verteilt sich die vorhandene Fülle gleichmäßiger und wirkt ruhiger.",
  },
  {
    family: "color_protection",
    variantId: "color_protection.gefarbt_blondiert",
    title: "Deine Farbe braucht Schutz vor schnellem Verblassen",
    finding:
      "Gefärbte oder aufgehellte Längen verlieren durch Waschen und Belastung nach und nach an Farbintensität und Glanz.",
    why: "Oxidative Farbe und besonders Aufhellung verändern die Faser. Sonne, Hitze, Reibung und häufiges Waschen beschleunigen anschließend das Verblassen.",
    helps:
      "Zwischen Behandlungen schonend reinigen und pflegen, unnötige Hitze reduzieren und die Längen bei intensiver Sonne schützen.",
  },
  {
    family: "color_protection",
    variantId: "color_protection.naturhaar_farbschutz_ziel",
    title: "Deinen natürlichen Farbton und Glanz bewahren",
    finding:
      "Auch unbehandeltes Haar kann durch Sonne, Hitze und Reibung matter werden und an Leuchtkraft verlieren.",
    why: "UV-Strahlung und wiederholte thermische oder mechanische Belastung verändern mit der Zeit die Oberfläche und den sichtbaren Farbton.",
    helps:
      "Die Längen sanft behandeln, unnötige Hitze reduzieren und bei intensiver Sonne schützen. So bleiben natürlicher Farbton und Glanz länger sichtbar.",
  },
  {
    family: "scalp_comfort",
    variantId: "special.keine_konkrete_sorge",
    title: "Dein Haar hat eine gute Ausgangsbasis",
    finding:
      "Du hast kein akutes Problem genannt. Deshalb können wir die Routine direkt an deiner Struktur, Länge und deinen persönlichen Zielen ausrichten.",
    why: "Ohne dominantes Schadens- oder Kopfhautthema entscheidet vor allem, wie dein Haar fallen, sich anfühlen und im Alltag funktionieren soll.",
    helps:
      "Mit einer einfachen Basis starten und nur die Schritte ergänzen, die deine konkreten Ziele unterstützen. So bleibt die Routine wirksam und übersichtlich.",
  },
] as const satisfies readonly {
  family: GuidedStoryPriorityFamily
  variantId: string
  title: string
  finding: string
  why: string
  helps: string
}[]

export type GuidedStoryCopyRecord = (typeof GUIDED_STORY_COPY_RECORDS)[number]
export type GuidedStoryPriorityVariantId = GuidedStoryCopyRecord["variantId"]

export const GUIDED_STORY_LEGACY_FALLBACK_PRIORITIES = [
  {
    family: "scalp_comfort",
    variantId: "legacy.basis",
    title: "Eine gute Basis für dein individuelles Haar",
    finding:
      "Aus den verfügbaren Antworten lässt sich kein einzelnes Problem sicher in den Vordergrund stellen.",
    why: "Aus den verfügbaren Antworten lässt sich kein einzelnes Problem sicher in den Vordergrund stellen.",
    helps:
      "Mit einer einfachen, schonenden Basis starten und nur dort ergänzen, wo ein klarer Wunsch besteht.",
  },
  {
    family: "moisture_dryness",
    variantId: "legacy.pflege",
    title: "Geschmeidigkeit bleibt ein sinnvoller Grundbaustein",
    finding:
      "Shampoo und Conditioner bilden auch ohne ein klar priorisiertes Zusatzthema eine vollständige Basis.",
    why: "Shampoo und Conditioner bilden auch ohne ein klar priorisiertes Zusatzthema eine vollständige Basis.",
    helps: "Sanft reinigen und die Längen passend zu ihrem Haargefühl konditionieren.",
  },
  {
    family: "volume_weight",
    variantId: "legacy.routine",
    title: "Weniger Schritte können vollkommen ausreichen",
    finding: "Ein drittes Produkt wäre ohne passende Signale keine ehrliche Personalisierung.",
    why: "Ein drittes Produkt wäre ohne passende Signale keine ehrliche Personalisierung.",
    helps: "Mit Shampoo und Conditioner beginnen und die Routine später gemeinsam verfeinern.",
  },
] as const satisfies readonly {
  family: GuidedStoryPriorityFamily
  variantId: string
  title: string
  finding: string
  why: string
  helps: string
}[]

export type GuidedStoryLegacyFallbackRecord =
  (typeof GUIDED_STORY_LEGACY_FALLBACK_PRIORITIES)[number]

export function getGuidedStoryCopy(variantId: GuidedStoryPriorityVariantId): GuidedStoryCopyRecord {
  const copy = GUIDED_STORY_COPY_RECORDS.find((record) => record.variantId === variantId)
  if (!copy) {
    throw new Error(`Unknown guided story copy variant: ${variantId}`)
  }
  return copy
}
