// src/public/usePublicPickemLeaderboard.ts
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { PickemLeaderboardDTO } from "../pickem/types";
import { usePublicApi } from "./usePublicApi";

export function usePublicPickemLeaderboard() {
  const { guildSlug } = useParams();
  const api = usePublicApi(guildSlug!);

  const [data, setData] = useState<PickemLeaderboardDTO | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<PickemLeaderboardDTO>("/pickem/leaderboard")
      .then(setData)
      .finally(() => setLoading(false));
  }, [guildSlug]);

  return { data, loading };
}
