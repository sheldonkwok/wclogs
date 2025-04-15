import { type } from "arktype";

import redis from "./redis";
import { Auth } from "./utils";
import { WCL_SEASON_ZONE as MPLUS_ZONE, GUILD_ID } from "./consts";

// v2
const CLIENT_ID = import.meta.env.CLIENT_ID;
const CLIENT_SECRET = import.meta.env.CLIENT_SECRET;

// v1
const KEY = import.meta.env.API_KEY_V1;
const gql = String.raw; // for syntax highlighting

const MYTHIC_DIFF = 10;

const FIGHTS = `[${[...Array(100).keys()].join(" ")}]`;

const Player = type({
  id: "number",
  name: "string",
  type: "string",
  icon: "string",
  server: "string",
});

export const ROLES = ["tanks", "healers", "dps"] as const;
export type Role = (typeof ROLES)[number];

const PlayerRole = Player.or("undefined").array();

const PlayerRoleDetails = type({
  [ROLES[0]]: PlayerRole,
  [ROLES[1]]: PlayerRole,
  [ROLES[2]]: PlayerRole,
});

export type PlayerRoleDetails = typeof PlayerRoleDetails.infer;

const PlayerDetails = type({
  data: {
    playerDetails: PlayerRoleDetails.or(type.null.array()),
  },
});

const Fight = type({
  id: "number",
  name: "string",
  encounterID: "number",
  keystoneLevel: "number",
  keystoneAffixes: "number[]",
  kill: "boolean",
  friendlyPlayers: "number[]",
  startTime: "number",
  keystoneTime: "number | null",
});

const Report = type({
  code: "string",
  owner: {
    name: "string",
  },
  startTime: "number",
  playerDetails: PlayerDetails,
  fights: Fight.array(),
});

export type Report = typeof Report.infer;

const ReportsQuery = type({
  data: {
    reportData: {
      reports: {
        data: Report.array(),
      },
    },
  },
});

const NUM_REPORTS = 12;

function getReportsQuery(): string {
  const now = new Date();
  const start = now.setMonth(now.getMonth() - 1);

  return gql`
    query {
      reportData {
        reports(guildID: ${GUILD_ID}, limit: ${NUM_REPORTS}, startTime: ${start}, zoneID: ${MPLUS_ZONE}) {
          data {
            title
            code
            owner {
              name
            }
            startTime
            playerDetails(fightIDs: ${FIGHTS})
            fights(difficulty: ${MYTHIC_DIFF}) {
              id
              name
              encounterID
              keystoneLevel
              keystoneAffixes
              kill
              friendlyPlayers
              keystoneTime
              startTime
            }
          }
        }
      }
    }
  `;
}

export async function getReports(): Promise<Report[]> {
  const query = getReportsQuery();
  const data = await request(query);

  const parsed = ReportsQuery.assert(data);
  const reportData = parsed.data.reportData;

  return reportData.reports.data;
}

const Composition = type({
  name: "string",
  id: "number",
  type: "string",
});

const Summary = type({
  composition: Composition.array(),
});

export async function getComposition(reportId: string): Promise<(typeof Composition.infer)[]> {
  const data = await get(`/report/tables/summary/${reportId}`, {
    hostility: 1, // helps with filtering speed
    sourceclass: "junk", // helps with filtering speed
    end: 10000000, // could probably calculate the actual time to help with this
  });

  const parsed = Summary.assert(data);
  return parsed.composition;
}

const Identifier = type({
  id: "number",
  name: "string",
});

const Class = type({
  "...": Identifier,
  specs: Identifier.array(),
});

const ClassArr = type(Class.array());

export async function getClasses(): Promise<typeof ClassArr.infer> {
  const data = await get("/classes");
  return ClassArr.assert(data);
}

const Ranking = type({
  name: "string",
  serverName: "string",
  reportID: "string",
  fightID: "number",
  score: "number",
  affixes: "number[]",
});

export type Ranking = typeof Ranking.infer;

const Encounter = type({
  rankings: Ranking.array(),
});

export async function getRankings(
  encounterId: number,
  classId: number,
  specId: number
): Promise<typeof Encounter.infer> {
  const encounters = await get(`/rankings/encounter/${encounterId}`, {
    class: classId,
    spec: specId,
    excludeLeaderboard: true,
    page: 1,
  });

  return Encounter.assert(encounters);
}

export async function request(query: string): Promise<unknown> {
  const token = await getAuth();
  const request = await fetch("https://www.warcraftlogs.com/api/v2/client", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${TOKEN}`,
    },
    body: JSON.stringify({ query }),
  });

  const reqData = await request.json();
  return reqData;
}

const TOKEN_KEY = "auth:wcl:v2";
const TOKEN = await getAuth();

async function getAuth(): Promise<string> {
  const cache = await redis.get(TOKEN_KEY);
  if (cache) return cache;

  const res = await fetch("https://www.warcraftlogs.com/oauth/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${CLIENT_ID}:${CLIENT_SECRET}`)}`,
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
  });

  if (!res.ok) throw new Error("Error fetching auth");

  const data = await res.json();
  const parsed = Auth(data);
  if (parsed instanceof type.errors) {
    throw new Error("Invalid auth response");
  }

  const { access_token, expires_in } = parsed;

  await redis.set(TOKEN_KEY, access_token, { EX: expires_in / 2 });

  return access_token;
}

const BASE_URL = "https://www.warcraftlogs.com/v1";
const KEY_QS = `api_key=${KEY}`;

export async function get(path: string, qs?: Record<string, string | number | boolean>): Promise<unknown> {
  let qsStr = KEY_QS;

  if (qs) {
    for (const [key, val] of Object.entries(qs)) {
      qsStr += `&${encodeURIComponent(key)}=${encodeURIComponent(val)}`;
    }
  }

  const url = `${BASE_URL}${path}?${qsStr}`;
  const req = await fetch(url);
  return await req.json();
}

export { WCL_SEASON_ZONE as MPLUS_ZONE } from "./consts";
