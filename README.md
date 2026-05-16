# Digimon Card Game EV Calculator

Live booster box expected value calculator + price spike scanner for the **Digimon Card Game** (English). Streams real-time analysis from TCGPlayer prices via [TCGCSV](https://tcgcsv.com).

Supports **10 sets**: BT-22 through BT-25, RB-01, RSB-2.0, EX-09 through EX-11, and AD-01 (Digimon Generation).

## Running locally

```bash
npm install
npm run dev          # ts-node — http://localhost:3007
npm run build        # compile to dist/
npm start            # run compiled build
```

Requires Node.js ≥ 22.

## How EV is calculated

### Pack structure

**Standard booster boxes** (BT-XX main sets) — 24 packs/box, 4 slots per pack:

| Slot | Count | Pool |
|------|:-----:|------|
| Common | 6 | Common (Normal) |
| Uncommon | 3 | Uncommon (Normal) |
| Rare | 2 | Rare (Foil, guaranteed) |
| Hit | varies | Super Rare, Secret Rare, Alt Art, SP, and variant buckets |

Non-standard boxes (EX series 12-pack, RB-01 12-pack, BT-25 premium, AD-01 mega-reprint) are fully self-contained — they supply their own `packsPerBox` in the per-set config and do not inherit Standard defaults.

### Rarity buckets (18 total)

**Base rarities (9):** `Common` `Uncommon` `Rare` `Super Rare` `Secret Rare` `Special Rare` `Ultimate Rare` `Ultra Rare` `Promo`

**Variant buckets (9):** `Alt Art` `SP` `Textured` `Textured Alt Art` `Signed` `Full Art` `Limited Foil` `Gold Border` `Rare Pull`

Variant detection rules (applied to the product name suffix, first match wins):
- `(Textured Alternate Art)` → `Textured Alt Art`
- `(Textured)` → `Textured`
- `(Signed)` → `Signed`
- `(Full Art)` → `Full Art`
- `(Limited Foil)` → `Limited Foil`
- `(Gold Border)` → `Gold Border`
- `(Rare Pull)` → `Rare Pull`
- `(Alternate Art)` → `Alt Art` (unified — all base rarities)
- `(SP)` → `SP` (unified — all base rarities)

Non-booster products (Box Toppers, Judge Packs, tournament promos, etc.) return `null` from `resolveRarity()` and are excluded entirely from EV math and the spike scanner.

### Price aggregation

EV calculation groups cards by **rarity only** (not subType). After non-booster filtering, rarity buckets are naturally homogeneous in subType: Common/Uncommon have Normal prices, Rare/SR/SEC/variants have Foil prices. No explicit subType filter is needed.

### Pull rate config

Rates live in three layers that deep-merge at runtime:

| File | Purpose |
|------|---------|
| `config/pull-rates.global.json` | Empty — no truly global rates for Digimon |
| `config/pull-rates.default.json` | Standard BT baseline (24 packs, 6C+3UC+2R/pack) |
| `config/pull-rates-{set-id}.json` | Per-set overrides; non-Standard sets are fully self-contained |

Rates are stored as `{ "oneInXPacks": N }` integers (human-readable inverse probability). The loader converts to per-pack decimals at runtime.

Sets with `"_placeholder": true` in their config show a yellow caveat banner in the UI — rates are community estimates and may not reflect actual pull odds.

## Price spike scanner

After each EV analysis, a background scan streams through all booster-pullable cards in the set priced ≥ $1 and checks for:

- **Daily spike** — recent NM sales average ≥ 25% above TCGPlayer market price AND ≥ $1 higher
- **Weekly spike** — same threshold compared to 7-day-ago price from the SQLite price history

Price history is maintained by a daily 7z archive ingest from TCGCSV (runs at 21:00 UTC via cron), with a 10-day backfill on first boot. History is pruned to 30 days.

## Deployment (Railway)

```toml
# railway.toml — volume mounted at /data, DB_PATH=/data/price-history.db
```

```
# Procfile
web: node dist/server.js
```

Set environment variable `DB_PATH=/data/price-history.db` on the Railway service. `PORT` is injected automatically.

## Architecture

```
src/
  server.ts             Express — SSE endpoints /api/analyze, /api/scan-set, /api/sets, /api/pull-rates
  sets.ts               Set registry (10 sets, groupIds, default set BT-24)
  types.ts              Rarity union (18 buckets), SubType, SlotBreakdown, EvResult
  tcgcsv.ts             TCGCSV API client — fetchProducts, fetchPrices, resolveRarity (nullable), matchPrices
  calculator.ts         EV calculation — Standard/non-Standard branching, 4-slot model, hitBreakdown
  pull-rates-loader.ts  Three-layer config merge, oneInXPacks → decimal, isPlaceholder flag
  spike-check.ts        TCGPlayer latestsales API — daily/weekly spike detection
  latestsales.ts        TCGPlayer mpapi POST client (browser UA spoofing)
  archive-ingest.ts     TCGCSV 7z archive download + SQLite ingest (category 63)
  price-history-db.ts   SQLite WAL — upsertPrices, queryHistory, pruneOldRows
config/
  pull-rates.global.json
  pull-rates.default.json
  pull-rates-{set-id}.json  (one per set)
public/
  index.html            Self-contained webapp (vanilla HTML/CSS/JS, no build step)
```

## Data sources

- **[TCGCSV](https://tcgcsv.com)** — card names, rarities, and live prices (~24hr TCGPlayer cache). Category ID **63** (Digimon Card Game English).
- **TCGPlayer latest-sales API** — NM sales data for spike detection. No API key required (uses browser UA spoofing).

Pull rates are community estimates — Bandai does not publish official pack odds.
