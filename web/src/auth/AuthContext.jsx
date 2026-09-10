import { useEffect, useState } from "react";

import { getCurrentUser, logout as logoutRequest } from "../lib/api.js";
import { AuthContext } from "./authContext.js";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      try {
        const data = await getCurrentUser();

        setUser(data.user ?? null);
      } catch {
        setUser(null);
      } finally {
        setAuthLoading(false);
      }
    }

    loadUser();
  }, []);

  async function logout() {
    await logoutRequest();
    setUser(null);
  }

  const value = {
    user,
    authLoading,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
