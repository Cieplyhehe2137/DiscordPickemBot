export type PickemStatus = "open" | "locked" | "scored";

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
}

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

export type UserPickRow = {
  stage: string;
  label: string;
  points: number;
};

export type PickemUserDetailsDTO = {
  user: {
    id: string;
    username: string;
  };
  totalPoints: number;
  picks: UserPickRow[];
};
