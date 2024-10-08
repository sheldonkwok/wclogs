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
  let entries: [number, Affix][];

  if (!cache) {
    const affixes = await bnet.getKeystoneAffixes();
    entries = await pMap(
      affixes.affixes,
      async (a) => {
        const media = await bnet.getKeystoneAffixMedia(a.id);
        const affix = { ...a, icon: media.assets[0].value };

        return [a.id, affix];
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
  const [rioDungeons, wclEncounters] = await Promise.all([getRIODungeons(), getWCLEncounters()]);

  const idMap = new Map<string, number>();
  for (const e of wclEncounters) {
    idMap.set(e.name, e.id);
  }

  return rioDungeons.map((d) => {
    const encounterId = idMap.get(d.name);
    if (!encounterId) throw new Error(`Mismatched rio/wcl dungeon ${d.name}`);

    const key = {
      title: d.name,
      encounterId,
      timer: d.keystone_timer_ms,
      image: `https://cdn.raiderio.net${d.icon_url}`,
    };

    return key;
  });
}

const ZRIODungeon = z.object({
  name: z.string(),
  icon_url: z.string(),
  keystone_timer_ms: z.number(),
});

const ZRIODungeonRequest = z.object({
  dungeons: z.array(
    z.object({
      dungeon: ZRIODungeon,
    })
  ),
});

async function getRIODungeons(): Promise<z.infer<typeof ZRIODungeon>[]> {
  const RIO_DUNGEON_URL =
    "https://raider.io/api/characters/mythic-plus-scored-runs?season=season-tww-1&role=all&mode=scored&affixes=all&date=all&characterId=66381995";
  const req = await fetch(RIO_DUNGEON_URL);
  const data = await req.json();
  const parsed = ZRIODungeonRequest.parse(data);

  return parsed.dungeons.map((d) => d.dungeon);
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
