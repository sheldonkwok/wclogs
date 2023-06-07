export interface Report {
  code: string;
  owner: { name: string };
  startTime: number;
  playerDetails: PlayerDetails;
  fights: Fight[];
}

export interface PlayerDetails {
  data: {
    playerDetails: { dps: Player[]; healers: Player[]; tanks: Player[] };
  };
}

export interface Player {
  id: number;
  name: string;
  type: string;
}

export interface Fight {
  id: number;
  name: string;
  keystoneLevel: number;
  kill: boolean;
  friendlyPlayers: number[];
  startTime: number;
  keystoneTime: number;
}
