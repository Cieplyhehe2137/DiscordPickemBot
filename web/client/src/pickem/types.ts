// ========================
// PICKEM OVERVIEW
// ========================

export type PickemStatus = "open" | "locked" | "scoring" | "scored";

export type PickemOverviewDTO = {
  event: {
    id: number;
    name: string;
  };
  participants: number;
  deadline: string; // ISO
  status: PickemStatus;
  lastScoredAt: string | null;
};

// ========================
// LEADERBOARD
// ========================

export type LeaderboardRow = {
  rank: number;
  userId: string;
  username: string;
  points: number;
};

export type PickemLeaderboardDTO = {
  event: {
    id: number;
    name: string;
  };
  rows: LeaderboardRow[];
};

// ========================
// PARTICIPANTS
// ========================

export type ParticipantsRow = {
  userId: string;
  username: string;
  points: number | null;
  joinedAt: string;
};

export type PickemParticipantsDTO = {
  event: {
    id: number;
    name: string;
  };
  rows: ParticipantsRow[];
};

// ========================
// USER BREAKDOWN (v0.2)
// ========================

export type BreakdownItem = {
  label: string;
  predicted: string[];
  points: number;
};

export type MatchBreakdownItem = {
  match: string;
  prediction: string;
  result: string;
  points: number;
};

export type PickemUserBreakdown = {
  swiss: BreakdownItem[];
  playoffs: BreakdownItem[];
  matches: MatchBreakdownItem[];
};

// ========================
// USER DETAILS
// ========================

export type PickemUserDetailsDTO = {
  user: {
    id: string;
    username: string;
  };
  totalPoints: number;
  breakdown: PickemUserBreakdown;
};
