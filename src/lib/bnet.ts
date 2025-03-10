import { type } from "arktype";

import redis from "./redis";
import { Auth } from "./utils";

export const DefaultMeta = type({
  id: "number",
  name: "string | null",
});

const BASE_URL = "https://us.api.blizzard.com/data/wow";

const MythicLeaderboard = type({
  current_leaderboards: DefaultMeta.array(),
});

export async function getMythicLeaderboard(): Promise<typeof MythicLeaderboard.infer> {
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
  const parsed = MythicLeaderboard(JSON.parse(data));
  if (parsed instanceof type.errors) {
    throw new Error("Invalid mythic leaderboard response");
  }
  return parsed;
}

const MythicKeystone = type({
  "...": DefaultMeta,
  dungeon: {
    id: "number",
    key: { href: "string" },
  },
  keystone_upgrades: type({
    upgrade_level: "number",
    qualifying_duration: "number",
  }).array(),
});

export async function getMythicKeystone(keystoneId: number): Promise<typeof MythicKeystone.infer> {
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
  const parsed = MythicKeystone(JSON.parse(data));
  if (parsed instanceof type.errors) {
    throw new Error("Invalid mythic keystone response");
  }
  return parsed;
}

const JournalInstanceMedia = type({
  assets: type({ value: "string" }).array(),
});

export async function getJournalInstanceMedia(
  journalId: number,
  namespace: string
): Promise<typeof JournalInstanceMedia.infer> {
  const token = await getAuth();
  const response = await fetch(`${BASE_URL}/media/journal-instance/${journalId}?namespace=${namespace}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();
  return JournalInstanceMedia.assert(data);
}

const KeystoneAffixes = type({
  affixes: DefaultMeta.array(),
});

export async function getKeystoneAffixes(): Promise<typeof KeystoneAffixes.infer> {
  const token = await getAuth();
  const response = await fetch(`${BASE_URL}/keystone-affix/index?namespace=static-us&locale=en_US`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();
  return KeystoneAffixes.assert(data);
}

const KeystoneAffixMedia = type({
  "assets?": type({ value: "string" }).array(),
});

export async function getKeystoneAffixMedia(id: number): Promise<typeof KeystoneAffixMedia.infer> {
  const token = await getAuth();
  const response = await fetch(`${BASE_URL}/media/keystone-affix/${id}?namespace=static-us&locale=en_US`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();
  const parsed = KeystoneAffixMedia(data);
  if (parsed instanceof type.errors) {
    throw new Error("Invalid keystone affix media response");
  }
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
  const parsed = Auth(data);
  if (parsed instanceof type.errors) throw new Error(parsed.summary);

  const { access_token, expires_in } = parsed;

  await redis.set(TOKEN_KEY, access_token, { EX: Math.floor(expires_in / 2) });

  return access_token;
}
