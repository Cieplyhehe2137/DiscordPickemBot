import { useEffect, useState, useCallback } from "react";
import { useApi } from "../api/useApi";
import { PickemOverviewDTO } from "./types";

export function usePickemOverview() {
  const api = useApi();
  const [data, setData] = useState<PickemOverviewDTO | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<PickemOverviewDTO>("/pickem/overview");
      setData(res);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const status = data?.tournament?.status?.toLowerCase();
    if (status !== "scoring") return;

    const interval = setInterval(() => {
      fetchData();
    }, 3000);

    return () => clearInterval(interval);
  }, [data?.tournament?.status, fetchData]);

  return {
    data,
    loading,
    refetch: fetchData,
  };
}