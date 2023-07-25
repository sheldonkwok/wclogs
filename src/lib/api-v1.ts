import { z } from "zod";

const KEY = import.meta.env.API_KEY_V1;
const BASE_URL = "https://www.warcraftlogs.com/v1";
const KEY_QS = `api_key=${KEY}`;

const ZIdentifier = z.object({ id: z.number(), name: z.string() });
const ZClass = ZIdentifier.extend({ specs: z.array(ZIdentifier) });
const ZClassArr = z.array(ZClass);

export async function getClasses(): Promise<z.infer<typeof ZClassArr>> {
  const data = await (await fetch(`${BASE_URL}/classes?${KEY_QS}`)).json();
  const parsed = ZClassArr.parse(data);

  return parsed;
}
