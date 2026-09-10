import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../auth/useAuth.js";

import { getPlayinPickem, savePlayinPickem } from "../lib/api.js";
import { druzyny } from "../lib/odmiana.js";
import PhaseFormat from "../components/PhaseFormat.jsx";
import PhaseResults from "../components/PhaseResults.jsx";
import Ladowanie from "../components/Ladowanie.jsx";

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
    return <Ladowanie>Ładowanie Play-In Pick'Em...</Ladowanie>;
  }

  if (error) {
    return <p>{error}</p>;
  }

  return (
    <main className="playin-pickem-page">
      <Link to={`/events/${slug}`}>← Wróć do eventu</Link>
      <h1>Play-In Pick'Em</h1>

      <p className="playin-pickem__description">
        Wybierz {limitDruzyn} {druzyny(limitDruzyn)} do awansu z fazy Play-In.
      </p>

      <p>
        Event: <strong>{slug}</strong>
      </p>

      <PhaseFormat faza="playin" limity={data?.limity} />
      <p className="playin-pickem__counter">
        Wybrano: <strong>{selectedTeams.length}/{limitDruzyn}</strong>
      </p>
      {!data?.lock?.allowed && data?.lock?.message && (
        <p className="playin-pickem__lock-message">❌ {data.lock.message}</p>
      )}

      {!authLoading && !user && (
        <a
          href={`/api/auth/discord?returnTo=${encodeURIComponent(
            window.location.pathname + window.location.search,
          )}`}
          className="playin-pickem__login"
        >
          Zaloguj się przez Discord, aby typować
        </a>
      )}

      <div className="playin-pickem__teams">
        {data?.teams?.map((team) => {
          const selected = selectedTeams.includes(team.name);

          return (
            <button
              key={team.id}
              type="button"
              className={
                selected
                  ? "playin-pickem__team is-selected"
                  : "playin-pickem__team"
              }
              disabled={
                authLoading ||
                !user ||
                !data?.lock?.allowed ||
                (!selected && selectedTeams.length >= limitDruzyn)
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
      <button
        type="button"
        className="playin-pickem__save"
        disabled={
          saving ||
          authLoading ||
          !user ||
          !data?.lock?.allowed ||
          selectedTeams.length !== limitDruzyn ||
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

            setSaveMessage("Typy zapisane ✅");
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

      {saveMessage && (
        <p className="playin-pickem__save-message">{saveMessage}</p>
      )}

      {/* Oficjalny wynik fazy + trafienia + punkty.
          Renderuje sie dopiero po opublikowaniu wyniku. */}
      <PhaseResults slug={slug} phase="playin" />
    </main>
  );
}

export default PlayinPickemPage;
