import type { APIContext } from "astro";
import { z } from "zod";

import * as compare from "../lib/compare";

const ZCompareQuery = z.object({
  reportId: z.string(),
  fightId: z.coerce.number(),
  classSpec: z.string(),
  encounterId: z.coerce.number(),
  sourceId: z.coerce.number(),
});

export async function GET({ request, redirect }: APIContext) {
  const search = new URL(request.url).search;
  const searchP = new URLSearchParams(search);
  const qs = Object.fromEntries(searchP.entries());

  const parsed = ZCompareQuery.parse(qs);
  const url = await compare.getCompareURL(parsed);

  return redirect(url, 307);
}
