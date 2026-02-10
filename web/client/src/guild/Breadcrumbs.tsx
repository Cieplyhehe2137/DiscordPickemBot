import { Link, useLocation } from "react-router-dom";
import { useGuild } from "./GuildContext";

type Crumb = {
    label: string;
    to?: string;
};

export default function Breadcrumbs() {
    const location = useLocation();
    const { guild } = useGuild();

    const path = location.pathname.split("/").filter(Boolean);

    const crumbs: Crumb[] = [
        { label: "Dashboard", to: "/dashboard" },
    ];

    if (guild) {
        crumbs.push({
            label: guild.name ?? "Serwer",
            to: `/guild/${guild.id}`,
        });
    }

    if (path.includes("pickem")) {
        crumbs.push({
            label: "Pick'Em",
            to: `/guild/${guild?.id}/pickem`,
        });
    }

    if (path.includes("leaderboard")) {
        crumbs.push({ label: "Ranking" });
    }

    if (path.includes("participants")) {
        crumbs.push({ label: "Uczestnicy" });
    }

     return (
    <nav style={{ marginBottom: 16, fontSize: 14 }}>
      {crumbs.map((c, i) => (
        <span key={i}>
          {c.to ? <Link to={c.to}>{c.label}</Link> : <span>{c.label}</span>}
          {i < crumbs.length - 1 && " / "}
        </span>
      ))}
    </nav>
  );
}