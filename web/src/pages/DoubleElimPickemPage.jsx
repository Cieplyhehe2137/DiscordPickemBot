import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { getDoubleElimPickem, saveDoubleElimPickem } from "../lib/api.js";
import PhaseResults from "../components/PhaseResults.jsx";
import { useAuth } from "../auth/useAuth.js";
import BackLink from "../components/BackLink.jsx";
import PhaseFormat from "../components/PhaseFormat.jsx";

function DoubleElimPickemPage() {
  const { slug } = useParams();
  const { user, authLoading } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [upperFinalA, setUpperFinalA] = useState([]);
  const [lowerFinalA, setLowerFinalA] = useState([]);
  const [upperFinalB, setUpperFinalB] = useState([]);
  const [lowerFinalB, setLowerFinalB] = useState([]);
  // Limity slotów z konfiguracji eventu; fallback = domyślne 2 na slot.
  const limitUFA = Number(data?.limity?.upperFinalA ?? 2);
  const limitLFA = Number(data?.limity?.lowerFinalA ?? 2);
  const limitUFB = Number(data?.limity?.upperFinalB ?? 2);
  const limitLFB = Number(data?.limity?.lowerFinalB ?? 2);

  const savedUpperFinalA = data?.prediction?.upper_final_a || [];

  const savedLowerFinalA = data?.prediction?.lower_final_a || [];

  const savedUpperFinalB = data?.prediction?.upper_final_b || [];

  const savedLowerFinalB = data?.prediction?.lower_final_b || [];

  const isDirty =
    JSON.stringify(upperFinalA) !== JSON.stringify(savedUpperFinalA) ||
    JSON.stringify(lowerFinalA) !== JSON.stringify(savedLowerFinalA) ||
    JSON.stringify(upperFinalB) !== JSON.stringify(savedUpperFinalB) ||
    JSON.stringify(lowerFinalB) !== JSON.stringify(savedLowerFinalB);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  useEffect(() => {
    async function loadDoubleElimPickem() {
      try {
        setLoading(true);
        setError("");

        const response = await getDoubleElimPickem(slug);

        console.log("DOUBLE ELIM PICKEM:", response);
        setData(response);
        if (response.prediction) {
          setUpperFinalA(response.prediction.upper_final_a || []);
          setLowerFinalA(response.prediction.lower_final_a || []);
          setUpperFinalB(response.prediction.upper_final_b || []);
          setLowerFinalB(response.prediction.lower_final_b || []);
        } else {
          setUpperFinalA([]);
          setLowerFinalA([]);
          setUpperFinalB([]);
          setLowerFinalB([]);
        }
      } catch (err) {
        console.error("DOUBLE ELIM PICKEM ERROR:", err);

        setError(
          err.message || "Nie udało się pobrać Double Elimination Pick'Em.",
        );
      } finally {
        setLoading(false);
      }
    }

    loadDoubleElimPickem();
  }, [slug]);

  async function handleSave() {
    try {
      setSaving(true);
      setSaveMessage("");

      const prediction = {
        upper_final_a: upperFinalA,
        lower_final_a: lowerFinalA,
        upper_final_b: upperFinalB,
        lower_final_b: lowerFinalB,
      };

      await saveDoubleElimPickem(slug, prediction);

      setData((current) => ({
        ...current,
        prediction,
      }));

      setSaveMessage("Typy zapisane ✅");
    } catch (err) {
      console.error("DOUBLE ELIM SAVE ERROR:", err);

      setSaveMessage(err.message || "Nie udało się zapisać typów.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p>Ładowanie Double Elimination Pick'Em...</p>;
  }

  if (error) {
    return <p>{error}</p>;
  }

  return (
    <main className="doubleelim-pickem-page">
      <BackLink to={`/events/${slug}`} />
      <h1>Double Elimination Pick'Em</h1>

      <p>
        Event: <strong>{slug}</strong>
      </p>

      <PhaseFormat faza="doubleelim" limity={data?.limity} />

      {data?.lock && !data.lock.allowed && (
        <p className="doubleelim-pickem__lock-message">
          {data.lock.message || "Typowanie jest obecnie zablokowane."}
        </p>
      )}

      {!authLoading && !user && (
        <p className="doubleelim-pickem__login-message">
          Musisz się{" "}
          <a
            href={`/api/auth/discord?returnTo=${encodeURIComponent(
              window.location.pathname + window.location.search,
            )}`}
          >
            zalogować przez Discord
          </a>
          , aby zapisać typy.
        </p>
      )}

      <h2>Upper Final A</h2>

      <p>
        Wybrano: <strong>{upperFinalA.length}/{limitUFA}</strong>
      </p>

      <div className="doubleelim-pickem__teams">
        {data?.teams?.map((team) => {
          const selected = upperFinalA.includes(team.name);

          return (
            <button
              key={team.id}
              type="button"
              className={
                selected
                  ? "doubleelim-pickem__team is-selected"
                  : "doubleelim-pickem__team"
              }
              disabled={
                authLoading ||
                !user ||
                !data?.lock?.allowed ||
                (!selected && upperFinalA.length >= limitUFA)
              }
              onClick={() => {
                setUpperFinalA((current) => {
                  setSaveMessage("");
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
      <h2>Lower Final A</h2>

      <p>
        Wybrano: <strong>{lowerFinalA.length}/{limitLFA}</strong>
      </p>

      <div className="doubleelim-pickem__teams">
        {data?.teams?.map((team) => {
          const selected = lowerFinalA.includes(team.name);
          const usedElsewhere = upperFinalA.includes(team.name);

          return (
            <button
              key={team.id}
              type="button"
              className={
                selected
                  ? "doubleelim-pickem__team is-selected"
                  : "doubleelim-pickem__team"
              }
              disabled={
                authLoading ||
                !user ||
                !data?.lock?.allowed ||
                usedElsewhere ||
                (!selected && lowerFinalA.length >= limitLFA)
              }
              onClick={() => {
                setLowerFinalA((current) => {
                  setSaveMessage("");
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
      <h2>Upper Final B</h2>

      <p>
        Wybrano: <strong>{upperFinalB.length}/{limitUFB}</strong>
      </p>

      <div className="doubleelim-pickem__teams">
        {data?.teams?.map((team) => {
          const selected = upperFinalB.includes(team.name);

          const usedElsewhere =
            upperFinalA.includes(team.name) || lowerFinalA.includes(team.name);

          return (
            <button
              key={team.id}
              type="button"
              className={
                selected
                  ? "doubleelim-pickem__team is-selected"
                  : "doubleelim-pickem__team"
              }
              disabled={
                authLoading ||
                !user ||
                !data?.lock?.allowed ||
                usedElsewhere ||
                (!selected && upperFinalB.length >= limitUFB)
              }
              onClick={() => {
                setUpperFinalB((current) => {
                  setSaveMessage("");
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
      <h2>Lower Final B</h2>

      <p>
        Wybrano: <strong>{lowerFinalB.length}/{limitLFB}</strong>
      </p>

      <div className="doubleelim-pickem__teams">
        {data?.teams?.map((team) => {
          const selected = lowerFinalB.includes(team.name);

          const usedElsewhere =
            upperFinalA.includes(team.name) ||
            lowerFinalA.includes(team.name) ||
            upperFinalB.includes(team.name);

          return (
            <button
              key={team.id}
              type="button"
              className={
                selected
                  ? "doubleelim-pickem__team is-selected"
                  : "doubleelim-pickem__team"
              }
              disabled={
                authLoading ||
                !user ||
                !data?.lock?.allowed ||
                usedElsewhere ||
                (!selected && lowerFinalB.length >= limitLFB)
              }
              onClick={() => {
                setLowerFinalB((current) => {
                  setSaveMessage("");
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
        className="doubleelim-pickem__save"
        disabled={
          saving ||
          authLoading ||
          !user ||
          !data?.lock?.allowed ||
          upperFinalA.length !== limitUFA ||
          lowerFinalA.length !== limitLFA ||
          upperFinalB.length !== limitUFB ||
          lowerFinalB.length !== limitLFB ||
          !isDirty
        }
        onClick={handleSave}
      >
        {saving ? "Zapisywanie..." : "Zapisz typy"}
      </button>

      {saveMessage && (
        <p className="doubleelim-pickem__save-message">{saveMessage}</p>
      )}

      {/* Oficjalny wynik fazy + trafienia + punkty.
          Renderuje sie dopiero po opublikowaniu wyniku. */}
      <PhaseResults slug={slug} phase="doubleelim" />
    </main>
  );
}

export default DoubleElimPickemPage;
