import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { getSwissPickem, saveSwissPickem } from "../lib/api.js";
import { druzyny } from "../lib/odmiana.js";
import { SAVED_MESSAGE } from "../lib/saveMessages.js";
import PhaseResults from "../components/PhaseResults.jsx";

import { useAuth } from "../auth/useAuth.js";
import BackLink from "../components/BackLink.jsx";
import PhaseFormat from "../components/PhaseFormat.jsx";
import TeamPickGroup from "../components/TeamPickGroup.jsx";

function SwissPickemPage() {
  const { slug, stage } = useParams();
  const { user, authLoading } = useAuth();
  const stageLabel =
    {
      stage1: "Stage 1",
      stage2: "Stage 2",
      stage3: "Stage 3",
    }[stage] || stage;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [threeZero, setThreeZero] = useState([]);
  const [zeroThree, setZeroThree] = useState([]);
  const [advancing, setAdvancing] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  useEffect(() => {
    async function loadSwissPickem() {
      try {
        setLoading(true);
        setError("");

        const response = await getSwissPickem(slug, stage);

        setData(response);
        if (response.prediction) {
          setThreeZero(response.prediction.three_zero || []);
          setZeroThree(response.prediction.zero_three || []);
          setAdvancing(response.prediction.advancing || []);
        } else {
          setThreeZero([]);
          setZeroThree([]);
          setAdvancing([]);
        }
      } catch (err) {
        console.error(err);
        setError(err.message || "Nie udało się wczytać Swiss Pick'Em.");
      } finally {
        setLoading(false);
      }
    }

    loadSwissPickem();
  }, [slug, stage]);

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

  // Limity pochodzą z konfiguracji eventu (API). Fallback to wartości
  // domyślne - te same, które backend stosuje dla eventu bez konfiguracji,
  // więc zachowanie bez konfiguracji jest identyczne jak wcześniej.
  const limity = data?.limity ?? { x3_0: 2, x0_3: 2, advancing: 6 };
  const limit30 = Number(limity.x3_0 ?? 2);
  const limit03 = Number(limity.x0_3 ?? 2);
  const limitAwans = Number(limity.advancing ?? 6);

  const savedPrediction = data?.prediction;

  const hasChanges =
    !savedPrediction ||
    JSON.stringify(threeZero) !==
      JSON.stringify(savedPrediction.three_zero || []) ||
    JSON.stringify(zeroThree) !==
      JSON.stringify(savedPrediction.zero_three || []) ||
    JSON.stringify(advancing) !==
      JSON.stringify(savedPrediction.advancing || []);

  const pickingLocked = !data?.lock?.allowed || authLoading || !user;

  // Przełącza nazwę w liście: usuwa, jeśli już jest, dopisuje, jeśli mieści
  // się w limicie. Ten sam ruch dla wszystkich trzech grup.
  const toggle = (setList, limit) => (name) => {
    setSaveMessage("");

    setList((current) => {
      if (current.includes(name)) {
        return current.filter((item) => item !== name);
      }

      if (current.length >= limit) {
        return current;
      }

      return [...current, name];
    });
  };

  return (
    <main className="ui-page">
      <BackLink to={`/events/${slug}`} />

      <div className="ui-section-head">
        <div>
          <span className="ui-kicker">Faza szwajcarska · {stageLabel}</span>

          <h2>Swiss Pick&apos;Em</h2>

          <p>{data?.event?.name}</p>
        </div>

        <div className="ui-row ui-row--wrap">
          <span className="ui-badge">
            {data?.teams?.length ?? 0} {druzyny(data?.teams?.length ?? 0)}
          </span>

          {!user ? (
            <span className="ui-badge ui-badge--warn">Wymaga logowania</span>
          ) : data?.lock?.allowed ? (
            <span className="ui-badge ui-badge--ok">Typowanie otwarte</span>
          ) : (
            <span className="ui-badge ui-badge--warn">Typowanie zamknięte</span>
          )}
        </div>
      </div>

      <nav className="ui-choice" aria-label="Etapy fazy szwajcarskiej">
        {["stage1", "stage2", "stage3"].map((stageName, index) => (
          <Link
            key={stageName}
            to={`/events/${slug}/swiss/${stageName}`}
            className="ui-choice__option"
            aria-current={stage === stageName ? "page" : undefined}
          >
            Stage {index + 1}
          </Link>
        ))}
      </nav>

      <PhaseFormat faza={stage} limity={limity} />

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

      <TeamPickGroup
        title="Bilans 3-0"
        description={`Wybierz dokładnie ${limit30} ${druzyny(limit30)} z bilansem 3-0.`}
        teams={data?.teams}
        selected={threeZero}
        limit={limit30}
        disabled={pickingLocked}
        isBlocked={() => false}
        onToggle={toggle(setThreeZero, limit30)}
      />

      <TeamPickGroup
        title="Bilans 0-3"
        description={`Wybierz dokładnie ${limit03} ${druzyny(limit03)} z bilansem 0-3.`}
        teams={data?.teams}
        selected={zeroThree}
        limit={limit03}
        disabled={pickingLocked}
        isBlocked={(name) => threeZero.includes(name)}
        onToggle={toggle(setZeroThree, limit03)}
      />

      <TeamPickGroup
        title="Awans"
        description={`Wybierz dokładnie ${limitAwans} ${druzyny(limitAwans)} do awansu.`}
        teams={data?.teams}
        selected={advancing}
        limit={limitAwans}
        disabled={pickingLocked}
        isBlocked={(name) =>
          threeZero.includes(name) || zeroThree.includes(name)
        }
        onToggle={toggle(setAdvancing, limitAwans)}
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
          threeZero.length !== limit30 ||
          zeroThree.length !== limit03 ||
          advancing.length !== limitAwans ||
          !hasChanges
        }
        onClick={async () => {
          try {
            setSaving(true);
            setSaveMessage("");

            await saveSwissPickem(slug, stage, {
              three_zero: threeZero,
              zero_three: zeroThree,
              advancing,
            });

            setData((current) => ({
              ...current,
              prediction: {
                three_zero: [...threeZero],
                zero_three: [...zeroThree],
                advancing: [...advancing],
              },
            }));

            setSaveMessage(SAVED_MESSAGE);
          } catch (err) {
            console.error(err);
            setSaveMessage(err.message || "Nie udało się zapisać typów.");
          } finally {
            setSaving(false);
          }
        }}
      >
        {saving ? "Zapisywanie..." : "Zapisz typy"}
      </button>

      {/* Oficjalny wynik fazy + trafienia + punkty.
          Renderuje sie dopiero po opublikowaniu wyniku. */}
      <PhaseResults slug={slug} phase={stage} />
    </main>
  );
}

export default SwissPickemPage;
