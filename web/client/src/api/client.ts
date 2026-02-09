type ApiOptions = RequestInit & {
    raw?: boolean;
};

const API_BASE = "/api";

export async function apiFetch(
    url: string,
    options: ApiOptions = {}
) {
    const res = await fetch(API_BASE + url, {
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {}),
        },
        ...options,
    });

    if (res.status === 401) {
        window.location.href = "/login";
        return;
    }

    if (!res.ok) {
        const text = await res.text();
        throw new Error(text || res.statusText);
    }

    if (options.raw) return res;
    return res.json();
}