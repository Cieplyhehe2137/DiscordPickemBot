import { usePublicPickemLeaderboard } from "./usePublicPickemLeaderboard";

export default function PublicPickemLeaderboard() {
  const mockData = [
    { place: 1, name: "Lemonziiko", points: 128 },
    { place: 2, name: "T1mero", points: 121 },
    { place: 3, name: "Geeciu", points: 115 },
    { place: 4, name: "Kamil", points: 102 },
    { place: 5, name: "Mati", points: 97 },
    { place: 6, name: "Bartek", points: 90 },
    { place: 7, name: "Oskar", points: 84 },
    { place: 8, name: "Karol", points: 79 },
    { place: 9, name: "Patryk", points: 74 },
    { place: 10, name: "Dominik", points: 70 },
  ];

  const topThree = mockData.slice(0, 3);
  const rest = mockData.slice(3);

  return (
    <>
      <h1 style={{ fontSize: 36, marginBottom: 40 }}>
        🏆 Ranking Pick’Em
      </h1>

      {/* PODIUM */}
      <div style={{
        display: "flex",
        gap: 20,
        marginBottom: 50,
        flexWrap: "wrap"
      }}>
        {topThree.map((player) => (
          <div
            key={player.place}
            style={{
              flex: 1,
              minWidth: 200,
              padding: 30,
              borderRadius: 16,
              background:
                player.place === 1
                  ? "linear-gradient(135deg,#ffd700,#ffb700)"
                  : player.place === 2
                  ? "linear-gradient(135deg,#c0c0c0,#9e9e9e)"
                  : "linear-gradient(135deg,#cd7f32,#a45a1c)",
              color: "#111",
              textAlign: "center",
              boxShadow: "0 10px 30px rgba(0,0,0,0.4)"
            }}
          >
            <div style={{ fontSize: 24, fontWeight: 700 }}>
              #{player.place}
            </div>
            <div style={{ fontSize: 20, marginTop: 10 }}>
              {player.name}
            </div>
            <div style={{ marginTop: 10, fontWeight: 700 }}>
              {player.points} pkt
            </div>
          </div>
        ))}
      </div>

      {/* RESZTA TABELI */}
      <div style={{ borderRadius: 12, overflow: "hidden" }}>
        {rest.map((player) => (
          <div
            key={player.place}
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "14px 20px",
              background: "rgba(255,255,255,0.03)",
              borderBottom: "1px solid rgba(255,255,255,0.05)",
            }}
          >
            <div style={{ width: 60, fontWeight: 700 }}>
              #{player.place}
            </div>
            <div style={{ flex: 1 }}>{player.name}</div>
            <div style={{ fontWeight: 700 }}>{player.points} pkt</div>
          </div>
        ))}
      </div>
    </>
  );
}
