import { useState } from "react";
import { PickemUserBreakdown } from "./types";

type Props = {
  breakdown: PickemUserBreakdown;
};

export default function UserBreakdownTabs({ breakdown }: Props) {
  const [tab, setTab] = useState<"swiss" | "playoffs" | "matches">("swiss");

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <button onClick={() => setTab("swiss")}>Swiss</button>
        <button onClick={() => setTab("playoffs")}>Playoffs</button>
        <button onClick={() => setTab("matches")}>Matches</button>
      </div>

      {tab === "swiss" && (
        <ul>
          {breakdown.swiss.map((b, i) => (
            <li key={i}>
              <strong>{b.label}</strong>: {b.predicted.join(", ")} → {b.points} pkt
            </li>
          ))}
        </ul>
      )}

      {tab === "playoffs" && (
        <ul>
          {breakdown.playoffs.map((b, i) => (
            <li key={i}>
              <strong>{b.label}</strong>: {b.predicted.join(", ")} → {b.points} pkt
            </li>
          ))}
        </ul>
      )}

      {tab === "matches" && (
        <ul>
          {breakdown.matches.map((m, i) => (
            <li key={i}>
              {m.match}: {m.prediction} vs {m.result} → {m.points} pkt
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
