import { z } from "zod";

import { GUILD_ID } from "./consts";

const CLIENT_ID = import.meta.env.CLIENT_ID;
const CLIENT_SECRET = import.meta.env.CLIENT_SECRET;
const TOKEN = await getAuth();

const gql = String.raw; // for syntax highlighting
const MYTHIC_DIFF = 10;
const LIMIT = 20;
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

const ZReportArr = z.array(ZReport);

export async function getReport(code: string): Promise<z.infer<typeof ZReport>> {
  const query = getReportQuery(code);
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

// The default expiration is a year so we assume this gets evicted within that period
async function getAuth(): Promise<string> {
  const res = await fetch("https://www.warcraftlogs.com/oauth/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${CLIENT_ID}:${CLIENT_SECRET}`)}`,
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
  });

  if (!res.ok) throw new Error("Error fetching auth");
  const { access_token } = await res.json();

  return access_token;
}
