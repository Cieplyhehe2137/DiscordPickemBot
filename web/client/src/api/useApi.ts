import { useMemo } from "react";
import { useGuild } from "../guild/GuildContext";
import { apiFetch } from "./client";

export function useApi() {
  const { guildId } = useGuild();

  return useMemo(() => {
    if (!guildId) {
      return {
        get: async () => {
          throw new Error("No guild selected");
        },
        post: async () => {
          throw new Error("No guild selected");
        },
        getRaw: async () => {
          throw new Error("No guild selected");
        },
      };
    }

    function get<T = any>(url: string): Promise<T> {
      return apiFetch(`/guilds/${guildId}${url}`);
    }

    function post<T = any>(url: string, body?: any): Promise<T> {
      return apiFetch(`/guilds/${guildId}${url}`, {
        method: "POST",
        body: body ? JSON.stringify(body) : undefined,
      });
    }

    function getRaw(url: string): Promise<Response> {
      return fetch(`/api/guilds/${guildId}${url}`, {
        credentials: "include",
      });
    }

    return { get, post, getRaw };
  }, [guildId]);
}