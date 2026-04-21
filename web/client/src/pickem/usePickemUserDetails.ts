import { useEffect, useState } from "react";
import type { PickemUserDetailsDTO } from "./types";

export function usePickemUserDetails(slug: string, userId: string | null) {
  const [data, setData] = useState<PickemUserDetailsDTO | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug || !userId) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;

    const run = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`/api/dashboard/${slug}/users/${userId}`, {
          credentials: "include",
        });

        if (!res.ok) {
          throw new Error("Nie udało się pobrać szczegółów gracza.");
        }

        const json = await res.json();

        if (cancelled) return;
        setData(json);
      } catch (err: any) {
        if (cancelled) return;
        setError(err?.message || "Nie udało się pobrać szczegółów gracza.");
      } finally {
        if (cancelled) return;
        setLoading(false);
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [slug, userId]);

  return { data, loading, error };
}