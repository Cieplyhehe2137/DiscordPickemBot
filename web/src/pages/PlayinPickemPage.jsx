import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../auth/useAuth.js";

import { getPlayinPickem, savePlayinPickem } from "../lib/api.js";
import { translateApiMessage } from "../lib/apiMessages.js";
import { useT } from "../i18n/useLanguage.js";
import { useToast } from "../components/ui/useToast.js";
import PhaseFormat from "../components/PhaseFormat.jsx";
import PhaseResults from "../components/PhaseResults.jsx";
import BackLink from "../components/BackLink.jsx";
import PickCounter from "../components/PickCounter.jsx";
import DeadlineNotice from "../components/DeadlineNotice.jsx";
import { apiUrl } from "../lib/apiUrl.js";

function PlayinPickemPage() {
  const t = useT();

  const { slug } = useParams();
  const { user, authLoading } = useAuth();
  const toast = useToast();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedTeams, setSelectedTeams] = useState([]);
  const [saving, setSaving] = useState(false);
  // Tylko błędy - potwierdzenie zapisu idzie powiadomieniem, żeby dało się
  // je zobaczyć także wtedy, gdy przycisk stoi na dole długiej listy.
  const [saveError, setSaveError] = useState("");
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
        setError(err.message || t("pickem.playin.loadError"));
      } finally {
        setLoading(false);
      }
    }

    loadPlayinPickem();
  }, [slug, t]);

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

  const isComplete = selectedTeams.length === limitDruzyn;

  return (
    <main className="ui-page">
      <BackLink to={`/events/${slug}`} />

      <div className="ui-section-head">
        <div>
          <span className="ui-kicker">{t("pickem.playin.kicker")}</span>

          <h2>Play-In Pick&apos;Em</h2>

          <p>{t("pickem.playin.pick", { count: limitDruzyn })} Play-In.</p>
        </div>
      </div>

      <section className="ui-card ui-stack">
        <PhaseFormat faza="playin" limity={data?.limity} />

        <PickCounter selected={selectedTeams.length} limit={limitDruzyn} />

        {/* Do kiedy mozna typowac. Nad komunikatem blokady, bo przy
            otwartym typowaniu tamtego nie ma wcale - a wlasnie wtedy
            termin jest najbardziej potrzebny. */}
        <DeadlineNotice deadline={data?.lock?.deadline} />

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
            {t("pickem.loginCta")}
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
                  setSaveError("");

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

        {saveError && <p className="ui-note ui-note--danger">{saveError}</p>}

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
              setSaveError("");

              await savePlayinPickem(slug, selectedTeams);
              setData((current) => ({
                ...current,
                prediction: {
                  teams: selectedTeams,
                },
              }));

              toast.success(t("pickem.saved"));
            } catch (err) {
              console.error("PLAY-IN SAVE ERROR:", err);
              setSaveError(err.message || t("pickem.saveError"));
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
