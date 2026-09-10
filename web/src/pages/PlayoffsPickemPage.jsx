import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../auth/useAuth.js";

import { getPlayoffsPickem, savePlayoffsPickem } from "../lib/api.js";
import PhaseResults from "../components/PhaseResults.jsx";
import BackLink from "../components/BackLink.jsx";

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

        console.log("PLAYOFFS PICKEM:", response);
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

      setSaveMessage("Typy zapisane ✅");
    } catch (err) {
      console.error("PLAYOFFS SAVE ERROR:", err);

      setSaveMessage(err.message || "Nie udało się zapisać typów.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p>Ładowanie Playoffs Pick'Em...</p>;
  }

  if (error) {
    return <p>{error}</p>;
  }

  return (
    <main className="playoffs-pickem-page">
      <BackLink to={`/events/${slug}`} />
      <h1>Playoffs Pick'Em</h1>

      <p>
        Event: <strong>{slug}</strong>
      </p>

      {!authLoading && !user && (
        <a
          href={`/api/auth/discord?returnTo=${encodeURIComponent(
            window.location.pathname + window.location.search,
          )}`}
          className="playoffs-pickem__login"
        >
          Zaloguj się przez Discord, aby typować
        </a>
      )}

      {!data?.lock?.allowed && data?.lock?.message && (
        <p className="playoffs-pickem__lock-message">❌ {data.lock.message}</p>
      )}

      <h2>Semifinaliści</h2>

      <p>
        Wybrano: <strong>{semifinalists.length}/{limitPolfinal}</strong>
      </p>

      <div className="playoffs-pickem__teams">
        {data?.teams?.map((team) => {
          const selected = semifinalists.includes(team.name);

          return (
            <button
              key={team.id}
              type="button"
              className={
                selected
                  ? "playoffs-pickem__team is-selected"
                  : "playoffs-pickem__team"
              }
              disabled={
                authLoading ||
                !user ||
                !data?.lock?.allowed ||
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

      <h2>Finaliści</h2>

      <p>
        Wybrano: <strong>{finalists.length}/{limitFinal}</strong>
      </p>

      <div className="playoffs-pickem__teams">
        {semifinalists.map((teamName) => {
          const selected = finalists.includes(teamName);

          return (
            <button
              key={teamName}
              type="button"
              className={
                selected
                  ? "playoffs-pickem__team is-selected"
                  : "playoffs-pickem__team"
              }
              disabled={
                authLoading ||
                !user ||
                !data?.lock?.allowed ||
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
      <h2>Zwycięzca</h2>

      <div className="playoffs-pickem__teams">
        {finalists.map((teamName) => {
          const selected = winner === teamName;

          return (
            <button
              key={teamName}
              type="button"
              className={
                selected
                  ? "playoffs-pickem__team is-selected"
                  : "playoffs-pickem__team"
              }
              disabled={authLoading || !user || !data?.lock?.allowed}
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
      <h2>3. miejsce</h2>

      <div className="playoffs-pickem__teams">
        {semifinalists.map((teamName) => {
          const selected = thirdPlaceWinner === teamName;
          const unavailable = finalists.includes(teamName);

          return (
            <button
              key={teamName}
              type="button"
              className={
                selected
                  ? "playoffs-pickem__team is-selected"
                  : "playoffs-pickem__team"
              }
              disabled={
                authLoading || !user || !data?.lock?.allowed || unavailable
              }
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
      <button
        type="button"
        className="playoffs-pickem__save"
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

      {saveMessage && (
        <p className="playoffs-pickem__save-message">{saveMessage}</p>
      )}

      {/* Oficjalny wynik fazy + trafienia + punkty.
          Renderuje sie dopiero po opublikowaniu wyniku. */}
      <PhaseResults slug={slug} phase="playoffs" />
    </main>
  );
}

export default PlayoffsPickemPage;
