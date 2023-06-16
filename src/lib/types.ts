export interface Report {
  code: string;
  owner: { name: string };
  startTime: number;
  playerDetails: PlayerDetails;
  fights: Fight[];
}

export interface PlayerDetails {
  data: {
    playerDetails: PlayerRoleDetails;
  };
}

export interface PlayerRoleDetails {
  dps: Player[];
  healers: Player[];
  tanks: Player[];
}

export type Role = keyof PlayerRoleDetails;

export interface Player {
  id: number;
  name: string;
  type: string;
  server: string;
}

export interface Fight {
  id: number;
  name: string;
  keystoneLevel: number;
  keystoneAffixes: number[];
  kill: boolean;
  friendlyPlayers: number[];
  startTime: number;
  keystoneTime: number;
}
