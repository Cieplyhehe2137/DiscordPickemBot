import { Outlet } from "react-router-dom";
import { useMe } from "./useMe";

export default function RequireAuth() {
  const { loading, authenticated } = useMe();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white">
        Ładowanie...
      </div>
    );
  }

  if (!authenticated) {
    window.location.href = "/api/auth/discord";
    return null;
  }

  return <Outlet />;
}