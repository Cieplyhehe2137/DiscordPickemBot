import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";
import { PublicAuthContext } from "./PublicAuthContext";

export function PublicAuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadMe() {
      try {
        const data = await apiFetch("/auth/me");

        setUser(data?.user || null);
      } catch (err) {
        console.error(err);
        setUser(null);
      } finally {
        setLoading(false);
      }
    }

    loadMe();
  }, []);

  return (
    <PublicAuthContext.Provider
      value={{
        user,
        loading,
        isLoggedIn: !!user,
      }}
    >
      {children}
    </PublicAuthContext.Provider>
  );
}
