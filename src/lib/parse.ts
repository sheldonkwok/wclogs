import type { Report, PlayerRoleDetails, Role } from "./types";

export interface KeyInfo {
  abbrev: string;
  timer: number;
}
const MIN = 60_000;
const S2_KEYS = new Map<string, KeyInfo>([
  ["Uldaman", { abbrev: "uld", timer: 35 * MIN }],
  ["Neltharus", { abbrev: "nelt", timer: 33 * MIN }],
  ["Brackenhide Hollow", { abbrev: "bh", timer: 35 * MIN }],
  ["Halls of Infusion", { abbrev: "hoi", timer: 35 * MIN }],
  ["The Vortex Pinnacle", { abbrev: "vp", timer: 30 * MIN }],
  ["Freehold", { abbrev: "fh", timer: 30 * MIN }],
  ["The Underrot", { abbrev: "undr", timer: 30 * MIN }],
  ["Neltharion's Lair", { abbrev: "nl", timer: 33 * MIN }],
]);

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
  "9": "tyrannical",
  "10": "fortified",
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
  role: Role;
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

const ROLES = ["tanks", "healers", "dps"] as Role[];

export function parseReports(reports: Report[]): Parsed[] {
  const allReports = reports.flatMap((r) => {
    const rPlayers = parsePlayerDetails(r.playerDetails.data.playerDetails);

    return r.fights.reverse().map((f) => {
      const { timed, diff } = parseTime(f.name, f.keystoneTime);
      return {
        key: f.name,
        keyAbbrev: S2_KEYS.get(f.name)?.abbrev ?? "",
        level: f.keystoneLevel,
        affixes: f.keystoneAffixes.map((a) => AFFIX_MAP.get(a) ?? "unknown"),
        finished: f.kill ?? false,
        time: formatTime(f.keystoneTime),
        timed,
        timeDiff: diff,
        owner: r.owner.name,
        date: r.startTime + f.startTime,
        players: findPlayers(rPlayers, f.friendlyPlayers),
        url: `https://www.warcraftlogs.com/reports/${r.code}#fight=${f.id}`,
      };
    });
  });

  return dedupReports(allReports);
}

function parsePlayerDetails(details: PlayerRoleDetails): Map<number, RPlayer> {
  const rPlayers = new Map<number, RPlayer>();

  for (const role of ROLES) {
    if (Array.isArray(details)) continue; // Bad data

    for (const player of details[role]) {
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

function findPlayers(
  rPlayers: Map<number, RPlayer>,
  playerIds: number[]
): RPlayer[] {
  return playerIds
    .map((p) => {
      const rp = rPlayers.get(p);
      if (!rp) return UNKNOWN_PLAYER;

      return rp;
    })
    .sort((a, b) => ROLES.indexOf(a.role) - ROLES.indexOf(b.role));
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
function dedupReports(reports: Parsed[]): Parsed[] {
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
