// Base rarities that appear in Digimon Card Game extendedData.Rarity on TCGCSV (category 63).
export type BaseRarity =
  | 'Common'        // Normal-priced filler
  | 'Uncommon'      // Normal-priced filler
  | 'Rare'          // Foil-priced filler (1–2 guaranteed per pack in BT)
  | 'Super Rare'    // Foil-priced hit
  | 'Secret Rare'   // Foil-priced premium hit
  | 'Special Rare'  // BT-22, EX-10, AD-01 — premium hit tier
  | 'Ultimate Rare' // BT-25 only — new tier
  | 'Ultra Rare'    // BT-25 only — new tier
  | 'Promo';        // RB-01 / AD-01 pack-pullable promos

// Variant-derived buckets created by product name suffix detection in tcgcsv.ts.
// These do NOT appear in extendedData.Rarity — they are synthetic.
// Non-booster products return null from resolveRarity() and are dropped entirely.
export type VariantBucket =
  | 'Textured Alt Art' // (Textured Alternate Art) — RB-01 / RSB-2.0 chase
  | 'Textured'         // (Textured) — RSB-2.0 premium tier, ~$109 avg
  | 'Signed'           // (Signed) — autograph chase, ~1/case
  | 'Full Art'         // (Full Art) — BT-25 new chase tier
  | 'Limited Foil'     // (Limited Foil) — EX-09/10/11 chase tier
  | 'Gold Border'      // (Gold Border) — AD-01 chase tier
  | 'Rare Pull'        // (Rare Pull) — high-end variant in EX/AD/BT-25; ~$118–650 avg
  | 'Alt Art'          // (Alternate Art) — unified across ALL base rarities
  | 'SP';              // (SP) — Special print, unified across ALL base rarities

export type Rarity = BaseRarity | VariantBucket;

// TCGCSV subType names for Digimon cards.
// Each productId is exclusively one OR the other — never both for the same card.
// Common/Uncommon are Normal-priced; Rare/SR/SEC/variants are Foil-priced.
export type SubType = 'Normal' | 'Foil';

export interface DigimonCard {
  name: string;
  rarity: Rarity;
  image?: string;
}

export interface PriceEntry {
  productId: number;
  name: string;
  rarity?: Rarity;
  subType: SubType;
  marketPrice: number;
  midPrice: number;
  image?: string;
}

export interface RarityStats {
  rarity: string;
  /** Average price for cards of this rarity (subType is homogeneous per rarity after non-booster filtering). */
  avgPrice: number | null;
  /** Number of priced cards counted in the average. */
  foilPriced: number;
  /** Total EV contribution of this rarity bucket to the box EV. */
  evContribution: number;
}

export interface SlotBreakdown {
  /** EV from the Common filler slot (Standard boxes only). */
  commonEv: number;
  /** EV from the Uncommon filler slot (Standard boxes only). */
  uncommonEv: number;
  /** EV from the guaranteed Rare slot (Standard boxes only). */
  rareEv: number;
  /** EV from the hit slot — SR, SEC, SP, Alt Art, etc. */
  hitEv: number;
}

export interface HitRarityBreakdown {
  /** P(rarity per pack) derived from pull-rates config (1/oneInXPacks). */
  fraction: number;
  /** Average price for this rarity, or null if no priced cards found. */
  avgPrice: number | null;
  /** fraction × avgPrice × packsPerBox — expected $ contribution per box. */
  evPerBox: number;
}

export interface EvResult {
  evPerPack: number;
  evPerBox: number;
  boxCost: number;
  /** How the box price was determined. */
  boxPriceSource: 'box' | 'bundle' | 'manual' | 'unknown';
  profit: number;
  byRarity: Record<string, RarityStats>;
  /** Top hit-slot cards by price (price >= $1). */
  topPulls: PriceEntry[];
  /** Top case-hit-tier cards (Signed, Gold Border, Rare Pull, etc. — very rare pulls). */
  topCaseHitPulls: PriceEntry[];
  slotBreakdown: SlotBreakdown;
  /** Per-rarity EV breakdown for the hit slot, keyed by rarity name. */
  hitBreakdown: Record<string, HitRarityBreakdown>;
  /** True when the EV was calculated with case-hit rarities zeroed out. */
  excludedCaseHits: boolean;
  /** True when pull rates for this set are community estimates (not Bandai-official). */
  isPlaceholder: boolean;
  pricedCardCount: number;
  totalCardCount: number;
}

export interface Sale {
  condition: string;
  variant: string;
  quantity: number;
  purchasePrice: number;
  orderDate: string;
}

export interface ScanCardResult {
  productId: number;
  subType: string;
  name: string;
  rarity: string;
  currentMarketPrice: number;
  recentAvgPrice: number;
  recentSalesCount: number;
  dailyPctChange: number;
  dailyAbsChange: number;
  dailySpiking: boolean;
  weeklyPctChange: number | null;
  weeklyAbsChange: number | null;
  weeklySpiking: boolean;
  price7dAgo: number | null;
  error?: boolean;
}
