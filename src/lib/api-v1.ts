import { z } from "zod";

const KEY = import.meta.env.API_KEY_V1;
const BASE_URL = "https://www.warcraftlogs.com/v1";
const KEY_QS = `api_key=${KEY}`;

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

async function get(path: string, qs?: Record<string, string | number | boolean>): Promise<unknown> {
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
