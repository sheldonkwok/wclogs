import pMap from "p-map";

import redis from "./redis";

import * as wcl from "./wcl";
import * as world from "./world";
import * as consts from "./consts";

export type { Role } from "./wcl";
const ROLES = wcl.ROLES;

const MIN = 60_000;
const DAY = 24 * 60 * MIN;

export interface RPlayer {
  role: wcl.Role;
  id: number;
  name: string;
  type: string;
  classSpec: string;
  rioUrl: string;
  compareUrl?: string;
}

export interface Fight {
  key: string;
  image: string;
  level: number;
  affixes: world.Affix[];
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

const WEEK = 7;
async function getReports(since: number = WEEK): Promise<Fight[]> {
  const reports = await wcl.getReports(since);

  const parsed = reports.flatMap(parseReport);
  const cleaned = cleanReports(parsed);

  if (cleaned.length > 0 || since > WEEK) return cleaned;

  // Fall back to a month.
  // Could cache the fallback eventually but
  // not having keys within a week probably means season is dead
  const month = 30;
  return getReports(month);
}

export function parseReports(reports: wcl.Report[]): Fight[] {
  const allReports = reports.flatMap((r) => parseReport(r));
  return cleanReports(allReports);
}

export function parseReport(report: wcl.Report): Fight[] {
  if (Array.isArray(report.playerDetails.data.playerDetails)) return []; // Bad data

  const rPlayers = parsePlayerDetails(report.playerDetails.data.playerDetails);

  return report.fights.reverse().map((f) => {
    const keyTime = f.keystoneTime ?? 0;
    const encounterId = f.encounterID;

    const affixes = f.keystoneAffixes.map((a) => world.AFFIX_MAP.get(a)!);
    const hasPeril = !!affixes.find((a) => a.name === "Challenger's Peril");
    const { timed, diff } = parseTime(encounterId, keyTime, hasPeril);

    const key = world.KEYS.get(encounterId)!;

    const players = findPlayers(rPlayers, f.friendlyPlayers).map((p) => ({
      ...p,
      // TODO need the new compare link
      compareUrl: `/compare?reportId=${report.code}&fightId=${f.id}&encounterId=${key.encounterId}&classSpec=${p.classSpec}&sourceId=${p.id}`,
    }));

    return {
      key: key.title,
      image: key?.image ?? "",
      level: f.keystoneLevel,
      affixes,
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

const TANK_SPECS = new Set([
  "DeathKnight-Blood",
  "DemonHunter-Vengeance",
  "Druid-Guardian",
  "Monk-Brewmaster",
  "Paladin-Protection",
  "Warrior-Protection",
]);

// The API rolls every fight in a report into one set of player details so a
// player who swapped specs lands in multiple roles. Track their tank entry
// separately since the later dps one overwrites it.
interface ReportPlayers {
  all: Map<number, RPlayer>;
  tanks: Map<number, RPlayer>;
}

function parsePlayerDetails(details: wcl.PlayerRoleDetails): ReportPlayers {
  const all = new Map<number, RPlayer>();
  const tanks = new Map<number, RPlayer>();

  for (const role of ROLES) {
    const playerRoles = details[role];
    if (!playerRoles) continue;

    for (const player of playerRoles) {
      if (!player) continue;

      const rPlayer: RPlayer = {
        id: player.id,
        role: role,
        name: player.name,
        type: player.type,
        classSpec: player.icon,
        rioUrl: `https://raider.io/characters/us/${player.server}/${player.name}`,
      };

      all.set(player.id, rPlayer);
      if (role === "tanks" || TANK_SPECS.has(rPlayer.classSpec)) {
        tanks.set(player.id, { ...rPlayer, role: "tanks" });
      }
    }
  }

  return { all, tanks };
}

const UNKNOWN_PLAYER = Object.freeze({
  id: -1,
  role: "dps" as const,
  name: "?",
  type: "?",
  classSpec: "",
  rioUrl: "",
});

// A key with no tank means whoever tanked it got merged into another role, so
// pick the member who tanked or held a tank spec somewhere in the report
function markTank(players: RPlayer[], tanks: Map<number, RPlayer>): RPlayer[] {
  const i = players.findIndex((p) => tanks.has(p.id));
  if (i === -1) return players;

  const marked = [...players];
  marked[i] = tanks.get(marked[i].id)!;

  return marked;
}

// The API can mix up runs if the party is filled in another run
function findPlayers({ all, tanks }: ReportPlayers, playerIds: number[]): RPlayer[] {
  let hasTank = false;
  let hasHealer = false;

  const found = playerIds
    .sort((a, b) => a - b)
    .map((p) => {
      const rp = all.get(p);
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
    });

  const withTank = hasTank ? found : markTank(found, tanks);

  return withTank.sort((a, b) => ROLES.indexOf(a.role) - ROLES.indexOf(b.role)).slice(0, 5);
}

function formatTime(ms: number): string {
  return new Date(ms).toISOString().slice(14, 19);
}

const DEFAULT_TIME = Object.freeze({ timed: false, diff: "xx:xx" });
function parseTime(encounterId: number, time: number, peril: boolean): { timed: boolean; diff: string } {
  if (!time) return DEFAULT_TIME;

  let timer = world.KEYS.get(encounterId)?.timer;
  if (!timer) return DEFAULT_TIME;
  if (peril) timer += 90 * 1000;

  const timed = time < timer;
  const absDiff = formatTime(Math.abs(timer - time));
  const diff = `${timed ? "-" : "+"}${absDiff}`;

  return { timed, diff };
}

const PREF_OWNER = "FMJustice";
const MS_RANGE = 60 * 1000;
const LIMIT = 15;

function cleanReports(reports: Fight[]): Fight[] {
  if (reports.length === 0) return [];

  reports.sort((a, b) => b.date - a.date);

  const cleaned: Fight[] = [];

  for (let i = 0; i < reports.length; i++) {
    const curr = reports[i];
    if (curr.level === 0 || curr.players.length === 0) continue;

    const prevIndex = cleaned.length - 1;
    const prev = cleaned[prevIndex];

    if (
      prev &&
      curr.key === prev.key &&
      curr.level === prev.level &&
      MS_RANGE > Math.abs(curr.date - prev.date)
    ) {
      if (curr.owner === PREF_OWNER) continue;
      cleaned[prevIndex] = curr;
    } else {
      cleaned.push(curr);
    }

    if (cleaned.length === LIMIT) break;
  }

  return cleaned;
}
