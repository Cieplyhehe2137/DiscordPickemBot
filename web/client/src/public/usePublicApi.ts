export function usePublicApi(guildSlug: string) {
    const base = `/api/public/${guildSlug}`;

    function get<T>(url: string): Promise<T> {
        return fetch(`${base}${url}`).then(res => {
            if (!res.ok) throw new Error("Publicc API Error");
            return res.json();
        });
    }

    return { get };
}