import type { APIContext } from "astro";

import redis from "../lib/redis";
import { REPORT_ID_KEY } from "../lib/keys";

export async function GET({ request, redirect }: APIContext) {
  await redis.del(REPORT_ID_KEY);

  return redirect("/", 307);
}
