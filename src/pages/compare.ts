import { type } from "arktype";
import type { APIContext } from "astro";

import * as compare from "../lib/compare";

const CompareQuery = type({
  reportId: "string",
  fightId: "number",
  classSpec: "string",
  encounterId: "number",
  sourceId: "number",
});

export async function GET({ request, redirect }: APIContext) {
  const search = new URL(request.url).search;
  const searchP = new URLSearchParams(search);
  const qs = Object.fromEntries(searchP.entries());

  // Need to coerce number fields since URLSearchParams gives strings
  const parsed = CompareQuery({
    ...qs,
    fightId: Number(qs.fightId),
    encounterId: Number(qs.encounterId),
    sourceId: Number(qs.sourceId),
  });

  if (parsed instanceof type.errors) {
    throw new Error("Invalid compare query parameters");
  }

  const url = await compare.getCompareURL(parsed);
  return redirect(url, 307);
}
