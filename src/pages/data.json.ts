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
          startTime
          playerDetails(fightIDs: [0,1,2,3,4,5,6,7,8,9,10])
          fights(difficulty: ${MYTHIC_DIFF}) {
            id
            name
            keystoneLevel
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

interface Report {
  code: string;
  owner: { name: string };
  startTime: number;
  playerDetails: PlayerDetails;
  fights: Fight[];
}

interface PlayerDetails {
  data: {
    playerDetails: { dps: Player[]; healers: Player[]; tanks: Player[] };
  };
}

interface Player {
  id: number;
  name: string;
}

interface Fight {
  id: number;
  name: string;
  keystoneLevel: number;
  kill: boolean;
  friendlyPlayers: number[];
  startTime: number;
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
  date: number;
  players: string[];
  url: string;
}

const ROLES = ["tanks", "healers", "dps"] as const;
type Role = (typeof ROLES)[number];

function parseReports(reports: Report[]): Parsed[] {
  const allReports = reports.flatMap((r) => {
    const rPlayers = new Map<number, { role: Role; name: string }>();
    for (const role of ROLES) {
      for (const player of r.playerDetails.data.playerDetails[role]) {
        rPlayers.set(player.id, { role: role, name: player.name });
      }
    }

    return r.fights.reverse().map((f) => {
      return {
        key: f.name,
        level: f.keystoneLevel,
        pass: f.kill ?? false,
        owner: r.owner.name,
        date: r.startTime + f.startTime,
        players: f.friendlyPlayers
          .map((p) => rPlayers.get(p)!)
          .sort((a, b) => ROLES.indexOf(a.role) - ROLES.indexOf(b.role))
          .map((p) => p.name),
        url: `https://www.warcraftlogs.com/reports/${r.code}#fight=${f.id}`,
      };
    });
  });

  return dedupReports(allReports);
}

const PREF_OWNER = "FMJustice";
const MS_RANGE = 60 * 1000;
function dedupReports(reports: Parsed[]): Parsed[] {
  if (reports.length === 0) return [];
  reports.sort((a, b) => b.date - a.date);

  const cleaned = [reports[0]];

  for (let i = 1; i < reports.length; i++) {
    const prevIndex = cleaned.length - 1;
    const curr = reports[i];
    const prev = cleaned[prevIndex];

    if (
      curr.key === prev.key &&
      curr.level === prev.level &&
      MS_RANGE > Math.abs(curr.date - prev.date)
    ) {
      if (curr.owner === PREF_OWNER) continue;
      cleaned[prevIndex] = curr;
    } else {
      cleaned.push(curr);
    }
  }

  return cleaned;
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
