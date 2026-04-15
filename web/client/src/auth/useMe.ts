import { useEffect, useState } from "react";
import { apiFetch } from "../api/client";

export type Guild = {
  id: string;
  name: string;
  icon?: string | null;
  isAdmin?: boolean;
  botPresent?: boolean;
};

export type MeResponse = {
  id: string;
  username: string;
  avatar?: string | null;
  guilds: Guild[];
};

export function useMe() {
  const [data, setData] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await apiFetch<MeResponse>("/auth/me");
        setData(res);
        setAuthenticated(true);
      } catch {
        setData(null);
        setAuthenticated(false);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  return {
    data,
    loading,
    authenticated,
  };
}