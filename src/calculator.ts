import { PriceEntry, Rarity, EvResult, RarityStats, SlotBreakdown, HitRarityBreakdown } from './types';
import { ResolvedPullRates } from './pull-rates-loader';

/**
 * Pull rates consumed by the calculator — resolved from the JSON layer by pull-rates-loader.ts.
 * All rates are per-pack decimal probabilities (hitDistribution values = 1/oneInXPacks).
 */
export type { ResolvedPullRates };

/**
 * Threshold for classifying a hit as a "case hit" (very rare pull).
 * Rarities with P(per pack) below this appear in topCaseHitPulls rather than topPulls.
 * 1/100 packs = 0.01 — roughly "less than 1 per 4 boxes".
 */
const CASE_HIT_THRESHOLD = 0.01;

/**
 * Per-card bulk threshold. Cards below $0.50 are realistically sold to bulk buyers
 * at ~$0.01/card rather than as singles. EV math uses this realizable value.
 */
const BULK_THRESHOLD = 0.50;
const BULK_RATE      = 0.01;

/** Realizable effective price: prefer marketPrice, fall back to midPrice, clamp bulk. */
function effectivePrice(entry: PriceEntry): number {
  const raw = entry.marketPrice > 0 ? entry.marketPrice : entry.midPrice;
  return raw >= BULK_THRESHOLD ? raw : BULK_RATE;
}

/** Average effective price over a list of entries. Returns null if empty. */
function avgEffectivePrice(entries: PriceEntry[]): number | null {
  if (entries.length === 0) return null;
  return entries.reduce((sum, e) => sum + effectivePrice(e), 0) / entries.length;
}

/**
 * Groups PriceEntry[] by rarity.
 * Digimon rarity buckets are naturally homogeneous in subType after non-booster
 * filtering (Common/Uncommon = Normal, Rare/SR/SEC/variants = Foil), so grouping
 * by rarity-only correctly captures all relevant cards without explicit subType filtering.
 */
function groupEntries(entries: PriceEntry[]): Map<string, PriceEntry[]> {
  const map = new Map<string, PriceEntry[]>();
  for (const entry of entries) {
    const key = entry.rarity ?? 'Unknown';
    const existing = map.get(key) ?? [];
    existing.push(entry);
    map.set(key, existing);
  }
  return map;
}

function getGroup(grouped: Map<string, PriceEntry[]>, rarity: string): PriceEntry[] {
  return grouped.get(rarity) ?? [];
}

// All Digimon rarity buckets — used to seed byRarity with zeroed stats.
// Includes base rarities + variant buckets so every possible bucket appears in the output.
const ALL_RARITIES: Rarity[] = [
  'Common', 'Uncommon', 'Rare', 'Super Rare', 'Secret Rare',
  'Special Rare', 'Ultimate Rare', 'Ultra Rare', 'Promo',
  'Alt Art', 'SP', 'Textured', 'Textured Alt Art',
  'Signed', 'Full Art', 'Limited Foil', 'Gold Border', 'Rare Pull',
];

// Rarities that always surface in topCaseHitPulls even without a configured pull rate.
// Pull rates for these variants are unknown; they contribute $0 to EV but should be visible.
const ALWAYS_CASE_HIT = new Set<string>(['Textured', 'Signed', 'Gold Border', 'Rare Pull']);

/**
 * Calculate expected value (EV) for a Digimon booster box.
 *
 * Pack structure (Standard BT boxes — commonCount is defined):
 *   commonCount   × Common  (avg over all Normal Common cards in set)
 *   uncommonCount × Uncommon (avg over all Normal Uncommon cards)
 *   rareCount     × Rare    (guaranteed Rare slot per pack)
 *   hitDistribution entries  (SR, SEC, SP, Alt Art, etc.)
 *
 * Pack structure (non-Standard boxes — commonCount is undefined):
 *   hitDistribution entries only (self-contained per-set configs)
 *
 * EV math aggregates by rarity (not subType) — rarity buckets are naturally
 * homogeneous in subType after non-booster filtering.
 *
 * @param entries   - Priced card entries from matchPrices()
 * @param pullRates - Resolved rates from loadPullRates()
 * @param boxCost   - Current retail price of the box in USD
 */
export function calculateEV(
  entries: PriceEntry[],
  pullRates: ResolvedPullRates,
  boxCost: number,
  excludeCaseHits = false,
): EvResult {
  const { packsPerBox, commonCount, uncommonCount, rareCount, hitDistribution, isStandard } = pullRates;

  // Group by rarity; EV calc averages all priced cards in each bucket
  const grouped = groupEntries(entries);

  // ── Per-rarity stats ──────────────────────────────────────────────────────
  const byRarity: Record<string, RarityStats> = {};
  for (const rarity of ALL_RARITIES) {
    const group = getGroup(grouped, rarity);
    byRarity[rarity] = {
      rarity,
      avgPrice: avgEffectivePrice(group),
      foilPriced: group.length,
      evContribution: 0,
    };
  }

  // ── Standard-only filler slots ────────────────────────────────────────────
  let commonEv   = 0;
  let uncommonEv = 0;
  let rareEv     = 0;

  if (isStandard) {
    commonEv = (commonCount ?? 0) * (byRarity['Common']?.avgPrice ?? 0);
    if (byRarity['Common']) byRarity['Common'].evContribution += commonEv;

    uncommonEv = (uncommonCount ?? 0) * (byRarity['Uncommon']?.avgPrice ?? 0);
    if (byRarity['Uncommon']) byRarity['Uncommon'].evContribution += uncommonEv;

    rareEv = (rareCount ?? 1) * (byRarity['Rare']?.avgPrice ?? 0);
    if (byRarity['Rare']) byRarity['Rare'].evContribution += rareEv;
  }

  // ── Hit slot ──────────────────────────────────────────────────────────────
  // hitDistribution values are P(rarity per pack).
  const caseHitRarities = new Set<string>(
    Object.entries(hitDistribution)
      .filter(([, fraction]) => fraction < CASE_HIT_THRESHOLD)
      .map(([rarity]) => rarity),
  );
  for (const r of ALWAYS_CASE_HIT) caseHitRarities.add(r);

  let hitEv = 0;
  const hitBreakdown: Record<string, HitRarityBreakdown> = {};

  for (const [rarity, fraction] of Object.entries(hitDistribution)) {
    if (!byRarity[rarity]) {
      const group = getGroup(grouped, rarity);
      byRarity[rarity] = { rarity, avgPrice: avgEffectivePrice(group), foilPriced: group.length, evContribution: 0 };
    }

    const price     = byRarity[rarity]?.avgPrice ?? null;
    const isCaseHit = caseHitRarities.has(rarity);
    const ev        = fraction * (excludeCaseHits && isCaseHit ? 0 : (price ?? 0));
    hitEv += ev;
    if (byRarity[rarity]) byRarity[rarity].evContribution += ev;
    hitBreakdown[rarity] = { fraction, avgPrice: price, evPerBox: ev * packsPerBox };
  }

  const slotBreakdown: SlotBreakdown = { commonEv, uncommonEv, rareEv, hitEv };
  const evPerPack = commonEv + uncommonEv + rareEv + hitEv;
  const evPerBox  = evPerPack * packsPerBox;

  // ── Top pulls ─────────────────────────────────────────────────────────────
  // Hit-slot cards that are NOT case hits, priced >= $1
  const allHitRarities = new Set<string>(Object.keys(hitDistribution));

  const topPulls = entries
    .filter(e =>
      allHitRarities.has(e.rarity ?? '') &&
      !caseHitRarities.has(e.rarity ?? '') &&
      effectivePrice(e) >= 1.0,
    )
    .sort((a, b) => effectivePrice(b) - effectivePrice(a))
    .slice(0, 20);

  const topCaseHitPulls = entries
    .filter(e =>
      caseHitRarities.has(e.rarity ?? '') &&
      effectivePrice(e) >= 1.0,
    )
    .sort((a, b) => effectivePrice(b) - effectivePrice(a))
    .slice(0, 20);

  return {
    evPerPack,
    evPerBox,
    boxCost,
    boxPriceSource: 'unknown' as const, // overwritten by server.ts
    profit: evPerBox - boxCost,
    byRarity,
    topPulls,
    topCaseHitPulls,
    slotBreakdown,
    hitBreakdown,
    excludedCaseHits: excludeCaseHits,
    isPlaceholder: (pullRates as any).isPlaceholder ?? false,
    pricedCardCount: new Set(entries.map(e => e.productId)).size,
    totalCardCount: 0, // populated by server.ts after extractCards
  };
}
