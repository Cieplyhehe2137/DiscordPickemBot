import { Outlet } from "react-router-dom";
import TopBar from "../components/TopBar";

export default function GuildLayout() {
  return (
    <div className="min-h-screen bg-black text-white">
      <TopBar />
      <main className="p-6">
        <Outlet />
      </main>
    </div>
  );
}