import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../auth/useAuth.js";

import { getPlayoffsPickem, savePlayoffsPickem } from "../lib/api.js";
import { translateApiMessage } from "../lib/apiMessages.js";
import { useT } from "../i18n/useLanguage.js";
import { useToast } from "../components/ui/useToast.js";
import PhaseResults from "../components/PhaseResults.jsx";
import BackLink from "../components/BackLink.jsx";
import PhaseFormat from "../components/PhaseFormat.jsx";
import PickCounter from "../components/PickCounter.jsx";
import { apiUrl } from "../lib/apiUrl.js";

function PlayoffsPickemPage() {
  const t = useT();

  const { slug } = useParams();
  const { user, authLoading } = useAuth();
  const toast = useToast();
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
  // Tylko błędy - potwierdzenie zapisu idzie powiadomieniem, żeby dało się
  // je zobaczyć także wtedy, gdy przycisk stoi na dole długiej listy.
  const [saveError, setSaveError] = useState("");

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
        setError(err.message || t("pickem.playoffs.loadError"));
      } finally {
        setLoading(false);
      }
    }

    loadPlayoffsPickem();
  }, [slug, t]);

  async function handleSave() {
    try {
      setSaving(true);
      setSaveError("");

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

      toast.success(t("pickem.saved"));
    } catch (err) {
      console.error("PLAYOFFS SAVE ERROR:", err);

      setSaveError(err.message || t("pickem.saveError"));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="ui-page">
        <div
          className="ui-stack"
          aria-busy="true"
          aria-label={t("pickem.loading")}
        >
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

          <strong className="ui-error__title">{t("pickem.loadError")}</strong>

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
          <span className="ui-kicker">{t("pickem.playoffs.kicker")}</span>

          <h2>Playoffs Pick&apos;Em</h2>

          <p>{t("pickem.playoffs.intro")}</p>
        </div>

        {!user ? (
          <span className="ui-badge ui-badge--warn">
            {t("pickem.loginRequired")}
          </span>
        ) : data?.lock?.allowed ? (
          <span className="ui-badge ui-badge--ok">{t("matchState.open")}</span>
        ) : (
          <span className="ui-badge ui-badge--warn">
            {t("matchState.locked")}
          </span>
        )}
      </div>

      <PhaseFormat faza="playoffs" limity={data?.limity} />

      {!data?.lock?.allowed && data?.lock?.message && (
        <p className="ui-note ui-note--warn">
          🔒 {translateApiMessage(data.lock.code, data.lock.message)}
        </p>
      )}

      {!authLoading && !user && (
        <a
          className="ui-btn"
          href={apiUrl(
            `/api/auth/discord?returnTo=${encodeURIComponent(
              window.location.pathname + window.location.search,
            )}`,
          )}
        >
          Zaloguj się przez Discord, aby typować
        </a>
      )}

      <section className="ui-card ui-stack">
        <div className="ui-section-head">
          <div>
            <span className="ui-kicker">{t("pickem.step", { no: 1 })}</span>

            <h3>{t("phaseResults.semifinalists")}</h3>
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
                  setSaveError("");
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
            <span className="ui-kicker">{t("pickem.step", { no: 2 })}</span>

            <h3>{t("phaseResults.finalists")}</h3>
          </div>
        </div>

        {semifinalists.length === 0 ? (
          <p className="ui-note">{t("pickem.playoffs.needSemis")}</p>
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
                      setSaveError("");
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
            <span className="ui-kicker">{t("pickem.step", { no: 3 })}</span>

            <h3>{t("phaseResults.winner")}</h3>
          </div>

          {winner && (
            <span className="ui-badge ui-badge--accent">🏆 {winner}</span>
          )}
        </div>

        {finalists.length === 0 ? (
          <p className="ui-note">{t("pickem.playoffs.needFinalists")}</p>
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
                    setSaveError("");
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
            <span className="ui-kicker">{t("pickem.step", { no: 4 })}</span>

            <h3>{t("phaseResults.thirdPlace")}</h3>
          </div>

          {thirdPlaceWinner && (
            <span className="ui-badge">🥉 {thirdPlaceWinner}</span>
          )}
        </div>

        {semifinalists.length === 0 ? (
          <p className="ui-note">{t("pickem.playoffs.needSemis")}</p>
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
                    setSaveError("");
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

      {saveError && <p className="ui-note ui-note--danger">{saveError}</p>}

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
