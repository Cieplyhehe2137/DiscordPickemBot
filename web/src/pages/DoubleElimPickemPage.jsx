import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { getDoubleElimPickem, saveDoubleElimPickem } from "../lib/api.js";
import { SAVED_MESSAGE } from "../lib/saveMessages.js";
import PhaseResults from "../components/PhaseResults.jsx";
import { useAuth } from "../auth/useAuth.js";
import BackLink from "../components/BackLink.jsx";
import PhaseFormat from "../components/PhaseFormat.jsx";
import TeamPickGroup from "../components/TeamPickGroup.jsx";

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

      setSaveMessage(SAVED_MESSAGE);
    } catch (err) {
      console.error("DOUBLE ELIM SAVE ERROR:", err);

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

  // Przełącza nazwę w liście. setSaveMessage stało wcześniej WEWNĄTRZ
  // funkcji aktualizującej stan - React może ją wywołać dwa razy, więc
  // efekt uboczny nie ma tam czego szukać.
  const toggle = (setList) => (name) => {
    setSaveMessage("");

    setList((current) =>
      current.includes(name)
        ? current.filter((item) => item !== name)
        : [...current, name],
    );
  };

  return (
    <main className="ui-page">
      <BackLink to={`/events/${slug}`} />

      <div className="ui-section-head">
        <div>
          <span className="ui-kicker">Drabinka podwójnej eliminacji</span>

          <h2>Double Elimination Pick&apos;Em</h2>

          <p>
            Wskaż uczestników czterech finałów. Drużyna użyta wcześniej nie
            wraca w kolejnych grupach.
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

      <PhaseFormat faza="doubleelim" limity={data?.limity} />

      {data?.lock && !data.lock.allowed && (
        <p className="ui-note ui-note--warn">
          🔒 {data.lock.message || "Typowanie jest obecnie zablokowane."}
        </p>
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

      <TeamPickGroup
        title="Upper Final A"
        teams={data?.teams}
        selected={upperFinalA}
        limit={limitUFA}
        disabled={pickingLocked}
        onToggle={toggle(setUpperFinalA)}
      />

      <TeamPickGroup
        title="Lower Final A"
        teams={data?.teams}
        selected={lowerFinalA}
        limit={limitLFA}
        disabled={pickingLocked}
        isBlocked={(name) => upperFinalA.includes(name)}
        onToggle={toggle(setLowerFinalA)}
      />

      <TeamPickGroup
        title="Upper Final B"
        teams={data?.teams}
        selected={upperFinalB}
        limit={limitUFB}
        disabled={pickingLocked}
        isBlocked={(name) =>
          upperFinalA.includes(name) || lowerFinalA.includes(name)
        }
        onToggle={toggle(setUpperFinalB)}
      />

      <TeamPickGroup
        title="Lower Final B"
        teams={data?.teams}
        selected={lowerFinalB}
        limit={limitLFB}
        disabled={pickingLocked}
        isBlocked={(name) =>
          upperFinalA.includes(name) ||
          lowerFinalA.includes(name) ||
          upperFinalB.includes(name)
        }
        onToggle={toggle(setLowerFinalB)}
      />

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

      {/* Oficjalny wynik fazy + trafienia + punkty.
          Renderuje sie dopiero po opublikowaniu wyniku. */}
      <PhaseResults slug={slug} phase="doubleelim" />
    </main>
  );
}

export default DoubleElimPickemPage;
