export type PickemPhase =
  | "SWISS_STAGE_1"
  | "SWISS_STAGE_2"
  | "SWISS_STAGE_3"
  | "PLAYOFFS"
  | "DOUBLE_ELIMINATION"
  | "PLAY_IN"
  | "FINISHED";

export type PickemStatus = "OPEN" | "CLOSED" | string;

export type PickemOverviewDTO = {
  event: {
    id: number | string;
    name: string;
    slug: string;
    deadline: string | null;
  };
  tournament: {
    phase: PickemPhase | string;
    status: PickemStatus;
    isOpen: boolean;
  };
  stats: {
    participants: number;
    predictions: number;
    byType: {
      swiss: number;
      playoffs: number;
      doubleElimination: number;
      playIn: number;
      matches: number;
      maps: number;
      mvp?: number;
    };
  };
  permissions: {
    isAdmin: boolean;
  };
};

export type PickemTopEntryDTO = {
  rank: number;
  userId: string;
  username: string;
  points: number;
  swissPoints?: number;
  playoffPoints?: number;
  mvpPoints?: number;
  matchPoints?: number;
};

export type PickemLeaderboardDTO = {
  event: {
    id: number | string;
    name: string;
    slug?: string;
  } | null;
  rows: PickemTopEntryDTO[];
};

export type UserPickRow = {
  stage: string;
  label: string;
  points: number;
};

export type UserMapBreakdownRow = {
  matchId: number;
  mapNo: number;
  predA: number | null;
  predB: number | null;
  resA: number | null;
  resB: number | null;
  points: number;
  explanation: string;
};

export type UserMatchBreakdownRow = {
  matchId: number;
  phase: string;
  matchNo: number | null;
  teamA: string;
  teamB: string;
  predA: number | null;
  predB: number | null;
  resA: number | null;
  resB: number | null;
  seriesPoints: number;
  mapPoints: number;
  totalPoints: number;
  explanation: string;
  maps?: UserMapBreakdownRow[];
};

export type PickemUserDetailsDTO = {
  user: {
    id: string;
    username: string;
  };
  totalPoints: number;
  picks: UserPickRow[];
  matchBreakdown?: UserMatchBreakdownRow[];
};

