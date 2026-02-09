import { Navigate, Outlet } from "react-router-dom";

export default function RequireAuth() {
    const isLoggedIn = true; // tymczasowo

    if (!isLoggedIn) {
        return <Navigate to="/login" replace />;
    }

    return <Outlet />;
}
