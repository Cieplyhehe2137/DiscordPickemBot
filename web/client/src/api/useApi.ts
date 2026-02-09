import { useGuild } from "../guild/GuildContext";
import { apiFetch } from "./client";

export function useApi() {
    const { guildId } = useGuild();

    if (!guildId) {
        throw new Error("useApi called without guildId");
    }

    function get(url: string){
        return apiFetch(`/guilds/${guildId}${url}`);
    }

    function post(url: string, body?: any) {
        return apiFetch(`/guilds/${guildId}${url}`, {
            method: "POST",
            body: body ? JSON.stringify(body) : undefined,
        });
    }

    function del(url: string) {
        return apiFetch(`/guilds/${guildId}${url}`, {
            method: "DELETE",
        });
    }

    return { get, post, del };
}