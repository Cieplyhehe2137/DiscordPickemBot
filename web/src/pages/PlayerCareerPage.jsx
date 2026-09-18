import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import Ladowanie from "../components/Ladowanie.jsx";
import PlayerAvatar from "../components/PlayerAvatar.jsx";
import PlayerHistory from "../components/PlayerHistory.jsx";
import TeamCrest from "../components/TeamCrest.jsx";
import { getPlayerCareer } from "../lib/api.js";
import { useT } from "../i18n/useLanguage.js";

// Profil gracza ponad turniejami.
//
// Powód istnienia stoi w server/lib/playerCareer.js. Tu wystarczy wiedzieć,
// że NIC na tej stronie nie jest liczone osobno: średni percentyl to ta sama
// liczba, którą pokazuje klasyfikacja wszech czasów, kontra to ten sam wiersz,
// co w niespodziankach, a lista startów to ten sam komponent, który stoi na
// profilu w turnieju - tylko z własnym nagłówkiem, bo tutaj jest treścią
// główną, a nie dopiskiem.

// Nagłówek listy startów. Domyślny w komponencie mówi "poza tym turniejem",
// co jest prawdą wyłącznie wewnątrz turnieju.
const NAGLOWEK_STARTOW = {
  kicker: "career.starts.kicker",
  title: "career.starts.title",
  count: "career.starts.count",
  hint: "career.starts.hint",
};

function PlayerCareerPage() {
  const { userId } = useParams();

  const t = useT();

  const [dane, setDane] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let anulowane = false;

    async function wczytaj() {
      try {
        setLoading(true);
        setError("");

        const odp = await getPlayerCareer(userId);

        if (!anulowane) setDane(odp);
      } catch (err) {
        console.error("PLAYER CAREER ERROR:", err);

        if (!anulowane) setError(err.message);
      } finally {
        if (!anulowane) setLoading(false);
      }
    }

    wczytaj();

    return () => {
      anulowane = true;
    };
  }, [userId]);

  if (loading) {
    return (
      <main className="ui-page">
        <Ladowanie>{t("career.loading")}</Ladowanie>
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

          <strong className="ui-error__title">{t("career.error")}</strong>

          <p className="ui-error__text">{error}</p>
        </div>
      </main>
    );
  }

  const gracz = dane?.player ?? {};
  const podsumowanie = dane?.summary ?? null;
  const starty = dane?.starts ?? [];
  const kontra = dane?.contrarian ?? null;
  const druzyny = dane?.teams ?? [];

  const typow = dane?.picks_total ?? 0;
  const progOkazji = dane?.min_chances ?? 12;
  const progTypow = dane?.min_team_picks ?? 3;

  return (
    <main className="ui-page">
      <section className="ui-card ui-stack">
        <div className="ui-row ui-row--wrap">
          <PlayerAvatar
            userId={gracz.user_id}
            avatar={gracz.avatar}
            name={gracz.displayname}
            size="ui-avatar--xl"
            lazy={false}
          />

          <div>
            <span className="ui-kicker">{t("career.kicker")}</span>

            <h2>{gracz.displayname ?? gracz.user_id}</h2>

            <p className="ui-stat__hint">
              {podsumowanie
                ? t("career.played", { count: podsumowanie.starts })
                : t("career.noStarts")}
            </p>
          </div>
        </div>

        <div className="ui-stats ui-stats--4">
          {/* Średni percentyl jako liczba wyróżniona, bo to ta sama miara,
              która ustawia gracza w klasyfikacji wszech czasów. */}
          <div className="ui-stat ui-stat--featured">
            <span>{t("career.stat.average")}</span>

            <strong>
              {podsumowanie
                ? t("history.top", { percent: podsumowanie.avg_top_percent })
                : "—"}
            </strong>

            <small>{t("career.stat.averageHint")}</small>
          </div>

          <div className="ui-stat">
            <span>{t("career.stat.best")}</span>

            {/* Postać zwięzła, a nie zdanie: w tym kafelku stoi liczba
                w dużym stopniu pisma, a "miejsce 5 z 523" łamało się
                w środku wyrazu na "miejsc / e 5 z / 523". Nazwa turnieju
                i tak jest podpisem niżej. */}
            <strong>
              {podsumowanie?.best
                ? t("career.stat.bestValue", {
                    rank: podsumowanie.best.rank,
                    total: podsumowanie.best.participants,
                  })
                : "—"}
            </strong>

            <small>{podsumowanie?.best?.name ?? t("career.stat.bestHint")}</small>
          </div>

          <div className="ui-stat">
            <span>{t("career.stat.points")}</span>

            <strong>{podsumowanie ? podsumowanie.total_points : 0}</strong>

            <small>{t("career.stat.pointsHint")}</small>
          </div>

          {/* Kontra: ile razy trafił mecz, w którym myliła się większość.
              Liczona z tych samych meczów, co strona niespodzianek. */}
          <div className="ui-stat">
            <span>{t("career.stat.contra")}</span>

            <strong>
              {kontra ? t("common.percentValue", { percent: kontra.hit_rate }) : "—"}
            </strong>

            <small>
              {kontra
                ? t("career.stat.contraHint", {
                    hits: kontra.hits,
                    total: kontra.chances,
                  })
                : t("career.stat.contraNone")}
            </small>
          </div>
        </div>

        {/* Ile brakuje do zestawienia na stronie niespodzianek. Bez tego
            zdania gracz z dobrą skutecznością nie wie, czemu go tam nie ma. */}
        {kontra && kontra.chances < progOkazji && (
          <p className="ui-note">
            {t("career.contraShort", { count: progOkazji - kontra.chances })}
          </p>
        )}
      </section>

      <PlayerHistory
        events={starty}
        userId={gracz.user_id}
        headings={NAGLOWEK_STARTOW}
      />

      <section className="ui-card ui-stack">
        <div className="ui-section-head">
          <div>
            <span className="ui-kicker">{t("career.teams.kicker")}</span>

            <h2>{t("career.teams.title")}</h2>

            <p>{t("career.teams.intro")}</p>
          </div>
        </div>

        {druzyny.length === 0 ? (
          <p className="ui-hint">
            {t("career.teams.empty", { count: progTypow, picks: typow })}
          </p>
        ) : (
          <div className="ui-table">
            {/* Pusta komórka na miejscu kolumny z numerem - drużyny nie mają
                numeru, a nagłówek i wiersze stoją na tej samej siatce. */}
            <div className="ui-table__head" aria-hidden="true">
              <span />
              <span>{t("career.teams.head.team")}</span>
              <span>{t("career.teams.head.record")}</span>
              <span>{t("career.teams.head.rate")}</span>
            </div>

            {druzyny.map((druzyna) => (
              <div className="ui-row-item" key={druzyna.key}>
                <Link
                  className="ui-row-item__who"
                  to={`/teams/${encodeURIComponent(druzyna.team)}`}
                >
                  <TeamCrest name={druzyna.team} logo={druzyna.logo} />

                  <span className="ui-row-item__name">{druzyna.team}</span>
                </Link>

                <div className="ui-row-item__meta">
                  <span className="ui-badge">
                    {t("career.teams.record", {
                      wins: druzyna.wins,
                      picks: druzyna.picks,
                    })}
                  </span>
                </div>

                <strong className="ui-row-item__score">
                  {t("common.percentValue", { percent: druzyna.win_rate })}
                </strong>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

export default PlayerCareerPage;
