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
    };
  };
  permissions: {
    isAdmin: boolean;
  };
};

export type PickemTopEntryDTO = {
  rank: number;
  userId: string;
  points: number;
};