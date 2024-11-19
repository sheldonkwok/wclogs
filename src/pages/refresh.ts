import type { APIContext } from "astro";

import redis from "../lib/redis";

export async function GET({ request, redirect }: APIContext) {
  await redis.flushDb();

  return redirect("/", 307);
}
