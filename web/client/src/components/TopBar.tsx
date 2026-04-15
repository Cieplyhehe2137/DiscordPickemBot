import { useEffect, useState } from "react";
import { apiFetch } from "../api/client";
import { useNavigate } from "react-router-dom";

type Me = {
  username: string;
  avatar?: string;
};

export default function TopBar() {
  const [user, setUser] = useState<Me | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    apiFetch<Me>("/auth/me").then(setUser).catch(() => {});
  }, []);

  async function logout() {
    await apiFetch("/auth/logout", {
      method: "POST",
    });

    navigate("/");
  }

  return (
    <div className="flex justify-between items-center px-6 py-4 border-b border-zinc-800 bg-black">
      <div className="font-semibold">Pick'Em panel</div>

      <div className="flex items-center gap-4">
        {user && (
          <>
            <span>{user.username}</span>

            <button
              onClick={() => navigate("/guilds")}
              className="text-sm text-zinc-400 hover:text-white"
            >
              zmień serwer
            </button>

            <button
              onClick={logout}
              className="text-sm text-red-400 hover:text-red-300"
            >
              logout
            </button>
          </>
        )}
      </div>
    </div>
  );
}