import * as apiV1 from "./api-v1";

export interface CompareURLInput {
  reportId: string;
  fightId: number;
  mainAffix: number;
  encounterId: number;
  classSpec: string;
}

export async function getCompareURL({
  reportId,
  fightId,
  mainAffix,
  encounterId,
  classSpec,
}: CompareURLInput): Promise<string> {
  const { classId, specId } = CLASSES[classSpec];

  const best = await getBestReport({ mainAffix, encounterId, classId, specId });

  return `https://www.warcraftlogs.com/reports/compare/${reportId}/${best.reportID}#fight=${fightId},${best.fightID}`;
}

export interface RankingsInput {
  mainAffix: number;
  encounterId: number;
  classId: number;
  specId: number;
}

export async function getBestReport({
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
