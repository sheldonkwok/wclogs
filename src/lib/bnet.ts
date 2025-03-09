import { z } from "zod";

import redis from "./redis";
import { ZAuth } from "./utils";

const BASE_URL = "https://us.api.blizzard.com/data/wow";

const ZMythicLeaderboard = z.object({
  current_leaderboards: z.array(
    z.object({
      id: z.number(),
      name: z.string(),
    })
  ),
});

export async function getMythicLeaderboard(): Promise<z.infer<typeof ZMythicLeaderboard>> {
  const token = await getAuth();
  const response = await fetch(
    `${BASE_URL}/connected-realm/11/mythic-leaderboard/index?namespace=dynamic-us&locale=en_US`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const data = await response.text();
  const parsed = ZMythicLeaderboard.parse(JSON.parse(data));
  return parsed;
}

const ZMythicKeystone = z.object({
  id: z.number(),
  name: z.string(),
  dungeon: z.object({
    id: z.number(),
    key: z.object({ href: z.string() }),
  }),
  keystone_upgrades: z.array(
    z.object({
      upgrade_level: z.number(),
      qualifying_duration: z.number(),
    })
  ),
});

export async function getMythicKeystone(keystoneId: number): Promise<z.infer<typeof ZMythicKeystone>> {
  const token = await getAuth();
  const response = await fetch(
    `${BASE_URL}/mythic-keystone/dungeon/${keystoneId}?namespace=dynamic-us&locale=en_US`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const data = await response.text();
  const parsed = ZMythicKeystone.parse(JSON.parse(data));
  return parsed;
}

const ZJournalInstanceMedia = z.object({
  assets: z.array(z.object({ value: z.string() })),
});

export async function getJournalInstanceMedia(
  journalId: number,
  namespace: string
): Promise<z.infer<typeof ZJournalInstanceMedia>> {
  const token = await getAuth();
  const response = await fetch(`${BASE_URL}/media/journal-instance/${journalId}?namespace=${namespace}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.text();
  const parsed = ZJournalInstanceMedia.parse(JSON.parse(data));
  return parsed;
}

const ZKeystoneAffixes = z.object({
  affixes: z.array(
    z.object({
      id: z.number(),
      name: z.string().nullable(),
    })
  ),
});

export async function getKeystoneAffixes(): Promise<z.infer<typeof ZKeystoneAffixes>> {
  const token = await getAuth();
  const response = await fetch(`${BASE_URL}/keystone-affix/index?namespace=static-us&locale=en_US`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.text();
  const parsed = ZKeystoneAffixes.parse(JSON.parse(data));
  return parsed;
}

const ZKeystoneAffixMedia = z.object({
  assets: z
    .array(
      z.object({
        value: z.string(),
      })
    )
    .optional(),
});

export async function getKeystoneAffixMedia(id: number): Promise<z.infer<typeof ZKeystoneAffixMedia>> {
  const token = await getAuth();
  const response = await fetch(`${BASE_URL}/media/keystone-affix/${id}?namespace=static-us&locale=en_US`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();
  const parsed = ZKeystoneAffixMedia.parse(data);
  return parsed;
}

const CLIENT_ID = import.meta.env.BNET_CLIENT_ID;
const CLIENT_SECRET = import.meta.env.BNET_CLIENT_SECRET;
const AUTH_URL = "https://oauth.battle.net/token";

const TOKEN_KEY = "auth:bnet:v2";

async function getAuth(): Promise<string> {
  const cache = await redis.get(TOKEN_KEY);
  if (cache) return cache;

  const response = await fetch(AUTH_URL, {
    method: "POST",
    headers: {
      Authorization: "Basic " + btoa(`${CLIENT_ID}:${CLIENT_SECRET}`),
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  const { access_token, expires_in } = ZAuth.parse(data);

  await redis.set(TOKEN_KEY, access_token, { EX: Math.floor(expires_in / 2) });

  return access_token;
}
