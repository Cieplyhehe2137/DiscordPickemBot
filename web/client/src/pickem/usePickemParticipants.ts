import { use, useEffect, useState } from "react";
import { useApi } from "../api/useApi";
import { PickemParticipantsDTO } from "./types";

export function usePickemParticipants() {
    const api = useApi();
    const [data, setData] = useState<PickemParticipantsDTO | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get<PickemParticipantsDTO>("/pickem/participants")
            .then(setData)
            .finally(() => setLoading(false))
    }, []);

    return { data, loading };
}