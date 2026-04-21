import { useCallback, useEffect, useState } from "react";
import { useApi } from "../api/useApi";
import { PickemLeaderboardDTO } from "./types";

export function useDashboardTop(slug: string) {
  const api = useApi();

  const [data, setData] = useState<PickemLeaderboardDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get<PickemLeaderboardDTO>(`/dashboard/${slug}/top`);
      setData(res);
      setError(null);
    } catch (err) {
      console.error("Dashboard top load failed", err);
      setError("Nie udało się załadować topki");
    } finally {
      setLoading(false);
    }
  }, [api, slug]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    refresh: fetchData,
  };
}