export type InfoTipSurface = "product" | "quiz" | "routine"

export type InfoTipId =
  | "product.shampoo"
  | "product.conditioner"
  | "product.leave_in"
  | "product.hair_oil"
  | "product.mask"
  | "product.scalp_peeling"
  | "product.dry_shampoo"
  | "product.bond_builder"
  | "product.deep_cleansing_shampoo"
  | "quiz.hair_texture"
  | "quiz.thickness"
  | "quiz.density"
  | "quiz.surface_test"
  | "quiz.pull_test"
  | "routine.towel_technique"
  | "routine.diffuser"
  | "routine.bonnet"
  | "routine.pineapple"
  | "routine.heat_protection"

export interface InfoTipContent {
  surface: InfoTipSurface
  title: string
  body: string
}

export const INFO_TIPS = {
  "product.shampoo": {
    surface: "product",
    title: "Shampoo",
    body: "Reinigt vor allem Kopfhaut und Ansatz. Die Längen bekommen beim Ausspülen meist genug Schaum ab.",
  },
  "product.conditioner": {
    surface: "product",
    title: "Conditioner / Spülung",
    body: "Ausspülbare Pflege nach dem Shampoo. Meist in Längen und Spitzen, nicht als Kopfhautpflege.",
  },
  "product.leave_in": {
    surface: "product",
    title: "Leave-in",
    body: "Pflege, die im Haar bleibt. Nach dem Waschen sparsam in Längen und Spitzen verwenden.",
  },
  "product.hair_oil": {
    surface: "product",
    title: "Haaröl",
    body: "Meist Finish oder Pre-Wash-Schutz für Längen und Spitzen. Sehr sparsam dosieren.",
  },
  "product.mask": {
    surface: "product",
    title: "Haarmaske",
    body: "Intensivere Zusatzpflege, meistens gelegentlich. Kein täglicher Pflichtschritt.",
  },
  "product.scalp_peeling": {
    surface: "product",
    title: "Kopfhautpeeling",
    body: "Kopfhaut-Produkt, kein Längenprodukt. Eher selten und sanft einsetzen.",
  },
  "product.dry_shampoo": {
    surface: "product",
    title: "Trockenshampoo",
    body: "Frischt den Ansatz auf und nimmt Talg auf, ersetzt aber keine Haarwäsche. Rückstände später auswaschen.",
  },
  "product.bond_builder": {
    surface: "product",
    title: "Bond Repair / Bondbuilder",
    body: "Gezielte Zusatzpflege bei stark geschädigtem Haar, zum Beispiel durch Blondieren, Hitze oder chemische Behandlungen. Kein Conditioner und keine Feuchtigkeitsmaske.",
  },
  "product.deep_cleansing_shampoo": {
    surface: "product",
    title: "Tiefenreinigungsshampoo",
    body: "Gelegentlicher Reset bei Rückständen und Build-up. Kein Alltags-Shampoo.",
  },
  "quiz.hair_texture": {
    surface: "quiz",
    title: "Haarstruktur",
    body: "Textur meint das Muster deiner Haare, nicht Dicke oder Haarmenge: glatt, wellig, lockig oder kraus.",
  },
  "quiz.thickness": {
    surface: "quiz",
    title: "Haardicke",
    body: "Haardicke meint den Durchmesser eines einzelnen Haares, nicht wie viele Haare du insgesamt hast.",
  },
  "quiz.density": {
    surface: "quiz",
    title: "Haardichte",
    body: "Haardichte meint die Haarmenge auf dem Kopf. Du kannst feines Haar haben und trotzdem viel davon.",
  },
  "quiz.surface_test": {
    surface: "quiz",
    title: "Oberfläche / Finger-Test",
    body: "Es geht nicht um Sauberkeit, sondern um die Oberfläche der Strähne: glatt, leicht uneben oder rau.",
  },
  "quiz.pull_test": {
    surface: "quiz",
    title: "Elastizität / Zug-Test",
    body: "Elastizität zeigt, wie gut eine Strähne Zug aushält. Für uns reicht eine grobe Tendenz, kein perfekter Test.",
  },
  "routine.towel_technique": {
    surface: "routine",
    title: "Scrunchen",
    body: "Scrunchen heißt: Wasser oder Pflege sanft von unten einkneten, statt das Haar trocken zu rubbeln.",
  },
  "routine.diffuser": {
    surface: "routine",
    title: "Diffusor",
    body: "Ein Diffusor ist ein Föhnaufsatz, der Luft breiter verteilt. Das kann Wellen und Locken weniger auseinanderpusten.",
  },
  "routine.bonnet": {
    surface: "routine",
    title: "Bonnet / Schlafhaube",
    body: "Ein Bonnet bzw. eine Schlafhaube aus Satin oder Seide reduziert Reibung beim Schlafen und hält Längen oder Locken besser zusammen.",
  },
  "routine.pineapple": {
    surface: "routine",
    title: "Pineapple",
    body: "Ein hoher, lockerer Zopf oder Dutt, der Wellen und Locken nachts weniger plattdrückt.",
  },
  "routine.heat_protection": {
    surface: "routine",
    title: "Hitzeschutz",
    body: "Produkt vor Föhn, Glätteisen oder Lockenstab. Es hilft gegen Hitzestress, ersetzt aber keine niedrigere Temperatur.",
  },
} satisfies Record<InfoTipId, InfoTipContent>

export const INFO_TIP_IDS = Object.keys(INFO_TIPS) as InfoTipId[]
