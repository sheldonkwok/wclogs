export interface Parsed {
  key: string;
  level: number;
  pass: boolean;
  owner: string;
  url: string;
}

export const get = async () => {
  const reports = await getReports();

  const data = reports.flatMap((r) => {
    return r.fights.map<Parsed>((f) => {
      return {
        key: f.name,
        level: f.keystoneLevel,
        pass: f.kill ?? false,
        owner: r.owner.name,
        url: `https://www.warcraftlogs.com/reports/${r.code}#fight=${f.id}`,
      };
    });
  });

  return { body: JSON.stringify(data) };
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

async function getReports() {
  const res = await fetch("https://www.warcraftlogs.com/api/v2/client", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${await getAuth()}`,
    },
    body: JSON.stringify({ query }),
  });

  if (!res.ok) throw new Error("Error fetching logs");

  const data = await res.json();
  return data.data.reportData.reports.data as Report[];
}

const CLIENT_ID = import.meta.env.CLIENT_ID;
const CLIENT_SECRET = import.meta.env.CLIENT_SECRET;

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
