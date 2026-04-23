import { Outlet } from "react-router-dom";
import { useMe } from "./useMe";

export default function RequireAuth() {
  const { loading, authenticated } = useMe();

  // console.log("RequireAuth:", { loading, authenticated });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white">
        Ładowanie...
      </div>
    );
  }

  if (!authenticated) {
    // console.log("RequireAuth -> redirect to discord");
    window.location.href = "/api/auth/discord";
    return null;
  }

  // console.log("RequireAuth -> render Outlet");
  return <Outlet />;
}