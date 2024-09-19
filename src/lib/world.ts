import z from "zod";

import { request } from "./api";
import { MPLUS_ZONE } from "./wcl";

const gql = String.raw; // syntax highlighting

const ZRIOAffix = z.object({
  id: z.number(),
  name: z.string(),
  icon: z.string().transform((name) => `https://cdn.raiderio.net/images/wow/icons/medium/${name}.jpg`),
});

export type Affix = z.infer<typeof ZRIOAffix>;

const ZRIOAffixesRequest = z.object({ affix_details: z.array(ZRIOAffix) });

async function getRIOAffixes(): Promise<Map<number, Affix>> {
  const RIO_AFFIX_URL = "https://raider.io/api/v1/mythic-plus/affixes?region=us&locale=en";
  const req = await fetch(RIO_AFFIX_URL);
  const data = await req.json();
  const parsed = ZRIOAffixesRequest.parse(data);

  const affixMap = new Map<number, Affix>();

  for (const affix of parsed.affix_details) {
    affixMap.set(affix.id, affix);
  }

  return affixMap;
}

export const AFFIX_MAP = await getRIOAffixes();

interface Key {
  title: string;
  encounterId: number;
  timer: number;
  image: string;
}

async function loadKeys(): Promise<Map<number, Key>> {
  const keys = await getKeys();

  const keyMap = new Map<number, Key>();
  for (const key of keys) {
    keyMap.set(key.encounterId, key);
  }

  return keyMap;
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
