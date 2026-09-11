import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../auth/useAuth.js";

import { getPlayinPickem, savePlayinPickem } from "../lib/api.js";
import { druzyny } from "../lib/odmiana.js";
import { SAVED_MESSAGE } from "../lib/saveMessages.js";
import PhaseFormat from "../components/PhaseFormat.jsx";
import PhaseResults from "../components/PhaseResults.jsx";
import BackLink from "../components/BackLink.jsx";
import PickCounter from "../components/PickCounter.jsx";

function PlayinPickemPage() {
  const { slug } = useParams();
  const { user, authLoading } = useAuth();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedTeams, setSelectedTeams] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  // Limit z konfiguracji eventu; fallback = domyślna wartość backendu.
  const limitDruzyn = Number(data?.limity?.teams ?? 8);

  const savedTeams = data?.prediction?.teams || [];

  const isDirty = JSON.stringify(selectedTeams) !== JSON.stringify(savedTeams);

  useEffect(() => {
    async function loadPlayinPickem() {
      try {
        setLoading(true);
        setError("");

        const response = await getPlayinPickem(slug);

        setData(response);
        if (response.prediction) {
          setSelectedTeams(response.prediction.teams || []);
        } else {
          setSelectedTeams([]);
        }
      } catch (err) {
        console.error("PLAY-IN PICKEM ERROR:", err);
        setError(err.message || "Nie udało się pobrać Play-In Pick'Em.");
      } finally {
        setLoading(false);
      }
    }

    loadPlayinPickem();
  }, [slug]);

  if (loading) {
    return (
      <main className="ui-page">
        <div className="ui-stack" aria-busy="true" aria-label="Ładowanie fazy">
          <div className="ui-skeleton ui-skeleton--row" />

          <div className="ui-skeleton ui-skeleton--row" />
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="ui-page">
        <div className="ui-error" role="alert">
          <span className="ui-error__icon" aria-hidden="true">
            ⚠️
          </span>

          <strong className="ui-error__title">
            Nie udało się wczytać fazy
          </strong>

          <p className="ui-error__text">{error}</p>
        </div>
      </main>
    );
  }

  const isComplete = selectedTeams.length === limitDruzyn;

  return (
    <main className="ui-page">
      <BackLink to={`/events/${slug}`}>Wróć do eventu</BackLink>

      <div className="ui-section-head">
        <div>
          <span className="ui-kicker">Faza turnieju</span>

          <h2>Play-In Pick&apos;Em</h2>

          <p>
            Wybierz {limitDruzyn} {druzyny(limitDruzyn)} do awansu z fazy
            Play-In.
          </p>
        </div>
      </div>

      <section className="ui-card ui-stack">
        <PhaseFormat faza="playin" limity={data?.limity} />

        <PickCounter selected={selectedTeams.length} limit={limitDruzyn} />

        {!data?.lock?.allowed && data?.lock?.message && (
          <p className="ui-note ui-note--warn">🔒 {data.lock.message}</p>
        )}

        {!authLoading && !user && (
          <a
            className="ui-btn"
            href={`/api/auth/discord?returnTo=${encodeURIComponent(
              window.location.pathname + window.location.search,
            )}`}
          >
            Zaloguj się przez Discord, aby typować
          </a>
        )}

        <div className="ui-choice ui-choice--grid">
          {data?.teams?.map((team) => {
            const selected = selectedTeams.includes(team.name);

            return (
              <button
                key={team.id}
                type="button"
                className="ui-choice__option"
                aria-pressed={selected}
                disabled={
                  authLoading ||
                  !user ||
                  !data?.lock?.allowed ||
                  (!selected && isComplete)
                }
                onClick={() => {
                  setSaveMessage("");

                  setSelectedTeams((current) => {
                    if (current.includes(team.name)) {
                      return current.filter((name) => name !== team.name);
                    }

                    return [...current, team.name];
                  });
                }}
              >
                {team.name}
              </button>
            );
          })}
        </div>

        {saveMessage && (
          <p
            className={`ui-note ${
              saveMessage === SAVED_MESSAGE ? "ui-note--ok" : "ui-note--danger"
            }`}
          >
            {saveMessage}
          </p>
        )}

        <button
          type="button"
          className="ui-btn ui-btn--primary"
          disabled={
            saving ||
            authLoading ||
            !user ||
            !data?.lock?.allowed ||
            !isComplete ||
            !isDirty
          }
          onClick={async () => {
            try {
              setSaving(true);
              setSaveMessage("");

              await savePlayinPickem(slug, selectedTeams);
              setData((current) => ({
                ...current,
                prediction: {
                  teams: selectedTeams,
                },
              }));

              setSaveMessage(SAVED_MESSAGE);
            } catch (err) {
              console.error("PLAY-IN SAVE ERROR:", err);
              setSaveMessage(err.message || "Nie udało się zapisać typów.");
            } finally {
              setSaving(false);
            }
          }}
        >
          {saving ? "Zapisywanie..." : "Zapisz typy"}
        </button>
      </section>

      {/* Oficjalny wynik fazy + trafienia + punkty.
          Renderuje sie dopiero po opublikowaniu wyniku. */}
      <PhaseResults slug={slug} phase="playin" />
    </main>
  );
}

export default PlayinPickemPage;
