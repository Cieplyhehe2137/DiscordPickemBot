export type GuildRole = "admin" | "viewer";

export type GuildMeta = {
    id: string;
    name: string;
    icon?: string;
    role: GuildRole;
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
}