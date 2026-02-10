import { useEffect, useState } from "react";
import { PickemOverviewDTO } from "../pickem/types";
import { useParams } from "react-router-dom";
import { usePublicApi } from "./usePublicApi";

export function usePublicPickemOverview() {
  const { guildSlug } = useParams();
  const api = usePublicApi(guildSlug!);

  const [data, setData] = useState<PickemOverviewDTO | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<PickemOverviewDTO>("/pickem/overview")
      .then(setData)
      .finally(() => setLoading(false));
  }, [guildSlug]);

  return { data, loading };
}
