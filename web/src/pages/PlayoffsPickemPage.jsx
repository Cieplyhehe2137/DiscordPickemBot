import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../auth/useAuth.js";

import { getPlayoffsPickem, savePlayoffsPickem } from "../lib/api.js";
import { SAVED_MESSAGE } from "../lib/saveMessages.js";
import PhaseResults from "../components/PhaseResults.jsx";
import BackLink from "../components/BackLink.jsx";
import PhaseFormat from "../components/PhaseFormat.jsx";
import PickCounter from "../components/PickCounter.jsx";

function PlayoffsPickemPage() {
  const { slug } = useParams();
  const { user, authLoading } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [semifinalists, setSemifinalists] = useState([]);
  const [finalists, setFinalists] = useState([]);
  const [winner, setWinner] = useState(null);
  const [thirdPlaceWinner, setThirdPlaceWinner] = useState(null);
  // Limity z konfiguracji eventu; fallback = domyślne wartości backendu.
  const limitPolfinal = Number(data?.limity?.semifinalists ?? 4);
  const limitFinal = Number(data?.limity?.finalists ?? 2);

  const savedSemifinalists = data?.prediction?.semifinalists || [];

  const savedFinalists = data?.prediction?.finalists || [];

  const savedWinner = data?.prediction?.winner || null;

  const savedThirdPlaceWinner = data?.prediction?.third_place_winner || null;

  const isDirty =
    JSON.stringify(semifinalists) !== JSON.stringify(savedSemifinalists) ||
    JSON.stringify(finalists) !== JSON.stringify(savedFinalists) ||
    winner !== savedWinner ||
    thirdPlaceWinner !== savedThirdPlaceWinner;
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  useEffect(() => {
    async function loadPlayoffsPickem() {
      try {
        setLoading(true);
        setError("");

        const response = await getPlayoffsPickem(slug);

        setData(response);
        if (response.prediction) {
          setSemifinalists(response.prediction.semifinalists || []);
          setFinalists(response.prediction.finalists || []);
          setWinner(response.prediction.winner || null);
          setThirdPlaceWinner(response.prediction.third_place_winner || null);
        } else {
          setSemifinalists([]);
          setFinalists([]);
          setWinner(null);
          setThirdPlaceWinner(null);
        }
      } catch (err) {
        console.error("PLAYOFFS PICKEM ERROR:", err);
        setError(err.message || "Nie udało się pobrać Playoffs Pick'Em.");
      } finally {
        setLoading(false);
      }
    }

    loadPlayoffsPickem();
  }, [slug]);

  async function handleSave() {
    try {
      setSaving(true);
      setSaveMessage("");

      const prediction = {
        semifinalists,
        finalists,
        winner,
        third_place_winner: thirdPlaceWinner,
      };

      await savePlayoffsPickem(slug, prediction);

      setData((current) => ({
        ...current,
        prediction,
      }));

      setSaveMessage(SAVED_MESSAGE);
    } catch (err) {
      console.error("PLAYOFFS SAVE ERROR:", err);

      setSaveMessage(err.message || "Nie udało się zapisać typów.");
    } finally {
      setSaving(false);
    }
  }

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

  const pickingLocked = authLoading || !user || !data?.lock?.allowed;

  return (
    <main className="ui-page">
      <BackLink to={`/events/${slug}`} />

      <div className="ui-section-head">
        <div>
          <span className="ui-kicker">Faza pucharowa</span>

          <h2>Playoffs Pick&apos;Em</h2>

          <p>
            Typuj drabinkę po kolei: półfinalistów, finalistów, mistrza i
            trzecie miejsce. Każdy krok zawęża wybór w następnym.
          </p>
        </div>

        {!user ? (
          <span className="ui-badge ui-badge--warn">Wymaga logowania</span>
        ) : data?.lock?.allowed ? (
          <span className="ui-badge ui-badge--ok">Typowanie otwarte</span>
        ) : (
          <span className="ui-badge ui-badge--warn">Typowanie zamknięte</span>
        )}
      </div>

      <PhaseFormat faza="playoffs" limity={data?.limity} />

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

      <section className="ui-card ui-stack">
        <div className="ui-section-head">
          <div>
            <span className="ui-kicker">Krok 1</span>

            <h3>Półfinaliści</h3>
          </div>
        </div>

        <PickCounter selected={semifinalists.length} limit={limitPolfinal} />

        <div className="ui-choice ui-choice--grid">
          {data?.teams?.map((team) => {
            const selected = semifinalists.includes(team.name);

            return (
              <button
                key={team.id}
                type="button"
                className="ui-choice__option"
                aria-pressed={selected}
                disabled={
                  pickingLocked ||
                  (!selected && semifinalists.length >= limitPolfinal)
                }
                onClick={() => {
                  setSaveMessage("");
                  if (selected) {
                    setSemifinalists((current) =>
                      current.filter((name) => name !== team.name),
                    );

                    setFinalists((current) =>
                      current.filter((name) => name !== team.name),
                    );

                    if (winner === team.name) {
                      setWinner(null);
                    }

                    if (thirdPlaceWinner === team.name) {
                      setThirdPlaceWinner(null);
                    }

                    return;
                  }

                  setSemifinalists((current) => [...current, team.name]);
                }}
              >
                {team.name}
              </button>
            );
          })}
        </div>
      </section>

      <section className="ui-card ui-stack">
        <div className="ui-section-head">
          <div>
            <span className="ui-kicker">Krok 2</span>

            <h3>Finaliści</h3>
          </div>
        </div>

        {semifinalists.length === 0 ? (
          <p className="ui-note">Najpierw wybierz półfinalistów.</p>
        ) : (
          <>
            <PickCounter selected={finalists.length} limit={limitFinal} />

            <div className="ui-choice ui-choice--grid">
              {semifinalists.map((teamName) => {
                const selected = finalists.includes(teamName);

                return (
                  <button
                    key={teamName}
                    type="button"
                    className="ui-choice__option"
                    aria-pressed={selected}
                    disabled={
                      pickingLocked ||
                      (!selected && finalists.length >= limitFinal)
                    }
                    onClick={() => {
                      setSaveMessage("");
                      if (selected) {
                        setFinalists((current) =>
                          current.filter((name) => name !== teamName),
                        );

                        if (winner === teamName) {
                          setWinner(null);
                        }

                        return;
                      }

                      if (thirdPlaceWinner === teamName) {
                        setThirdPlaceWinner(null);
                      }

                      setFinalists((current) => [...current, teamName]);
                    }}
                  >
                    {teamName}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </section>

      <section className="ui-card ui-stack">
        <div className="ui-section-head">
          <div>
            <span className="ui-kicker">Krok 3</span>

            <h3>Zwycięzca</h3>
          </div>

          {winner && (
            <span className="ui-badge ui-badge--accent">🏆 {winner}</span>
          )}
        </div>

        {finalists.length === 0 ? (
          <p className="ui-note">Najpierw wybierz finalistów.</p>
        ) : (
          <div className="ui-choice ui-choice--grid">
            {finalists.map((teamName) => {
              const selected = winner === teamName;

              return (
                <button
                  key={teamName}
                  type="button"
                  className="ui-choice__option"
                  aria-pressed={selected}
                  disabled={pickingLocked}
                  onClick={() => {
                    setSaveMessage("");
                    setWinner(selected ? null : teamName);
                  }}
                >
                  {teamName}
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section className="ui-card ui-stack">
        <div className="ui-section-head">
          <div>
            <span className="ui-kicker">Krok 4</span>

            <h3>3. miejsce</h3>
          </div>

          {thirdPlaceWinner && (
            <span className="ui-badge">🥉 {thirdPlaceWinner}</span>
          )}
        </div>

        {semifinalists.length === 0 ? (
          <p className="ui-note">Najpierw wybierz półfinalistów.</p>
        ) : (
          <div className="ui-choice ui-choice--grid">
            {semifinalists.map((teamName) => {
              const selected = thirdPlaceWinner === teamName;
              const unavailable = finalists.includes(teamName);

              return (
                <button
                  key={teamName}
                  type="button"
                  className="ui-choice__option"
                  aria-pressed={selected}
                  disabled={pickingLocked || unavailable}
                  onClick={() => {
                    setSaveMessage("");
                    setThirdPlaceWinner(selected ? null : teamName);
                  }}
                >
                  {teamName}
                </button>
              );
            })}
          </div>
        )}
      </section>

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
          semifinalists.length !== limitPolfinal ||
          finalists.length !== limitFinal ||
          !winner ||
          !isDirty
        }
        onClick={handleSave}
      >
        {saving ? "Zapisywanie..." : "Zapisz typy"}
      </button>

      {/* Oficjalny wynik fazy + trafienia + punkty.
          Renderuje sie dopiero po opublikowaniu wyniku. */}
      <PhaseResults slug={slug} phase="playoffs" />
    </main>
  );
}

export default PlayoffsPickemPage;
