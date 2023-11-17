import { z } from "zod";

import redis from "./redis";

const CLIENT_ID = import.meta.env.CLIENT_ID;
const CLIENT_SECRET = import.meta.env.CLIENT_SECRET;

const gql = String.raw; // for syntax highlighting
const MYTHIC_DIFF = 10;
const FIGHTS = `[${[...Array(100).keys()].join(" ")}]`;

function getReportQuery(code: string): string {
  return gql`
    query {
      reportData {
        report(code: "${code}") {
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
  `;
}

const ZPlayer = z.object({
  id: z.number(),
  name: z.string(),
  type: z.string(),
  icon: z.string(),
  server: z.string(),
});

const ZPlayerRoleDetails = z.object({
  tanks: z.array(ZPlayer).optional(),
  healers: z.array(ZPlayer).optional(),
  dps: z.array(ZPlayer).optional(),
});

export type PlayerRoleDetails = z.infer<typeof ZPlayerRoleDetails>;

const ZRole = ZPlayerRoleDetails.keyof();
export const ROLES = ZRole.options;
export type Role = z.infer<typeof ZRole>;

const ZPlayerDetails = z.object({
  data: z.object({
    playerDetails: z.union([ZPlayerRoleDetails, z.array(z.null())]),
  }),
});

const ZFight = z.object({
  id: z.number(),
  name: z.string(),
  encounterID: z.number(),
  keystoneLevel: z.number(),
  keystoneAffixes: z.array(z.number()),
  kill: z.boolean(),
  friendlyPlayers: z.array(z.number()),
  startTime: z.number(),
  keystoneTime: z.number().nullable(),
});

const ZReport = z.object({
  code: z.string(),
  owner: z.object({ name: z.string() }),
  startTime: z.number(),
  playerDetails: ZPlayerDetails,
  fights: z.array(ZFight),
});

export type Report = z.infer<typeof ZReport>;

export async function getReport(code: string): Promise<z.infer<typeof ZReport>> {
  const query = getReportQuery(code);

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
  const report = reqData.data.reportData.report;

  return ZReport.parse(report);
}

const ZAuth = z.object({
  access_token: z.string(),
  expires_in: z.number(),
});

const TOKEN_KEY = "auth:v2";
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
  const { access_token, expires_in } = ZAuth.parse(data);

  await redis.set(TOKEN_KEY, access_token, { EX: expires_in / 2 });

  return access_token;
}
