export default function TeamLogoBlock({ team }) {
  return (
    <div className="min-w-0 text-center">
      <div
        className={`relative mx-auto flex h-28 w-28 items-center justify-center overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br ${getTeamColor(team)} text-3xl font-black`}
      >
        <span className="relative z-0">{team?.charAt(0)}</span>

        <img
          src={getTeamLogo(team)}
          alt={team}
          className="absolute z-10 h-20 w-20 object-contain"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      </div>

      <h2 className="mt-4 break-words text-xl font-black md:text-2xl">
        {team}
      </h2>
    </div>
  );
}

export function MiniTeamLogo({ team }) {
  return (
    <div
      className={`relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br ${getTeamColor(team)} text-sm font-black`}
    >
      <span className="relative z-0">{team?.charAt(0)}</span>

      <img
        src={getTeamLogo(team)}
        alt={team}
        className="absolute z-10 h-7 w-7 object-contain"
        onError={(e) => {
          e.currentTarget.style.display = "none";
        }}
      />
    </div>
  );
}

// Bez `export`: obie funkcje używa wyłącznie ten plik, a eksportowanie
// czegokolwiek poza komponentami wyłącza tu fast refresh.
function getTeamLogo(teamName) {
  if (!teamName) return null;

  return `/team-logos/${teamName
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")}.png`;
}

function getTeamColor(teamName) {
  if (!teamName) {
    return "from-violet-500/20 to-fuchsia-500/20";
  }

  const colors = [
    "from-red-500/20 to-orange-500/20",
    "from-blue-500/20 to-cyan-500/20",
    "from-green-500/20 to-emerald-500/20",
    "from-violet-500/20 to-fuchsia-500/20",
    "from-yellow-500/20 to-orange-500/20",
    "from-pink-500/20 to-rose-500/20",
  ];

  const hash = teamName
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);

  return colors[hash % colors.length];
}
