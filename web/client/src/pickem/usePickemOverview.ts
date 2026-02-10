import { useCallback, useEffect, useState } from "react";
import { useApi } from "../api/useApi";
import { PickemOverviewDTO } from "./types";

export function usePickemOverview() {
    const api = useApi();
    const [data, setData] = useState<PickemOverviewDTO | null>(null);
    const [loading, setLoading] = useState(true);

   const fetchData = useCallback(async () => {
    setLoading(true);
    try {
        const res = await api.get("/pickem/overview");
        setData(res);
    } finally {
        setLoading(false);
    }
   }, []);

   useEffect(() => {
    fetchData();
   }, [fetchData]);

   return { data, loading, refetch: fetchData };
}

