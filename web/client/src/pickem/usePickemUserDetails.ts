import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useApi } from "../api/useApi";
import { PickemUserDetailsDTO } from "./types";

export function usePickemUserDetails() {
  const { userId } = useParams();
  const api = useApi();

  const [data, setData] = useState<PickemUserDetailsDTO | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    api.get<PickemUserDetailsDTO>(`/pickem/users/${userId}`)
      .then(setData)
      .finally(() => setLoading(false));
  }, [userId]);

  return { data, loading };
}
