import { useEffect, useState } from "react";
import { apiFetch } from "../api/client";

export type MeResponse = {
    user: {
        id: string;
        username: string;
        avatar?: string;
    };
    guilds: {
        id: string;
        name: string;
        icon?: string;
        isAdmin: boolean;
        botPresent: boolean;
    }[];
};

export function useMe() {
    const [data, setData] = useState<MeResponse | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        apiFetch("/me")
        .then(setData)
        .finally(() => setLoading(false));
    }, []);

    return { data, loading };
}