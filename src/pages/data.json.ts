import { parseReports, Parsed } from "../lib/parse";
import type { Report } from "../lib/types";

const CLIENT_ID = import.meta.env.CLIENT_ID;
const CLIENT_SECRET = import.meta.env.CLIENT_SECRET;

export const get = async () => {
  const reports = await getKeys();
  return { body: JSON.stringify(reports) };
};

const gql = String.raw; // for syntax highlighting
const GUILD_ID = 365689;
const MYTHIC_DIFF = 10;
const LIMIT = 20;
const FIGHTS = `[${[...Array(100).keys()].join(" ")}]`;

const query = gql`
  query {
    reportData {
      reports(guildID: ${GUILD_ID}, limit: ${LIMIT}) {
        data {
          code
          owner {
            name
          }
          startTime
          playerDetails(fightIDs: ${FIGHTS})
          fights(difficulty: ${MYTHIC_DIFF}) {
            id
            name
            keystoneLevel
            keystoneAffixes
            kill
            friendlyPlayers
            keystoneTime
            startTime
          }
        }
      }
    }
  }
`;

interface KeyData {
  data: Parsed[];
  time: number;
}

export async function getKeys(): Promise<KeyData> {
  const start = Date.now();
  const request = await fetch("https://www.warcraftlogs.com/api/v2/client", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${await getAuth()}`,
    },
    body: JSON.stringify({ query }),
  });

  const reqData = await request.json();
  const toParse = reqData.data.reportData.reports.data as Report[];

  const time = Date.now() - start;
  const data = parseReports(toParse);

  return { data, time };
}

let token = "";
// The default expiration is a year so we assume this gets evicted within that period
async function getAuth(): Promise<string> {
  if (token) return token;

  const res = await fetch("https://www.warcraftlogs.com/oauth/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${CLIENT_ID}:${CLIENT_SECRET}`)}`,
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
  });

  if (!res.ok) throw new Error("Error fetching auth");
  const { access_token } = await res.json();

  token = access_token;
  return token;
}
