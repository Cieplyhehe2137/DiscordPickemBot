type ApiOptions = RequestInit & {
  raw?: boolean;
};

const API_BASE = "/api";

export async function apiFetch<T = any>(
  url: string,
  options: ApiOptions = {}
): Promise<T> {
  const res = await fetch(API_BASE + url, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }

  if (options.raw) {
    return res as T;
  }

  return res.json();
}