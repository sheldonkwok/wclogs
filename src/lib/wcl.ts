import { z } from "zod";

import { request, get } from "./api";

const gql = String.raw; // for syntax highlighting
const MYTHIC_DIFF = 10;
export const MPLUS_ZONE = 39;
const FIGHTS = `[${[...Array(100).keys()].join(" ")}]`;

function getReportsQuery(): string {
  return gql`
    query {
      reportData {
        reports(guildID: 365689, limit: 10, startTime: 1726025941, zoneID: ${MPLUS_ZONE}) {
          data {
            title
            owner {
              name
            }
            startTime
            fights(difficulty: ${MYTHIC_DIFF}) {
              encounterID
              difficulty
              name
            }
          }
        }
      }
    }
  `;
}

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

const ZReportDataRequest = z.object({
  data: z.object({
    reportData: z.object({
      report: ZReport,
    }),
  }),
});

export type Report = z.infer<typeof ZReport>;

export async function getReport(code: string): Promise<z.infer<typeof ZReport>> {
  const query = getReportQuery(code);

  const data = await request(query);
  const parsed = ZReportDataRequest.parse(data);
  return parsed.data.reportData.report;
}

const ZComposition = z.object({ name: z.string(), id: z.number(), type: z.string() });
const ZSummary = z.object({ composition: z.array(ZComposition) });

export async function getComposition(reportId: string): Promise<z.infer<typeof ZComposition>[]> {
  const data = await get(`/report/tables/summary/${reportId}`, {
    hostility: 1, // helps with filtering speed
    sourceclass: "junk", // helps with filtering speed
    end: 10000000, // could probably calculate the actual time to help with this
  });
  return ZSummary.parse(data).composition;
}

const ZIdentifier = z.object({ id: z.number(), name: z.string() });
const ZClass = ZIdentifier.extend({ specs: z.array(ZIdentifier) });
const ZClassArr = z.array(ZClass);

export async function getClasses(): Promise<z.infer<typeof ZClassArr>> {
  const data = await get("/classes");
  const parsed = ZClassArr.parse(data);

  return parsed;
}

const ZRanking = z.object({
  name: z.string(),
  serverName: z.string(),
  reportID: z.string(),
  fightID: z.number(),
  score: z.number(),
  affixes: z.array(z.number()),
});
export type Ranking = z.infer<typeof ZRanking>;

const ZEncounter = z.object({ rankings: z.array(ZRanking) });

export async function getRankings(
  encounterId: number,
  classId: number,
  specId: number
): Promise<z.infer<typeof ZEncounter>> {
  const encounters = await get(`/rankings/encounter/${encounterId}`, {
    class: classId,
    spec: specId,
    excludeLeaderboard: true,
    page: 1,
  });

  return ZEncounter.parse(encounters);
}

const ZReportPage = z.object({
  id: z.string(),
  zone: z.number(),
});

const ZReportArr = z.array(ZReportPage);

// TODO replace this with the gql query
export async function getReports(
  guildName: string,
  serverName: string,
  serverRegion: string
): Promise<z.infer<typeof ZReportArr>> {
  const now = new Date();
  const start = now.setMonth(now.getMonth() - 3);

  const data = await get(`/reports/guild/${guildName}/${serverName}/${serverRegion}`, {
    start,
  });

  const reports = ZReportArr.parse(data);
  const final = reports.filter((r) => r.zone === MPLUS_ZONE);
  return final;
}
