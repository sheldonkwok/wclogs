import z from "zod";
import config from "../../config.json";

export const TYRANNICAL = 9;
export const FORTIFIED = 10;

// Since I'm downloading image manually, I'm assuming these ids hold consistent
export const AFFIXES = {
  "1": "overflowing",
  "2": "skittish",
  "3": "volcanic",
  "4": "necrotic",
  "5": "teeming",
  "6": "raging",
  "7": "bolstering",
  "8": "sanguine",
  [TYRANNICAL]: "tyrannical",
  [FORTIFIED]: "fortified",
  "11": "bursting",
  "12": "grievous",
  "13": "explosive",
  "14": "quaking",
  "15": "relentless",
  "16": "infested",
  "117": "reaping",
  "119": "beguiling",
  "120": "awakened",
  "121": "prideful",
  "122": "inspiring",
  "123": "spiteful",
  "124": "storming",
  "128": "tormented",
  "129": "infernal",
  "130": "encrypted",
  "131": "shrouded",
  "132": "thundering",
  "134": "entangling",
  "135": "afflicted",
  "136": "incorporeal",
  "137": "shielding",
};

export const AFFIX_MAP = new Map<number, string>(
  Object.entries(AFFIXES).map(([key, val]) => [Number(key), val])
);

const KeyZ = z.object({
  title: z.string(),
  timer: z.string().transform(parseTimeStr),
  encounterId: z.number(),
  image: z.string().transform((file) => `/images/keys/${file}.jpeg`),
});

const ConfigZ = z.object({ keys: z.array(KeyZ) });

export type KeyInfo = z.infer<typeof KeyZ>;

export const KEYS = await loadKeys();

async function loadKeys(): Promise<Map<number, KeyInfo>> {
  const { keys } = ConfigZ.parse(config);

  const keyMap = new Map<number, KeyInfo>();
  for (const key of keys) {
    keyMap.set(key.encounterId, key);
  }

  return keyMap;
}

function parseTimeStr(timeStr: string): number {
  const match = timeStr.match(/^(\d+)m((\d+)s)?$/);
  if (!match) throw new Error("Invalid timer on key");

  const minutes = Number(match[1]);
  let time = minutes * 60_000;

  const seconds = match[3];
  if (seconds) time += Number(seconds) * 1000;

  return time;
}
