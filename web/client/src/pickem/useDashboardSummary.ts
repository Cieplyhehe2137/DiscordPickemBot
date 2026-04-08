import { useCallback, useEffect, useState } from "react";
import { useApi } from "../api/useApi";
import { PickemOverviewDTO } from "./types";

export function useDashboardSummary(slug: string) {
  const api = useApi();

  const [data, setData] = useState<PickemOverviewDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(
    async (background = false) => {
      try {
        if (background) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        const res = await api.get<PickemOverviewDTO>(`/dashboard/${slug}/summary`);
        setData(res);
        setError(null);
      } catch (err) {
        console.error("Dashboard summary load failed", err);
        setError("Nie udało się załadować dashboardu");
      } finally {
        if (background) {
          setRefreshing(false);
        } else {
          setLoading(false);
        }
      }
    },
    [api, slug]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    loading,
    refreshing,
    error,
    refresh: () => fetchData(true),
  };
}