import * as apiV1 from "./api-v1";

export interface CompareURLInput {
  reportId: string;
  fightId: number;
  mainAffix: number;
  encounterId: number;
  classSpec: string;
  sourceId: number;
}

export async function getCompareURL({
  reportId,
  fightId,
  mainAffix,
  encounterId,
  classSpec,
  sourceId,
}: CompareURLInput): Promise<string> {
  const { classId, specId } = CLASSES[classSpec];

  const best = await getBestReport({ mainAffix, encounterId, classId, specId });
  const bestSourceId = await getSourceId(best.reportID, best.name);

  let url = `https://www.warcraftlogs.com/reports/compare/${reportId}/${best.reportID}#fight=${fightId},${best.fightID}&type=casts`;
  if (bestSourceId !== undefined) url += `&source=${sourceId},${bestSourceId}`;

  return url;
}

async function getSourceId(reportId: string, name: string): Promise<number | undefined> {
  const comp = await apiV1.getComposition(reportId);

  for (const c of comp) {
    if (c.name === name) return c.id;
  }
}

interface RankingsInput {
  mainAffix: number;
  encounterId: number;
  classId: number;
  specId: number;
}

async function getBestReport({
  mainAffix,
  encounterId,
  classId,
  specId,
}: RankingsInput): Promise<apiV1.Ranking> {
  const { rankings } = await apiV1.getRankings(encounterId, classId, specId);

  const best = rankings.filter((k) => k.affixes.includes(mainAffix)).sort((a, b) => b.score - a.score);
  return best[0];
}

const CLASSES = await getClassSpec();

export interface ClassSpecIds {
  classId: number;
  specId: number;
}

async function getClassSpec(): Promise<Record<string, ClassSpecIds>> {
  const out: Record<string, ClassSpecIds> = {};
  const data = await apiV1.getClasses();

  for (const cl of data) {
    const name = cl.name.replace(/\s/g, "");

    for (const sp of cl.specs) {
      const key = `${name}-${sp.name.replace(/\s/g, "")}`;
      out[key] = { classId: cl.id, specId: sp.id };
    }
  }

  return out;
}
