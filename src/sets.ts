export interface SetDef {
  id: string;       // slug — matches pull-rates-{id}.json
  name: string;     // display name
  groupId: number;  // TCGCSV group ID
}

/**
 * Digimon Card Game sets supported by this tool.
 * Scope: BT-22 → BT-25 (main booster), RB-01 (Resurgence Booster),
 *        RSB-2.0 (Release Special Booster 2.0), EX-09 → EX-12 (EX series),
 *        AD-01 (Digimon Generation reprint mega-box).
 *
 * `groupId` is the TCGCSV group identifier — browse new sets at:
 *   https://tcgcsv.com/tcgplayer/63/groups  (63 = Digimon category)
 * `id` must match the pull-rates config filename: config/pull-rates-{id}.json
 * Standard BT sets fall back to config/pull-rates.default.json if no per-set file exists.
 */
export const SUPPORTED_SETS: SetDef[] = [
  // Ordered by groupId ascending — TCGCSV registers sets sequentially,
  // so groupId order closely tracks actual product release date.
  { id: 'rb-01',  name: 'Resurgence Booster',          groupId: 23017 },
  { id: 'rsb-2',  name: 'Release Special Booster 2.0', groupId: 23767 },
  { id: 'ex-09',  name: 'Versus Monsters',             groupId: 24077 },
  { id: 'bt-22',  name: 'Cyber Eden',                  groupId: 24078 },
  { id: 'ex-10',  name: 'Sinister Order',              groupId: 24089 },
  { id: 'bt-23',  name: "Hackers' Slumber",            groupId: 24430 },
  { id: 'ex-11',  name: 'Dawn of Liberator',           groupId: 24490 },
  { id: 'bt-24',  name: 'Time Stranger',               groupId: 24531 },
  { id: 'ad-01',  name: 'Digimon Generation',          groupId: 24561 },
  { id: 'bt-25',  name: 'Dual Revolution',             groupId: 24574 },
  { id: 'ex-12',  name: 'Digital World Shambala',      groupId: 24630 },
];

/** The set shown by default when the web app loads — update to the latest active set. */
export const DEFAULT_SET_ID = 'bt-24';
