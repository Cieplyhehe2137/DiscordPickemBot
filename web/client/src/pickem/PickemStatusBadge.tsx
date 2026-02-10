import { PickemStatus } from "./types";

const styles: Record<PickemStatus, React.CSSProperties> = {
  open: { color: "#2ecc71" },
  locked: { color: "#e67e22" },
  scoring: { color: "#f1c40f" },
  scored: { color: "#3498db" },
};

const labels: Record<PickemStatus, string> = {
  open: "🟢 Typowanie otwarte",
  locked: "🔒 Typowanie zamknięte",
  scoring: "⏳ Liczenie punktów…",
  scored: "🧮 Punkty policzone",
};

export default function PickemStatusBadge({ status }: { status: PickemStatus }) {
  return (
    <strong style={styles[status]}>
      {labels[status]}
    </strong>
  );
}
