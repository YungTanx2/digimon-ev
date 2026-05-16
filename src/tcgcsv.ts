import axios from 'axios';
import { PriceEntry, Rarity } from './types';

// Digimon Card Game category ID on TCGCSV (tcgcsv.com/tcgplayer/63/...).
const CATEGORY_ID = 63;

// All base rarity strings that appear in Digimon TCGCSV extendedData.Rarity.
const VALID_BASE_RARITIES = new Set<string>([
  'Common', 'Uncommon', 'Rare', 'Super Rare', 'Secret Rare',
  'Special Rare', 'Ultimate Rare', 'Ultra Rare', 'Promo',
]);

export interface ExtendedDataEntry {
  name: string;
  displayName: string;
  value: string;
}

export interface TCGProduct {
  productId: number;
  name: string;
  cleanName?: string;
  imageUrl?: string;
  extendedData?: ExtendedDataEntry[];
}

export interface TCGPrice {
  productId: number;
  subTypeName: string;
  lowPrice: number | null;
  midPrice: number | null;
  highPrice: number | null;
  marketPrice: number | null;
}

/** Extract and validate the base rarity string from a product's extendedData. */
function extractBaseRarity(extendedData: ExtendedDataEntry[] = []): string | null {
  const entry = extendedData.find((e) => e.name === 'Rarity');
  if (!entry || !VALID_BASE_RARITIES.has(entry.value)) return null;
  return entry.value;
}

/**
 * Non-booster product regex. Matches parenthetical suffixes that identify products
 * NOT pulled from standard booster packs. Returns null from resolveRarity() so they
 * are dropped at source from both the EV calculator and spike scanner.
 *
 * Patterns cover: Box Toppers, Box Promotion Packs, Pre-Release cards, Judge/Event
 * packs, tournament promos (Evolution Cup, Regionals, Championship, Ultimate Cup,
 * Regulation Battle), release-event promos (Cyber Eden), World Championship cards,
 * special sets (Premium Heroines, Digimon Animation Series, Liberator Debuggers Set,
 * Tamer's Evolution/Selection Box, Resurgence Booster Reprint, Digimon Adventure Box),
 * and Token cards.
 */
const NON_BOOSTER_RE = new RegExp([
  '\\(',
  '(?:',
    '(?:[^)]*\\b)?Box Topper',
    '|(?:[^)]*\\b)?Box Promotion Pack',
    '|Pre-Release',
    '|Judge Pack[^)]*',
    '|Event Pack[^)]*',
    '|Evolution Cup[^)]*',
    '|Regionals[^)]*',
    '|Championship[^)]*Tamers Pack[^)]*',
    '|Ultimate Cup[^)]*',
    '|Regulation Battle[^)]*',
    '|Cyber Eden Release Event[^)]*',
    '|World Championship[^)]*',
    '|Premium Heroines Set',
    '|Digimon Animation Series[^)]*',
    '|Digimon Liberator Debuggers Set',
    '|Tamer\'s (?:Evolution|Selection) Box[^)]*',
    '|Resurgence Booster Reprint',
    '|Digimon Adventure Box[^)]*',
    '|Token',
  ')',
  '\\)\\s*$',
].join(''), 'i');

/**
 * Apply Digimon variant detection to a product name, returning the final
 * Rarity bucket, or null if the product is non-booster (excluded from EV + scanner).
 *
 * Rules (applied in order — first match wins):
 *   Non-booster pattern (NON_BOOSTER_RE)  → null            (dropped at source)
 *   (Textured Alternate Art)              → 'Textured Alt Art'
 *   (Textured)                            → 'Textured'
 *   (Signed)                              → 'Signed'
 *   (Full Art)                            → 'Full Art'
 *   (Limited Foil)                        → 'Limited Foil'
 *   (Gold Border)                         → 'Gold Border'
 *   (Rare Pull)                           → 'Rare Pull'
 *   (Alternate Art)                       → 'Alt Art'  (unified — all base rarities)
 *   (SP)                                  → 'SP'       (unified — all base rarities)
 *   Pass-through suffixes (X Antibody, Human Form, Species Form, Reprint, BT24-003)
 *                                         → base rarity unchanged
 *
 * Note: TCGCSV stores the BASE card rarity in extendedData.Rarity for variant prints.
 * Without suffix detection, expensive variants contaminate filler slot averages.
 * Alt Art and SP are unified across all base rarities — BT-24 has Uncommon-base
 * Alt Art at $85 and Rare-base SP at $78 that would otherwise inflate filler buckets.
 */
function resolveRarity(baseRarity: string, productName: string): Rarity | null {
  if (NON_BOOSTER_RE.test(productName)) return null;

  // Longer / more specific patterns first
  if (/\(Textured Alternate Art\)\s*$/i.test(productName)) return 'Textured Alt Art';
  if (/\(Textured\)\s*$/i.test(productName))               return 'Textured';
  if (/\(Signed\)\s*$/i.test(productName))                 return 'Signed';
  if (/\(Full Art\)\s*$/i.test(productName))               return 'Full Art';
  if (/\(Limited Foil\)\s*$/i.test(productName))           return 'Limited Foil';
  if (/\(Gold Border\)\s*$/i.test(productName))            return 'Gold Border';
  if (/\(Rare Pull\)\s*$/i.test(productName))              return 'Rare Pull';
  if (/\(Alternate Art\)\s*$/i.test(productName))          return 'Alt Art';
  if (/\(SP\)\s*$/i.test(productName))                     return 'SP';

  return baseRarity as Rarity;
}

const HEADERS = { 'User-Agent': 'digimon-ev/1.0' };

/**
 * Fetch all products (cards + sealed products) for a Digimon set from TCGCSV.
 * @param groupId - TCGCSV group ID for the set (see sets.ts for the full list)
 */
export async function fetchProducts(groupId: number): Promise<TCGProduct[]> {
  console.log('  [tcgcsv] Fetching products…');
  const base = `https://tcgcsv.com/tcgplayer/${CATEGORY_ID}/${groupId}`;
  const res = await axios.get<{ results: TCGProduct[] }>(`${base}/products`, { timeout: 15000, headers: HEADERS });
  return res.data.results ?? [];
}

/**
 * Fetch current market prices for all products in a Digimon set from TCGCSV.
 * Each product has either Normal or Foil pricing (never both for the same productId).
 * @param groupId - TCGCSV group ID for the set
 */
export async function fetchPrices(groupId: number): Promise<TCGPrice[]> {
  console.log('  [tcgcsv] Fetching prices…');
  const base = `https://tcgcsv.com/tcgplayer/${CATEGORY_ID}/${groupId}`;
  const res = await axios.get<{ results: TCGPrice[] }>(`${base}/prices`, { timeout: 15000, headers: HEADERS });
  return res.data.results ?? [];
}

/**
 * Derives the Digimon card list from TCGCSV product data.
 * Products with a valid base Rarity in extendedData are individual cards;
 * sealed products (booster boxes, cases) have no Rarity and are skipped.
 * Non-booster cards (resolveRarity returns null) are also skipped.
 */
export function extractCards(products: TCGProduct[]): { name: string; rarity: Rarity }[] {
  const cards: { name: string; rarity: Rarity }[] = [];
  for (const product of products) {
    const base = extractBaseRarity(product.extendedData);
    if (!base) continue;
    const rarity = resolveRarity(base, product.name);
    if (rarity === null) continue;
    cards.push({ name: product.name, rarity });
  }
  return cards;
}

/**
 * Builds a pre-keyed price map from the raw prices array.
 * Key format: `${productId}::${subTypeName}`
 */
export function buildPriceMap(prices: TCGPrice[]): Map<string, TCGPrice> {
  const map = new Map<string, TCGPrice>();
  for (const p of prices) {
    map.set(`${p.productId}::${p.subTypeName}`, p);
  }
  return map;
}

/**
 * Builds PriceEntry[] by joining products (which carry rarity via extendedData)
 * with prices by productId.
 *
 * Digimon subType handling:
 * - Each productId is exclusively Normal OR Foil — never both.
 * - Common/Uncommon are Normal-priced; Rare/SR/SEC/variants are Foil-priced.
 * - Non-booster cards (resolveRarity returns null) are skipped.
 * - Entries for BOTH subtypes are emitted so the spike scanner can track all cards.
 * - The calculator aggregates by rarity (not subType) since rarity buckets are
 *   naturally homogeneous in subType after non-booster filtering.
 */
export function matchPrices(products: TCGProduct[], prices: TCGPrice[]): PriceEntry[] {
  const priceMap = buildPriceMap(prices);
  const entries: PriceEntry[] = [];

  for (const product of products) {
    const base = extractBaseRarity(product.extendedData);
    if (!base) continue; // skip sealed products

    const rarity = resolveRarity(base, product.name);
    if (rarity === null) continue; // skip non-booster products

    const image = product.imageUrl ?? undefined;

    const foilPrice   = priceMap.get(`${product.productId}::Foil`);
    const normalPrice = priceMap.get(`${product.productId}::Normal`);

    if (foilPrice) {
      const marketPrice = foilPrice.marketPrice ?? 0;
      const midPrice    = foilPrice.midPrice    ?? 0;
      if (marketPrice > 0 || midPrice > 0) {
        entries.push({ productId: product.productId, name: product.name, rarity, subType: 'Foil', marketPrice, midPrice, image });
      }
    }

    if (normalPrice) {
      const marketPrice = normalPrice.marketPrice ?? 0;
      const midPrice    = normalPrice.midPrice    ?? 0;
      if (marketPrice > 0 || midPrice > 0) {
        entries.push({ productId: product.productId, name: product.name, rarity, subType: 'Normal', marketPrice, midPrice, image });
      }
    }
  }

  return entries;
}

/** Re-export extractBaseRarity for use in server.ts (booster box detection). */
export { extractBaseRarity as extractRarity };
