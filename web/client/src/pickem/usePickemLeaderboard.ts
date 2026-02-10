import { useEffect, useState } from "react";
import { useApi } from "../api/useApi";
import { PickemLeaderboardDTO } from "./types";

export function usePickemLeaderboard() {
    const api = useApi();
    const [data, setData] = useState<PickemLeaderboardDTO | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get<PickemLeaderboardDTO>("/pickem/leaderboard")
            .then(setData)
            .finally(() => setLoading(false));
    }, []);

    return { data, loading };
}