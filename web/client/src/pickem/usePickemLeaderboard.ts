import { useEffect, useState } from "react";
import { useApi } from "../api/useApi";
import { PickemLeaderboardDTO } from "./types";

export function usePickemLeaderboard(slug: string) {
  const api = useApi();

  const [data, setData] = useState<PickemLeaderboardDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError(null);

    api.get<PickemLeaderboardDTO>(`/dashboard/${slug}/top`)
      .then((result) => {
        if (cancelled) return;
        setData(result);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.message || "Nie udało się pobrać rankingu.");
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [api, slug]);

  return { data, loading, error };
}