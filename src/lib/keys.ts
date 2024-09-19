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

async function getReports(): Promise<Fight[]> {
  const reportIds = await getReportIds();

  // typing on mget is broke
  const cache = (await redis.mGet(reportIds)) as any as (string | null)[];

  // not type safe rn
  const allFights = await pMap(cache, async (cachedReport, index) => {
    if (cachedReport) return JSON.parse(cachedReport) as Fight[];

    const reportId = reportIds[index];
    const report = await wcl.getReport(reportId);
    const fights = parseReport(report);

    await redis.set(reportId, JSON.stringify(fights), { EX: 7 * DAY });
    return fights;
  });

  return cleanReports(allFights.flat());
}

export const REPORT_ID_KEY = "reportIds";
const REPORT_SEPARATOR = ",";

export async function getReportIds(): Promise<string[]> {
  const cached = await redis.get(REPORT_ID_KEY);
  if (cached) return cached.split(REPORT_SEPARATOR);

  const reports = await wcl.getReports(
    consts.GUILD_NAME,
    consts.GUILD_SERVER_NAME,
    consts.GUILD_SERVER_REGION
  );

  const reportIds = reports.map((r) => r.id);

  await redis.set(REPORT_ID_KEY, reportIds.join(REPORT_SEPARATOR), { EX: 5 * 60 });
  return reportIds;
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
    const { timed, diff } = parseTime(encounterId, keyTime);

    const key = world.KEYS.get(encounterId)!;

    const players = findPlayers(rPlayers, f.friendlyPlayers).map((p) => ({
      ...p,
      // TODO need the new compare link
      // compareUrl: `/compare?reportId=${report.code}&fightId=${f.id}&mainAffix=${mainAffix}&encounterId=${key.encounterId}&classSpec=${p.classSpec}&sourceId=${p.id}`,
    }));

    return {
      key: key.title,
      image: key?.image ?? "",
      level: f.keystoneLevel,
      affixes: f.keystoneAffixes.map((a) => world.AFFIX_MAP.get(a)!), // Fix !
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

function parsePlayerDetails(details: wcl.PlayerRoleDetails): Map<number, RPlayer> {
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
function parseTime(encounterId: number, time: number): { timed: boolean; diff: string } {
  if (!time) return DEFAULT_TIME;

  const timer = world.KEYS.get(encounterId)?.timer;
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
