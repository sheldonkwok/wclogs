import z from "zod";
import pMap from "p-map";

import redis from "./redis";
import * as bnet from "./bnet";
import { request } from "./wcl";
import { MPLUS_ZONE } from "./wcl";

const gql = String.raw; // syntax highlighting

export type Affix = {
  id: number;
  name: string;
  icon: string;
};

const AFFIX_CACHE_KEY = "affixes";

async function getAffixes(): Promise<Map<number, Affix>> {
  const cache = await redis.get(AFFIX_CACHE_KEY);
  let entries: [number, Affix][] = [];

  if (!cache) {
    const affixes = await bnet.getKeystoneAffixes();
    await pMap(
      affixes.affixes,
      async ({ id, name }) => {
        if (!name) return;

        const media = await bnet.getKeystoneAffixMedia(id);
        const asset = media.assets?.[0];
        if (!asset) return;

        const affix = { id, name, icon: asset.value };

        entries.push([id, affix]);
      },
      { concurrency: 5 }
    );

    await redis.set(AFFIX_CACHE_KEY, JSON.stringify(entries));
  } else {
    entries = JSON.parse(cache);
  }

  return new Map<number, Affix>(entries);
}

export const AFFIX_MAP = await getAffixes();

interface Key {
  title: string;
  encounterId: number;
  timer: number;
  image: string;
}

const KEY_CACHE_KEY = "keys";

async function loadKeys(): Promise<Map<number, Key>> {
  const cache = await redis.get(KEY_CACHE_KEY);
  let entries: [number, Key][];

  if (!cache) {
    const keys = await getKeys();
    entries = keys.map((k) => [k.encounterId, k]);

    await redis.set(KEY_CACHE_KEY, JSON.stringify(entries));
  } else {
    entries = JSON.parse(cache);
  }

  return new Map<number, Key>(entries);
}

async function getKeys(): Promise<Key[]> {
  const [seasonDungeons, wclEncounters] = await Promise.all([getSeasonDungeons(), getWCLEncounters()]);

  const idMap = new Map<string, number>();
  for (const e of wclEncounters) {
    idMap.set(e.name, e.id);
  }

  return seasonDungeons.map((d) => {
    const encounterId = idMap.get(d.name);
    if (!encounterId) throw new Error(`Mismatched rio/wcl dungeon ${d.name}`);

    const key = {
      title: d.name,
      encounterId,
      timer: d.timer,
      image: d.icon,
    };

    return key;
  });
}

export interface SeasonDungeons {
  name: string;
  icon: string;
  timer: number;
}

async function getSeasonDungeons(): Promise<SeasonDungeons[]> {
  const leaderboard = await bnet.getMythicLeaderboard();
  const currKeys = leaderboard.current_leaderboards;

  return pMap(
    currKeys,
    async (key) => {
      const mKey = await bnet.getMythicKeystone(key.id);
      const timer = mKey.keystone_upgrades[0].qualifying_duration;

      const journalUrl = mKey.dungeon.key.href;
      const usp = new URLSearchParams(new URL(journalUrl).search);
      const namespace = usp.get("namespace");
      if (!namespace) throw new Error(`No namespace in ${journalUrl}`);

      const media = await bnet.getJournalInstanceMedia(mKey.dungeon.id, namespace);
      const icon = media.assets[0].value;

      return { name: key.name, icon, timer };
    },
    { concurrency: 3 }
  );
}

const WCL_ENCOUNTER_QUERY = gql`
  query {
    worldData {
      zone(id: ${MPLUS_ZONE}) {
        encounters {
          name
          id
        }
      }
    }
  }
`;

const ZEncounter = z.object({
  name: z.string(),
  id: z.number(),
});

const ZWorldDataRequest = z.object({
  data: z.object({
    worldData: z.object({
      zone: z.object({
        encounters: z.array(ZEncounter),
      }),
    }),
  }),
});

async function getWCLEncounters(): Promise<z.infer<typeof ZEncounter>[]> {
  const data = await request(WCL_ENCOUNTER_QUERY);
  const parsed = ZWorldDataRequest.parse(data);
  return parsed.data.worldData.zone.encounters;
}

export const KEYS = await loadKeys();
