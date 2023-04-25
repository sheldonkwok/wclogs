const CLIENT_ID = import.meta.env.CLIENT_ID;
const CLIENT_SECRET = import.meta.env.CLIENT_SECRET;

export const get = async () => {
  const reports = await getReports();

  return { body: JSON.stringify(reports) };
};

const gql = String.raw; // for syntax highlighting
const GUILD_ID = 365689;
const MYTHIC_DIFF = 10;
const LIMIT = 20;
const query = gql`
  query {
    reportData {
      reports(guildID: ${GUILD_ID}, limit: ${LIMIT}) {
        data {
          code
          owner {
            name
          }
          fights(difficulty: ${MYTHIC_DIFF}) {
            id
            name
            keystoneLevel
            kill
          }
        }
      }
    }
  }
`;

interface Report {
  code: string;
  owner: { name: string };
  fights: Fight[];
}

interface Fight {
  id: number;
  name: string;
  keystoneLevel: number;
  kill: boolean;
}

export async function getReports() {
  const data = await fetch("https://www.warcraftlogs.com/api/v2/client", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${await getAuth()}`,
    },
    body: JSON.stringify({ query }),
  }).then((r) => r.json());

  const toParse = data.data.reportData.reports.data as Report[];
  return parseReports(toParse);
}

export interface Parsed {
  key: string;
  level: number;
  pass: boolean;
  owner: string;
  url: string;
}

function parseReports(reports: Report[]): Parsed[] {
  return reports.flatMap((r) => {
    return r.fights.reverse().map((f) => {
      return {
        key: f.name,
        level: f.keystoneLevel,
        pass: f.kill ?? false,
        owner: r.owner.name,
        url: `https://www.warcraftlogs.com/reports/${r.code}#fight=${f.id}`,
      };
    });
  });
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
