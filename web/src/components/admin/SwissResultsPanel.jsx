import { useEffect, useState } from "react";
import {
  getTeams,
  getSwissResults,
  saveSwissResults,
  describeActionError,
} from "../../lib/api";

const STAGES = [
  { value: "stage1", label: "Etap 1" },
  { value: "stage2", label: "Etap 2" },
  { value: "stage3", label: "Etap 3" },
];

const CATEGORIES = [
  { key: "x3_0", label: "3-0", cap: 2 },
  { key: "x0_3", label: "0-3", cap: 2 },
  { key: "advancing", label: "Awansujący", cap: 6 },
];

export default function SwissResultsPanel({ slug, guildId }) {
  const [teams, setTeams] = useState([]);
  const [stage, setStage] = useState("stage1");
  const [selection, setSelection] = useState({
    x3_0: [],
    x0_3: [],
    advancing: [],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    getTeams(guildId, { includeInactive: false })
      .then((result) => {
        if (!cancelled) setTeams((result.teams || []).map((t) => t.name));
      })
      .catch(() => {
        if (!cancelled) setTeams([]);
      });

    return () => {
      cancelled = true;
    };
  }, [guildId]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const data = await getSwissResults(slug, stage);

        if (!cancelled) {
          setSelection({
            x3_0: data.x3_0 || [],
            x0_3: data.x0_3 || [],
            advancing: data.advancing || [],
          });
        }
      } catch (err) {
        if (!cancelled)
          setError(describeActionError(err, "wczytać wyniki Swiss"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [slug, stage]);

  function toggleTeam(categoryKey, team) {
    setSelection((prev) => {
      const current = prev[categoryKey];
      const has = current.includes(team);
      const cap = CATEGORIES.find((c) => c.key === categoryKey).cap;

      if (!has && current.length >= cap) return prev;

      return {
        ...prev,
        [categoryKey]: has
          ? current.filter((t) => t !== team)
          : [...current, team],
      };
    });
  }

  async function handleSave() {
    setSaving(true);
    setError(null);

    try {
      await saveSwissResults(slug, stage, selection);
    } catch (err) {
      setError(
        err?.status === 400
          ? err.message
          : describeActionError(err, "zapisać wyniki Swiss"),
      );
    } finally {
      setSaving(false);
    }
  }

  const currentStageLabel =
    STAGES.find((s) => s.value === stage)?.label || stage;

  return (
    <div className="mt-10 rounded-[2rem] border border-white/10 bg-white/5 p-8">
      <p className="text-sm uppercase tracking-[0.25em] text-violet-300">
        Oficjalne wyniki fazy
      </p>

      <h2 className="mt-2 text-3xl font-black">Swiss</h2>

      <div className="mt-6 flex flex-wrap gap-2">
        {STAGES.map((s) => (
          <button
            key={s.value}
            onClick={() => setStage(s.value)}
            className={`rounded-xl px-4 py-2 text-sm font-black transition ${
              stage === s.value
                ? "bg-violet-500 text-white"
                : "border border-white/10 bg-black/30 text-white/60 hover:text-white"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="mt-6 text-white/40">Ładowanie...</p>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          {CATEGORIES.map((cat) => (
            <div key={cat.key}>
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-white/50">
                {cat.label} ({selection[cat.key].length}/{cat.cap})
              </p>

              <div className="mt-3 max-h-56 overflow-y-auto rounded-2xl border border-white/10 bg-black/30 p-3">
                {teams.length === 0 && (
                  <p className="px-2 py-1.5 text-sm text-white/30">
                    Brak aktywnych drużyn
                  </p>
                )}

                {teams.map((team) => {
                  const checked = selection[cat.key].includes(team);
                  return (
                    <label
                      key={team}
                      className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-white/70 hover:bg-white/5"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleTeam(cat.key, team)}
                        className="accent-violet-500"
                      />
                      {team}
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm font-bold text-red-300">
          {error}
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={saving || loading}
        className="mt-6 rounded-2xl bg-violet-500 px-6 py-4 font-black transition hover:bg-violet-400 disabled:opacity-50"
      >
        {saving ? "Zapisywanie..." : `Zapisz wyniki (${currentStageLabel})`}
      </button>
    </div>
  );
}
