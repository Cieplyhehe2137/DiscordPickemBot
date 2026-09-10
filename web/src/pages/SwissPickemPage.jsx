import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { getSwissPickem, saveSwissPickem } from "../lib/api.js";
import { druzyny } from "../lib/odmiana.js";
import PhaseResults from "../components/PhaseResults.jsx";

import { useAuth } from "../auth/useAuth.js";
import BackLink from "../components/BackLink.jsx";

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

        console.log("SWISS PICKEM:", response);
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
      <main className="swiss-pickem-page">
        <p>Ładowanie Swiss Pick'Em...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="swiss-pickem-page">
        <p>{error}</p>
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

  return (
    <main className="swiss-pickem-page">
      <BackLink to={`/events/${slug}`} />
      <h1>Swiss Pick'Em</h1>

      <p>
        Event: <strong>{data?.event?.name}</strong>
      </p>

      <p>
        Etap: <strong>{stageLabel}</strong>
      </p>

      <nav className="swiss-pickem__stages">
        {["stage1", "stage2", "stage3"].map((stageName, index) => (
          <Link
            key={stageName}
            to={`/events/${slug}/swiss/${stageName}`}
            className={
              stage === stageName
                ? "swiss-pickem__stage is-active"
                : "swiss-pickem__stage"
            }
          >
            Stage {index + 1}
          </Link>
        ))}
      </nav>

      <p>
        Drużyn: <strong>{data?.teams?.length ?? 0}</strong>
      </p>

      <p>
        Typowanie:{" "}
        <strong>
          {!user
            ? "WYMAGA LOGOWANIA"
            : data?.lock?.allowed
              ? "OTWARTE"
              : "ZABLOKOWANE"}
        </strong>
      </p>

      {!authLoading && !user && (
        <p>
          <a
            href={`/api/auth/discord?returnTo=${encodeURIComponent(
              window.location.pathname + window.location.search,
            )}`}
          >
            Zaloguj się przez Discord
          </a>{" "}
          aby wybrać i zapisać swoje typy.
        </p>
      )}
      {!data?.lock?.allowed && data?.lock?.message && (
        <p>{data.lock.message}</p>
      )}
      <section className="swiss-pickem__teams">
        <h2>3-0</h2>

        <p>Wybierz dokładnie {limit30} {druzyny(limit30)} z bilansem 3-0.</p>

        {data?.teams?.map((team) => {
          const selected = threeZero.includes(team.name);

          return (
            <button
              key={team.id}
              type="button"
              disabled={!data?.lock?.allowed || authLoading || !user}
              className={`swiss-pickem__team ${selected ? "is-selected" : ""}`}
              onClick={() => {
                setSaveMessage("");

                setThreeZero((current) => {
                  if (current.includes(team.name)) {
                    return current.filter((name) => name !== team.name);
                  }

                  if (current.length >= limit30) {
                    return current;
                  }

                  return [...current, team.name];
                });
              }}
            >
              {team.name}
            </button>
          );
        })}

        <p className="swiss-pickem__counter">
          Wybrano: <strong>{threeZero.length}/{limit30}</strong>
        </p>
      </section>
      <section className="swiss-pickem__teams">
        <h2>0-3</h2>

        <p>Wybierz dokładnie {limit03} {druzyny(limit03)} z bilansem 0-3.</p>

        {data?.teams?.map((team) => {
          const selected = zeroThree.includes(team.name);
          const usedInThreeZero = threeZero.includes(team.name);

          return (
            <button
              key={team.id}
              type="button"
              className={`swiss-pickem__team ${selected ? "is-selected" : ""}`}
              disabled={
                !data?.lock?.allowed || authLoading || !user || usedInThreeZero
              }
              onClick={() => {
                setSaveMessage("");

                setZeroThree((current) => {
                  if (current.includes(team.name)) {
                    return current.filter((name) => name !== team.name);
                  }

                  if (current.length >= limit03) {
                    return current;
                  }

                  return [...current, team.name];
                });
              }}
            >
              {team.name}
            </button>
          );
        })}

        <p className="swiss-pickem__counter">
          Wybrano: <strong>{zeroThree.length}/{limit03}</strong>
        </p>
      </section>
      <section className="swiss-pickem__teams">
        <h2>Awans</h2>

        <p>Wybierz dokładnie {limitAwans} {druzyny(limitAwans)} do awansu.</p>

        {data?.teams?.map((team) => {
          const selected = advancing.includes(team.name);
          const usedElsewhere =
            threeZero.includes(team.name) || zeroThree.includes(team.name);

          return (
            <button
              key={team.id}
              type="button"
              className={`swiss-pickem__team ${selected ? "is-selected" : ""}`}
              disabled={
                !data?.lock?.allowed || authLoading || !user || usedElsewhere
              }
              onClick={() => {
                setSaveMessage("");

                setAdvancing((current) => {
                  if (current.includes(team.name)) {
                    return current.filter((name) => name !== team.name);
                  }

                  if (current.length >= limitAwans) {
                    return current;
                  }

                  return [...current, team.name];
                });
              }}
            >
              {team.name}
            </button>
          );
        })}

        <p className="swiss-pickem__counter">
          Wybrano: <strong>{advancing.length}/{limitAwans}</strong>
        </p>
      </section>

      <button
        type="button"
        className="swiss-pickem__save"
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

            setSaveMessage("Typy zapisane ✅");
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

      {saveMessage && (
        <p className="swiss-pickem__save-message">{saveMessage}</p>
      )}

      {/* Oficjalny wynik fazy + trafienia + punkty.
          Renderuje sie dopiero po opublikowaniu wyniku. */}
      <PhaseResults slug={slug} phase={stage} />
    </main>
  );
}

export default SwissPickemPage;
