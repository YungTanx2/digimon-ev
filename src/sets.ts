export interface SetDef {
  id: string;       // slug — matches pull-rates-{id}.json
  name: string;     // display name
  groupId: number;  // TCGCSV group ID
}

/**
 * Digimon Card Game sets supported by this tool.
 * Scope: BT-22 → BT-25 (main booster), RB-01 (Resurgence Booster),
 *        RSB-2.0 (Release Special Booster 2.0), EX-09 → EX-11 (EX series),
 *        AD-01 (Digimon Generation reprint mega-box).
 *
 * `groupId` is the TCGCSV group identifier — browse new sets at:
 *   https://tcgcsv.com/tcgplayer/63/groups  (63 = Digimon category)
 * `id` must match the pull-rates config filename: config/pull-rates-{id}.json
 * Standard BT sets fall back to config/pull-rates.default.json if no per-set file exists.
 */
export const SUPPORTED_SETS: SetDef[] = [
  // ── Main booster sets (BT) ───────────────────────────────────────────────
  { id: 'bt-22',  name: 'Cyber Eden',               groupId: 24078 },
  { id: 'bt-23',  name: "Hackers' Slumber",          groupId: 24430 },
  { id: 'bt-24',  name: 'Time Stranger',             groupId: 24531 },
  { id: 'bt-25',  name: 'Dual Revolution',           groupId: 24574 },
  // ── Resurgence Booster ───────────────────────────────────────────────────
  { id: 'rb-01',  name: 'Resurgence Booster',        groupId: 23017 },
  // ── Release Special Booster ──────────────────────────────────────────────
  { id: 'rsb-2',  name: 'Release Special Booster 2.0', groupId: 23767 },
  // ── EX series ────────────────────────────────────────────────────────────
  { id: 'ex-09',  name: 'Versus Monsters',           groupId: 24077 },
  { id: 'ex-10',  name: 'Sinister Order',            groupId: 24089 },
  { id: 'ex-11',  name: 'Dawn of Liberator',         groupId: 24490 },
  // ── Digimon Generation (reprint mega-box) ───────────────────────────────
  { id: 'ad-01',  name: 'Digimon Generation',        groupId: 24561 },
];

/** The set shown by default when the web app loads — update to the latest active set. */
export const DEFAULT_SET_ID = 'bt-24';
