import { Outlet } from "react-router-dom";
import GuildSidebar from "./GuildSidebar";
import Breadcrumbs from "./Breadcrumbs";

export default function GuildLayout() {
    return (
        <div style={{ display: "flex", minHeight: "100vh" }}>
            <GuildSidebar />
            <main style={{ flex: 1, padding: 24 }}>
                <Breadcrumbs />
                <Outlet />
            </main>
        </div>
    );
}