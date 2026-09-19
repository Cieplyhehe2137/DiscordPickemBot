import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { getSwissPickem, saveSwissPickem } from "../lib/api.js";
import { translateApiMessage } from "../lib/apiMessages.js";
import { useT } from "../i18n/useLanguage.js";
import { useToast } from "../components/ui/useToast.js";
import PhaseResults from "../components/PhaseResults.jsx";

import { useAuth } from "../auth/useAuth.js";
import BackLink from "../components/BackLink.jsx";
import PhaseFormat from "../components/PhaseFormat.jsx";
import TeamPickGroup from "../components/TeamPickGroup.jsx";
import DeadlineNotice from "../components/DeadlineNotice.jsx";
import { apiUrl } from "../lib/apiUrl.js";

function SwissPickemPage() {
  const t = useT();

  const { slug, stage } = useParams();
  const { user, authLoading } = useAuth();
  const toast = useToast();
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
  // Tylko błędy - potwierdzenie zapisu idzie powiadomieniem, żeby dało się
  // je zobaczyć także wtedy, gdy przycisk stoi na dole długiej listy.
  const [saveError, setSaveError] = useState("");

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
        setError(err.message || t("pickem.swiss.loadError"));
      } finally {
        setLoading(false);
      }
    }

    loadSwissPickem();
  }, [slug, stage, t]);

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
    setSaveError("");

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
          <span className="ui-kicker">
            {t("pickem.swiss.kicker", { stage: stageLabel })}
          </span>

          <h2>Swiss Pick&apos;Em</h2>

          <p>{data?.event?.name}</p>
        </div>

        <div className="ui-row ui-row--wrap">
          <span className="ui-badge">
            {t("pickem.teamsCount", { count: data?.teams?.length ?? 0 })}
          </span>

          {!user ? (
            <span className="ui-badge ui-badge--warn">
              {t("pickem.loginRequired")}
            </span>
          ) : data?.lock?.allowed ? (
            <span className="ui-badge ui-badge--ok">
              {t("matchState.open")}
            </span>
          ) : (
            <span className="ui-badge ui-badge--warn">
              {t("matchState.locked")}
            </span>
          )}
        </div>
      </div>

      <nav className="ui-choice" aria-label={t("pickem.swiss.stages")}>
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

      <TeamPickGroup
        title={t("pickem.swiss.group30")}
        description={t("pickem.swiss.desc30", { count: limit30 })}
        teams={data?.teams}
        selected={threeZero}
        limit={limit30}
        disabled={pickingLocked}
        isBlocked={() => false}
        onToggle={toggle(setThreeZero, limit30)}
      />

      <TeamPickGroup
        title={t("pickem.swiss.group03")}
        description={t("pickem.swiss.desc03", { count: limit03 })}
        teams={data?.teams}
        selected={zeroThree}
        limit={limit03}
        disabled={pickingLocked}
        isBlocked={(name) => threeZero.includes(name)}
        onToggle={toggle(setZeroThree, limit03)}
      />

      <TeamPickGroup
        title={t("pickem.swiss.groupAdvancing")}
        description={t("pickem.swiss.descAdvancing", { count: limitAwans })}
        teams={data?.teams}
        selected={advancing}
        limit={limitAwans}
        disabled={pickingLocked}
        isBlocked={(name) =>
          threeZero.includes(name) || zeroThree.includes(name)
        }
        onToggle={toggle(setAdvancing, limitAwans)}
      />

      {saveError && <p className="ui-note ui-note--danger">{saveError}</p>}

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
            setSaveError("");

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

            toast.success(t("pickem.saved"));
          } catch (err) {
            console.error(err);
            setSaveError(err.message || t("pickem.saveError"));
          } finally {
            setSaving(false);
          }
        }}
      >
        {saving ? t("pickem.saving") : t("pickem.save")}
      </button>

      {/* Oficjalny wynik fazy + trafienia + punkty.
          Renderuje sie dopiero po opublikowaniu wyniku. */}
      <PhaseResults slug={slug} phase={stage} />
    </main>
  );
}

export default SwissPickemPage;
