import { useGuild } from "../guild/GuildContext";
import { apiFetch } from "./client";

export function useApi() {
  const { guildId } = useGuild();

  if (!guildId) {
    throw new Error("useApi called without guildId");
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
    return apiFetch(`/guilds/${guildId}${url}`, { raw: true });
  }

  return { get, post, getRaw };
}
