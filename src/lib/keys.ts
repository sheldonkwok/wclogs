import * as apiV2 from "./api-v2";

export type { Role } from "./api-v2";
const ROLES = apiV2.ROLES;

export interface KeyInfo {
  abbrev: string;
  timer: number;
  encounterId: number;
}
const MIN = 60_000;
const S2_KEYS = new Map<string, KeyInfo>([
  ["Uldaman", { abbrev: "uld", timer: 35 * MIN, encounterId: 12451 }],
  ["Brackenhide Hollow", { abbrev: "bh", timer: 35 * MIN, encounterId: 12520 }],
  ["Neltharus", { abbrev: "nelt", timer: 33 * MIN, encounterId: 12519 }],
  ["Halls of Infusion", { abbrev: "hoi", timer: 35 * MIN, encounterId: 12527 }],
  [
    "The Vortex Pinnacle",
    { abbrev: "vp", timer: 30 * MIN, encounterId: 10657 },
  ],
  ["Freehold", { abbrev: "fh", timer: 30 * MIN, encounterId: 61754 }],
  ["The Underrot", { abbrev: "undr", timer: 30 * MIN, encounterId: 61841 }],
  ["Neltharion's Lair", { abbrev: "nl", timer: 33 * MIN, encounterId: 61458 }],
]);

export const TYRANNICAL = 9;
export const FORTIFIED = 10;

// Since I'm downloading image manually, I'm assuming these ids hold consistent
const AFFIXES = {
  "1": "overflowing",
  "2": "skittish",
  "3": "volcanic",
  "4": "necrotic",
  "5": "teeming",
  "6": "raging",
  "7": "bolstering",
  "8": "sanguine",
  [TYRANNICAL]: "tyrannical",
  [FORTIFIED]: "fortified",
  "11": "bursting",
  "12": "grievous",
  "13": "explosive",
  "14": "quaking",
  "15": "relentless",
  "16": "infested",
  "117": "reaping",
  "119": "beguiling",
  "120": "awakened",
  "121": "prideful",
  "122": "inspiring",
  "123": "spiteful",
  "124": "storming",
  "128": "tormented",
  "129": "infernal",
  "130": "encrypted",
  "131": "shrouded",
  "132": "thundering",
  "134": "entangling",
  "135": "afflicted",
  "136": "incorporeal",
  "137": "shielding",
};

const AFFIX_MAP = new Map<number, string>(
  Object.entries(AFFIXES).map(([key, val]) => [Number(key), val])
);

export interface RPlayer {
  role: apiV2.Role;
  name: string;
  type: string;
  rioUrl: string;
}

export interface Parsed {
  key: string;
  keyAbbrev: string;
  level: number;
  affixes: string[];
  finished: boolean;
  timed: boolean;
  time: string;
  timeDiff: string;
  owner: string;
  date: number;
  players: RPlayer[];
  url: string;
}

export interface KeyData {
  data: Parsed[];
  time: number;
}

export async function getKeys(): Promise<KeyData> {
  const start = Date.now();

  const toParse = await apiV2.getReports();

  const time = Date.now() - start;
  const data = parseReports(toParse);

  return { data, time };
}

export function parseReports(reports: apiV2.Report[]): Parsed[] {
  const allReports = reports.flatMap((r) => {
    if (Array.isArray(r.playerDetails.data.playerDetails)) return []; // Bad data

    const rPlayers = parsePlayerDetails(r.playerDetails.data.playerDetails);

    return r.fights.reverse().map((f) => {
      const keyTime = f.keystoneTime ?? 0;
      const { timed, diff } = parseTime(f.name, keyTime);

      return {
        key: f.name,
        keyAbbrev: S2_KEYS.get(f.name)?.abbrev ?? "",
        level: f.keystoneLevel,
        affixes: f.keystoneAffixes.map((a) => AFFIX_MAP.get(a) ?? "unknown"),
        finished: f.kill ?? false,
        time: formatTime(keyTime),
        timed,
        timeDiff: diff,
        owner: r.owner.name,
        date: r.startTime + f.startTime,
        players: findPlayers(rPlayers, f.friendlyPlayers),
        url: `https://www.warcraftlogs.com/reports/${r.code}#fight=${f.id}`,
      };
    });
  });

  return cleanReports(allReports);
}

function parsePlayerDetails(
  details: apiV2.PlayerRoleDetails
): Map<number, RPlayer> {
  const rPlayers = new Map<number, RPlayer>();

  for (const role of ROLES) {
    const playerRoles = details[role];
    if (!playerRoles) continue;

    for (const player of playerRoles) {
      rPlayers.set(player.id, {
        role: role,
        name: player.name,
        type: player.type,
        rioUrl: `https://raider.io/characters/us/${player.server}/${player.name}`,
      });
    }
  }

  return rPlayers;
}

const UNKNOWN_PLAYER = Object.freeze({
  role: "dps" as const,
  name: "?",
  type: "?",
  rioUrl: "",
});

// The API can mix up runs if the party is filled in another run
function findPlayers(
  rPlayers: Map<number, RPlayer>,
  playerIds: number[]
): RPlayer[] {
  let hasTank = false;
  let hasHealer = false;

  const found = playerIds
    .sort((a, b) => a - b)
    .map((p) => {
      const rp = rPlayers.get(p);
      if (!rp) return UNKNOWN_PLAYER;

      return rp;
    })
    .filter((rp) => {
      if (rp.role === "tanks") {
        if (hasTank) return false;
        hasTank = true;
      } else if (rp.role === "healers") {
        if (hasHealer) return false;
        hasHealer = true;
      }

      return true;
    })
    .sort((a, b) => ROLES.indexOf(a.role) - ROLES.indexOf(b.role));

  return found.slice(0, 5);
}

function formatTime(ms: number): string {
  return new Date(ms).toISOString().slice(14, 19);
}

const DEFAULT_TIME = Object.freeze({ timed: false, diff: "xx:xx" });
function parseTime(
  name: string,
  time: number
): { timed: boolean; diff: string } {
  if (!time) return DEFAULT_TIME;

  const timer = S2_KEYS.get(name)?.timer;
  if (!timer) return DEFAULT_TIME;

  const timed = time < timer;
  const absDiff = formatTime(Math.abs(timer - time));
  const diff = `${timed ? "-" : "+"}${absDiff}`;

  return { timed, diff };
}

const PREF_OWNER = "FMJustice";
const MS_RANGE = 60 * 1000;
function cleanReports(reports: Parsed[]): Parsed[] {
  if (reports.length === 0) return [];

  reports.sort((a, b) => b.date - a.date);

  const cleaned = [reports[0]];

  for (let i = 1; i < reports.length; i++) {
    const prevIndex = cleaned.length - 1;
    const curr = reports[i];
    const prev = cleaned[prevIndex];

    if (
      curr.key === prev.key &&
      curr.level === prev.level &&
      MS_RANGE > Math.abs(curr.date - prev.date)
    ) {
      if (curr.owner === PREF_OWNER) continue;
      cleaned[prevIndex] = curr;
    } else {
      cleaned.push(curr);
    }
  }

  return cleaned;
}
