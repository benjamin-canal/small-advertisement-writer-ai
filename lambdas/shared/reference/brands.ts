// Curated reference of common second-hand brands. Used to (1) ground Claude's
// identification (canonical spelling, anti-hallucination) and (2) normalise the
// brand it returns. Keep it readable — graduate to a searchable store if it grows
// into the thousands.

export interface BrandEntry {
  /** Canonical display spelling, e.g. "Nike". */
  canonical: string;
  /** Extra spellings/typos to map back to the canonical form. */
  aliases?: string[];
  /** Typical categories (English, lowercase) — handy for downstream enrichment. */
  categories: string[];
}

export const BRANDS: BrandEntry[] = [
  // Sportswear / sneakers
  { canonical: "Nike", aliases: ["nike air", "air jordan", "jordan"], categories: ["sneakers", "sportswear", "clothing"] },
  { canonical: "Adidas", aliases: ["adidas originals"], categories: ["sneakers", "sportswear", "clothing"] },
  { canonical: "Puma", categories: ["sneakers", "sportswear"] },
  { canonical: "Reebok", categories: ["sneakers", "sportswear"] },
  { canonical: "New Balance", categories: ["sneakers", "sportswear"] },
  { canonical: "Asics", categories: ["sneakers", "sportswear"] },
  { canonical: "Vans", categories: ["sneakers"] },
  { canonical: "Converse", categories: ["sneakers"] },
  { canonical: "Under Armour", categories: ["sportswear"] },
  { canonical: "The North Face", aliases: ["north face"], categories: ["jacket", "outdoor", "clothing"] },
  { canonical: "Patagonia", categories: ["jacket", "outdoor"] },
  { canonical: "Columbia", categories: ["jacket", "outdoor"] },
  { canonical: "Salomon", categories: ["shoes", "outdoor"] },
  { canonical: "Decathlon", aliases: ["quechua", "domyos", "kalenji"], categories: ["sportswear", "outdoor"] },

  // Fast fashion / high street
  { canonical: "Zara", categories: ["clothing"] },
  { canonical: "H&M", aliases: ["h and m", "hm"], categories: ["clothing"] },
  { canonical: "Uniqlo", categories: ["clothing"] },
  { canonical: "Mango", categories: ["clothing"] },
  { canonical: "Bershka", categories: ["clothing"] },
  { canonical: "Pull&Bear", aliases: ["pull and bear", "pull bear"], categories: ["clothing"] },
  { canonical: "Stradivarius", categories: ["clothing"] },
  { canonical: "Primark", categories: ["clothing"] },
  { canonical: "Gap", categories: ["clothing"] },
  { canonical: "C&A", categories: ["clothing"] },
  { canonical: "Kiabi", categories: ["clothing"] },

  // Denim / casual
  { canonical: "Levi's", aliases: ["levis", "levi strauss"], categories: ["jeans", "clothing"] },
  { canonical: "Wrangler", categories: ["jeans"] },
  { canonical: "Lee", categories: ["jeans"] },
  { canonical: "Diesel", categories: ["jeans", "clothing"] },
  { canonical: "Carhartt", categories: ["clothing", "workwear"] },
  { canonical: "Dickies", categories: ["clothing", "workwear"] },
  { canonical: "Tommy Hilfiger", aliases: ["tommy"], categories: ["clothing"] },
  { canonical: "Ralph Lauren", aliases: ["polo ralph lauren", "polo"], categories: ["clothing"] },
  { canonical: "Lacoste", categories: ["clothing"] },
  { canonical: "Champion", categories: ["clothing", "sportswear"] },
  { canonical: "Superdry", categories: ["clothing"] },
  { canonical: "Jack & Jones", aliases: ["jack and jones"], categories: ["clothing"] },
  { canonical: "Celio", categories: ["clothing"] },
  { canonical: "Jules", categories: ["clothing"] },

  // French / mid-range
  { canonical: "Sandro", categories: ["clothing"] },
  { canonical: "Maje", categories: ["clothing"] },
  { canonical: "The Kooples", categories: ["clothing"] },
  { canonical: "Sézane", aliases: ["sezane"], categories: ["clothing"] },
  { canonical: "Comptoir des Cotonniers", categories: ["clothing"] },
  { canonical: "Petit Bateau", categories: ["clothing"] },
  { canonical: "Naf Naf", categories: ["clothing"] },
  { canonical: "Promod", categories: ["clothing"] },

  // Luxury
  { canonical: "Louis Vuitton", aliases: ["lv", "vuitton"], categories: ["bag", "clothing", "accessories"] },
  { canonical: "Gucci", categories: ["bag", "clothing", "accessories"] },
  { canonical: "Chanel", categories: ["bag", "clothing", "accessories"] },
  { canonical: "Dior", categories: ["bag", "clothing", "accessories"] },
  { canonical: "Prada", categories: ["bag", "clothing"] },
  { canonical: "Hermès", aliases: ["hermes"], categories: ["bag", "accessories"] },
  { canonical: "Balenciaga", categories: ["sneakers", "clothing"] },
  { canonical: "Burberry", categories: ["clothing", "accessories"] },
  { canonical: "Saint Laurent", aliases: ["ysl", "yves saint laurent"], categories: ["bag", "clothing"] },
  { canonical: "Moncler", categories: ["jacket"] },
  { canonical: "Stone Island", categories: ["clothing"] },

  // Bags / accessories
  { canonical: "Longchamp", categories: ["bag"] },
  { canonical: "Michael Kors", categories: ["bag", "accessories"] },
  { canonical: "Eastpak", categories: ["bag"] },
  { canonical: "Herschel", categories: ["bag"] },
  { canonical: "Ray-Ban", aliases: ["rayban"], categories: ["sunglasses", "accessories"] },

  // Watches
  { canonical: "Rolex", categories: ["watch"] },
  { canonical: "Casio", categories: ["watch"] },
  { canonical: "Seiko", categories: ["watch"] },
  { canonical: "Daniel Wellington", categories: ["watch"] },
  { canonical: "Fossil", categories: ["watch", "accessories"] },

  // Electronics
  { canonical: "Apple", aliases: ["iphone", "ipad", "macbook", "airpods"], categories: ["smartphone", "electronics"] },
  { canonical: "Samsung", aliases: ["galaxy"], categories: ["smartphone", "electronics"] },
  { canonical: "Sony", aliases: ["playstation"], categories: ["electronics"] },
  { canonical: "Microsoft", aliases: ["xbox", "surface"], categories: ["electronics"] },
  { canonical: "Nintendo", aliases: ["switch"], categories: ["electronics", "games"] },
  { canonical: "Dyson", categories: ["electronics", "home"] },
  { canonical: "Bose", categories: ["electronics", "audio"] },
  { canonical: "JBL", categories: ["electronics", "audio"] },
  { canonical: "Xiaomi", categories: ["smartphone", "electronics"] },
  { canonical: "Huawei", categories: ["smartphone", "electronics"] },
  { canonical: "GoPro", categories: ["electronics"] },
  { canonical: "Canon", categories: ["electronics", "camera"] },
  { canonical: "Nikon", categories: ["electronics", "camera"] },

  // Kids / misc
  { canonical: "Lego", categories: ["toys"] },
  { canonical: "Ikea", categories: ["furniture", "home"] },
];

const normalize = (s: string): string =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");

// alias/canonical (normalised) → canonical, longest keys first for greedy matching
const LOOKUP: Array<{ key: string; canonical: string }> = (() => {
  const entries: Array<{ key: string; canonical: string }> = [];
  for (const b of BRANDS) {
    entries.push({ key: normalize(b.canonical), canonical: b.canonical });
    for (const a of b.aliases ?? []) {
      entries.push({ key: normalize(a), canonical: b.canonical });
    }
  }
  return entries.sort((x, y) => y.key.length - x.key.length);
})();

/** Maps a raw brand string from the model to a canonical brand, or null if unknown. */
export function canonicalBrand(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const n = normalize(raw);
  if (n.length < 2) return null;
  for (const { key, canonical } of LOOKUP) {
    if (n === key || (key.length >= 3 && (n.includes(key) || key.includes(n)))) {
      return canonical;
    }
  }
  return null;
}

/** Compact comma-separated list of canonical brands for prompt grounding. */
export function brandReferenceText(): string {
  return BRANDS.map((b) => b.canonical).join(", ");
}
