import type { Report, PlayerRoleDetails, Role } from "./types";

export interface RPlayer {
  role: Role;
  name: string;
  type: string;
  rioUrl: string;
}

export interface Parsed {
  key: string;
  level: number;
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
        level: f.keystoneLevel,
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

const MIN = 60_000;
const S2_TIMES = new Map([
  ["Uldaman: Legacy of Tyr", 35 * MIN],
  ["Neltharus", 33 * MIN],
  ["Brackenhide Hollow", 35 * MIN],
  ["Halls of Infusion", 35 * MIN],
  ["Vortex Pinnacle", 30 * MIN],
  ["Freehold", 30 * MIN],
  ["Underrot", 30 * MIN],
  ["Neltharion's Lair", 33 * MIN],
]);

const DEFAULT_TIME = Object.freeze({ timed: false, diff: "xx:xx" });
function parseTime(
  name: string,
  time: number
): { timed: boolean; diff: string } {
  if (!time) return DEFAULT_TIME;

  const timer = S2_TIMES.get(name);
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
