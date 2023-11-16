import pMap from "p-map";

import redis from "./redis";
import * as apiV1 from "./api-v1";
import * as apiV2 from "./api-v2";
import * as consts from "./consts";

export type { Role } from "./api-v2";
const ROLES = apiV2.ROLES;

export interface KeyInfo {
  abbrev: string;
  timer: number;
  encounterId: number;
}
const MIN = 60_000;
const KEYS = new Map<string, KeyInfo>([
  ["Uldaman", { abbrev: "uld", timer: 35 * MIN, encounterId: 12451 }],
  ["Brackenhide Hollow", { abbrev: "bh", timer: 35 * MIN, encounterId: 12520 }],
  ["Neltharus", { abbrev: "nelt", timer: 33 * MIN, encounterId: 12519 }],
  ["Halls of Infusion", { abbrev: "hoi", timer: 35 * MIN, encounterId: 12527 }],
  ["The Vortex Pinnacle", { abbrev: "vp", timer: 30 * MIN, encounterId: 10657 }],
  ["Freehold", { abbrev: "fh", timer: 30 * MIN, encounterId: 61754 }],
  ["The Underrot", { abbrev: "undr", timer: 30 * MIN, encounterId: 61841 }],
  ["Neltharion's Lair", { abbrev: "nl", timer: 33 * MIN, encounterId: 61458 }],

  ["DOTI: Galakrond's Fall", { abbrev: "fall", timer: 34 * MIN, encounterId: 12579 }],
  ["DOTI: Murazond's Rise", { abbrev: "rise", timer: 35 * MIN, encounterId: 12580 }],
  ["Atal'Dazar", { abbrev: "ad", timer: 30 * MIN, encounterId: 61763 }],
  ["Waycrest Manor", { abbrev: "wm", timer: 2200000, encounterId: 61862 }],
  ["Black Rook Hold", { abbrev: "brh", timer: 36 * MIN, encounterId: 61501 }],
  ["Darkheart Thicket", { abbrev: "dht", timer: 30 * MIN, encounterId: 61466 }],
  ["Everbloom", { abbrev: "eb", timer: 33 * MIN, encounterId: 61279 }],
  ["Throne of the Tides", { abbrev: "tott", timer: 34 * MIN, encounterId: 10643 }],
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

const AFFIX_MAP = new Map<number, string>(Object.entries(AFFIXES).map(([key, val]) => [Number(key), val]));

export interface RPlayer {
  role: apiV2.Role;
  id: number;
  name: string;
  type: string;
  classSpec: string;
  rioUrl: string;
  compareUrl?: string;
}

export interface Fight {
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
  data: Fight[];
  time: number;
}

export async function getKeys(): Promise<KeyData> {
  const start = Date.now();

  const data = await getReports();
  const time = Date.now() - start;

  return { data, time };
}

async function getReports(): Promise<Fight[]> {
  const reportIds = await getReportIds();

  // typing on mget is broke
  const cache = (await redis.mGet(reportIds)) as any as (string | null)[];

  // not type safe rn
  const allFights = await pMap(cache, async (cachedReport, index) => {
    if (cachedReport) return JSON.parse(cachedReport) as Fight[];

    const reportId = reportIds[index];
    const report = await apiV2.getReport(reportId);
    const fights = parseReport(report);

    await redis.set(reportId, JSON.stringify(fights));
    return fights;
  });

  return cleanReports(allFights.flat());
}

export const REPORT_ID_KEY = "reportIds";
const REPORT_SEPARATOR = ",";

export async function getReportIds(): Promise<string[]> {
  const cached = await redis.get(REPORT_ID_KEY);
  if (cached) return cached.split(REPORT_SEPARATOR);

  const reports = await apiV1.getReports(
    consts.GUILD_NAME,
    consts.GUILD_SERVER_NAME,
    consts.GUILD_SERVER_REGION
  );

  const reportIds = reports.map((r) => r.id);

  await redis.set(REPORT_ID_KEY, reportIds.join(REPORT_SEPARATOR), { EX: 5 * 60 });
  return reportIds;
}

export function parseReports(reports: apiV2.Report[]): Fight[] {
  const allReports = reports.flatMap((r) => parseReport(r));
  return cleanReports(allReports);
}

export function parseReport(report: apiV2.Report): Fight[] {
  if (Array.isArray(report.playerDetails.data.playerDetails)) return []; // Bad data

  const rPlayers = parsePlayerDetails(report.playerDetails.data.playerDetails);

  return report.fights.reverse().map((f) => {
    const keyTime = f.keystoneTime ?? 0;
    const { timed, diff } = parseTime(f.name, keyTime);

    const key = KEYS.get(f.name)!;
    const mainAffix = f.keystoneAffixes.find((a) => a === TYRANNICAL || a === FORTIFIED)!;

    const players = findPlayers(rPlayers, f.friendlyPlayers).map((p) => ({
      ...p,
      compareUrl: `/compare?reportId=${report.code}&fightId=${f.id}&mainAffix=${mainAffix}&encounterId=${key.encounterId}&classSpec=${p.classSpec}&sourceId=${p.id}`,
    }));

    return {
      key: f.name,
      keyAbbrev: key?.abbrev ?? "",
      level: f.keystoneLevel,
      affixes: f.keystoneAffixes.map((a) => AFFIX_MAP.get(a) ?? "unknown"),
      finished: f.kill ?? false,
      time: formatTime(keyTime),
      timed,
      timeDiff: diff,
      owner: report.owner.name,
      date: report.startTime + f.startTime,
      players,
      url: `https://www.warcraftlogs.com/reports/${report.code}#fight=${f.id}`,
    };
  });
}

function parsePlayerDetails(details: apiV2.PlayerRoleDetails): Map<number, RPlayer> {
  const rPlayers = new Map<number, RPlayer>();

  for (const role of ROLES) {
    const playerRoles = details[role];
    if (!playerRoles) continue;

    for (const player of playerRoles) {
      rPlayers.set(player.id, {
        id: player.id,
        role: role,
        name: player.name,
        type: player.type,
        classSpec: player.icon,
        rioUrl: `https://raider.io/characters/us/${player.server}/${player.name}`,
      });
    }
  }

  return rPlayers;
}

const UNKNOWN_PLAYER = Object.freeze({
  id: -1,
  role: "dps" as const,
  name: "?",
  type: "?",
  classSpec: "",
  rioUrl: "",
});

// The API can mix up runs if the party is filled in another run
function findPlayers(rPlayers: Map<number, RPlayer>, playerIds: number[]): RPlayer[] {
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
function parseTime(name: string, time: number): { timed: boolean; diff: string } {
  if (!time) return DEFAULT_TIME;

  const timer = KEYS.get(name)?.timer;
  if (!timer) return DEFAULT_TIME;

  const timed = time < timer;
  const absDiff = formatTime(Math.abs(timer - time));
  const diff = `${timed ? "-" : "+"}${absDiff}`;

  return { timed, diff };
}

const PREF_OWNER = "FMJustice";
const MS_RANGE = 60 * 1000;
function cleanReports(reports: Fight[]): Fight[] {
  if (reports.length === 0) return [];

  reports.sort((a, b) => b.date - a.date);

  const cleaned = [reports[0]];

  for (let i = 1; i < reports.length; i++) {
    const prevIndex = cleaned.length - 1;
    const curr = reports[i];
    const prev = cleaned[prevIndex];

    if (curr.key === prev.key && curr.level === prev.level && MS_RANGE > Math.abs(curr.date - prev.date)) {
      if (curr.owner === PREF_OWNER) continue;
      cleaned[prevIndex] = curr;
    } else {
      cleaned.push(curr);
    }
  }

  return cleaned;
}
