import type { Report } from "./types";

type RPlayer = { role: Role; name: string; type: string };
export interface Parsed {
  key: string;
  level: number;
  finished: boolean;
  timed: boolean;
  time: string;
  owner: string;
  date: number;
  players: RPlayer[];
  url: string;
}

const ROLES = ["tanks", "healers", "dps"] as const;
type Role = (typeof ROLES)[number];

export function parseReports(reports: Report[]): Parsed[] {
  const allReports = reports.flatMap((r) => {
    const rPlayers = new Map<number, RPlayer>();
    for (const role of ROLES) {
      const details = r.playerDetails.data.playerDetails;
      if (Array.isArray(details)) continue; // Bad data

      for (const player of details[role]) {
        rPlayers.set(player.id, {
          role: role,
          name: player.name,
          type: player.type,
        });
      }
    }

    return r.fights.reverse().map((f) => {
      return {
        key: f.name,
        level: f.keystoneLevel,
        finished: f.kill ?? false,
        timed: passed(f.name, f.keystoneTime),
        time: formatTime(f.keystoneTime),
        owner: r.owner.name,
        date: r.startTime + f.startTime,
        players: findPlayers(rPlayers, f.friendlyPlayers),
        url: `https://www.warcraftlogs.com/reports/${r.code}#fight=${f.id}`,
      };
    });
  });

  return dedupReports(allReports);
}

function findPlayers(
  rPlayers: Map<number, RPlayer>,
  playerIds: number[]
): RPlayer[] {
  return playerIds
    .map((p) => {
      const rp = rPlayers.get(p);
      if (!rp) return { role: "dps" as const, name: "?", type: "?" };
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

function passed(name: string, time: number): boolean {
  if (!time) return false;

  const timer = S2_TIMES.get(name);
  if (!timer) return false;

  return time < timer;
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
