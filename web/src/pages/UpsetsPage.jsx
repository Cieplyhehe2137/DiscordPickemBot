import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import Ladowanie from "../components/Ladowanie.jsx";
import PlayerAvatar from "../components/PlayerAvatar.jsx";
import TeamCrest from "../components/TeamCrest.jsx";
import { getUpsets } from "../lib/api.js";
import { humanPhase } from "../lib/phaseLabels.js";
import { useT } from "../i18n/useLanguage.js";

// Niespodzianki: mecze, w których myliła się większość.
//
// Cała reguła - które mecze się liczą, dlaczego skuteczność zamiast liczby
// trafień i skąd progi - siedzi w server/lib/upsets.js i tam jest wyjaśniona.
// Tu wystarczy wiedzieć, że strona składa się z trzech rzeczy, które mówią
// to samo z trzech stron: co zaskoczyło, kogo nie zaskoczyło i które
// drużyny myli się najczęściej.
//
// Medale są WYŁĄCZNIE przy graczach. Na liście meczów byłyby odznaczeniem
// za cudzą pomyłkę, a tam nikt niczego nie osiągnął.

const PODIUM = {
  1: " ui-row-item--1",
  2: " ui-row-item--2",
  3: " ui-row-item--3",
};

function Mecz({ mecz, t }) {
  // Wynik pokazujemy od strony przegranego, bo w tej samej kolejności stoją
  // nazwy. res_a i res_b są przypisane do team_a i team_b, a tu drużyny idą
  // w kolejności "przegrany - zwycięzca"; przy rozstrzygniętym meczu
  // zwycięzca ma zawsze wyższą liczbę, więc min i max wystarczą.
  const przegral = Math.min(mecz.res_a, mecz.res_b);
  const wygral = Math.max(mecz.res_a, mecz.res_b);

  return (
    <div className="ui-row-item">
      <span className="ui-row-item__rank">{mecz.rank}</span>

      <Link
        className="ui-row-item__who"
        to={`/events/${mecz.event_slug}/matches/${mecz.match_id}`}
      >
        <span className="upset-teams">
          <span className="upset-teams__side">{mecz.loser}</span>

          <span className="upset-teams__score">
            {przegral}:{wygral}
          </span>

          <span className="upset-teams__side upset-teams__side--won">
            {mecz.winner}
          </span>
        </span>
      </Link>

      <div className="ui-row-item__meta">
        <span className="ui-badge">
          {t("upsets.hits", {
            hits: mecz.picks_for_winner,
            total: mecz.picks_total,
          })}
        </span>

        <span className="ui-stat__hint">
          {mecz.event_name} · {humanPhase(mecz.phase, t)}
        </span>
      </div>

      <strong className="ui-row-item__score">
        {t("upsets.share", { percent: mecz.winner_share })}
      </strong>
    </div>
  );
}

function UpsetsPage() {
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

        const odp = await getUpsets();

        if (!anulowane) setDane(odp);
      } catch (err) {
        console.error("UPSETS ERROR:", err);

        if (!anulowane) setError(err.message);
      } finally {
        if (!anulowane) setLoading(false);
      }
    }

    wczytaj();

    return () => {
      anulowane = true;
    };
  }, []);

  if (loading) {
    return (
      <main className="ui-page">
        <Ladowanie>{t("upsets.loading")}</Ladowanie>
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

          <strong className="ui-error__title">{t("upsets.error")}</strong>

          <p className="ui-error__text">{error}</p>
        </div>
      </main>
    );
  }

  const mecze = dane?.upsets ?? [];
  const gracze = dane?.contrarians ?? [];
  const druzyny = dane?.teams ?? [];

  const tlo = dane?.crowd_rate ?? null;
  const progProcent = dane?.threshold_percent ?? 25;
  const progTypow = dane?.min_picks ?? 20;
  const progOkazji = dane?.min_chances ?? 12;
  const progMeczow = dane?.min_team_matches ?? 5;

  return (
    <main className="ui-page">
      <div className="ui-section-head">
        <div>
          <span className="ui-kicker">{t("upsets.kicker")}</span>

          <h2>{t("upsets.title")}</h2>

          <p>{t("upsets.intro", { percent: progProcent })}</p>
        </div>
      </div>

      {mecze.length === 0 ? (
        <div className="ui-empty">
          <span className="ui-empty__icon" aria-hidden="true">
            🎯
          </span>

          <strong className="ui-empty__title">{t("upsets.empty.title")}</strong>

          <p className="ui-empty__text">
            {t("upsets.empty.text", { percent: progProcent })}
          </p>
        </div>
      ) : (
        <>
          <p className="ui-stat__hint">
            {t("upsets.counted", { count: mecze.length })}
          </p>

          <div className="ui-table">
            <div className="ui-table__head" aria-hidden="true">
              <span>#</span>
              <span>{t("upsets.head.match")}</span>
              <span>{t("upsets.head.where")}</span>
              <span>{t("upsets.head.share")}</span>
            </div>

            {mecze.map((mecz) => (
              <Mecz key={mecz.match_id} mecz={mecz} t={t} />
            ))}
          </div>

          <p className="ui-note">
            {t("upsets.note", { percent: progProcent, count: progTypow })}
          </p>
        </>
      )}

      {/* Gracze dopiero po meczach: żeby "trafił 42%" cokolwiek znaczyło,
          trzeba najpierw zobaczyć, o jakich meczach mowa. */}
      {gracze.length > 0 && (
        <>
          <div className="ui-section-head">
            <div>
              <span className="ui-kicker">{t("upsets.people.kicker")}</span>

              <h2>{t("upsets.people.title")}</h2>

              {/* Tło, bez którego procent gracza nie ma do czego się
                  odnieść. Przeciętny uczestnik tych meczów trafiał rzadko
                  i strona musi to powiedzieć wprost. */}
              <p>{t("upsets.people.intro", { percent: tlo ?? 0 })}</p>
            </div>
          </div>

          <div className="ui-table">
            <div className="ui-table__head" aria-hidden="true">
              <span>#</span>
              <span>{t("upsets.head.player")}</span>
              <span>{t("upsets.head.hits")}</span>
              <span>{t("upsets.head.rate")}</span>
            </div>

            {gracze.map((gracz) => (
              <div
                className={`ui-row-item${PODIUM[gracz.rank] ?? ""}`}
                key={gracz.user_id}
              >
                <span className="ui-row-item__rank">{gracz.rank}</span>

                <Link
                  className="ui-row-item__who"
                  to={`/player/${gracz.user_id}`}
                >
                  <PlayerAvatar
                    userId={gracz.user_id}
                    avatar={gracz.avatar}
                    name={gracz.displayname}
                  />

                  <span className="ui-row-item__name">
                    {gracz.displayname ?? gracz.user_id}
                  </span>
                </Link>

                <div className="ui-row-item__meta">
                  <span className="ui-badge">
                    {t("upsets.hits", {
                      hits: gracz.hits,
                      total: gracz.chances,
                    })}
                  </span>
                </div>

                <strong className="ui-row-item__score">
                  {t("upsets.share", { percent: gracz.hit_rate })}
                </strong>
              </div>
            ))}
          </div>

          <p className="ui-note">
            {t("upsets.people.note", { count: progOkazji })}
          </p>
        </>
      )}

      {druzyny.length > 0 && (
        <>
          <div className="ui-section-head">
            <div>
              <span className="ui-kicker">{t("upsets.teams.kicker")}</span>

              <h2>{t("upsets.teams.title")}</h2>

              <p>{t("upsets.teams.intro")}</p>
            </div>
          </div>

          <div className="ui-table">
            {/* Pusta komórka na miejscu kolumny z numerem: drużyny nie mają
                numeru, ale nagłówek i wiersze stoją na tej samej siatce
                czterech kolumn i bez niej rozjechałyby się o jedną. */}
            <div className="ui-table__head" aria-hidden="true">
              <span />
              <span>{t("upsets.head.team")}</span>
              <span>{t("upsets.head.judgement")}</span>
              <span>{t("upsets.head.gap")}</span>
            </div>

            {/* Wiersze drużyn nie mają komórki z numerem: pozycja w tym
                spektrum nie jest miejscem, które cokolwiek znaczy - środek
                tabeli to drużyny oceniane trafnie, a nie "przegrane".
                Kolumna po numerze zwija się wtedy do zera i wiersze
                zostają równe z pozostałymi tabelami. */}
            {druzyny.map((druzyna) => (
              <div className="ui-row-item" key={druzyna.key}>
                <Link
                  className="ui-row-item__who"
                  to={`/teams/${encodeURIComponent(druzyna.name)}`}
                >
                  <TeamCrest name={druzyna.name} logo={druzyna.logo} />

                  <span className="ui-row-item__name">{druzyna.name}</span>
                </Link>

                <div className="ui-row-item__meta">
                  <span className="ui-badge">
                    {t("upsets.teams.trust", { percent: druzyna.trust })}
                  </span>

                  <span className="ui-badge">
                    {t("upsets.teams.wins", { percent: druzyna.win_rate })}
                  </span>
                </div>

                {/* Znak jest tu całą informacją: dodatnia różnica znaczy
                    drużynę przecenianą, ujemna niedocenianą. Dlatego plus
                    stoi przy liczbach dodatnich, choć zwykle się go nie
                    pisze - bez niego obie kolumny wyglądają tak samo.

                    Minus to U+2212, a nie dywiz z klawiatury: w tym kroju
                    dywiz jest wyraźnie węższy i niżej osadzony od plusa,
                    więc w kolumnie liczb o stałej szerokości „-31" wisiało
                    krzywo obok „+51". Prawdziwy minus jest rysowany
                    dokładnie na miarę plusa. */}
                <strong
                  className={`ui-row-item__score upset-gap${
                    druzyna.gap > 0
                      ? " upset-gap--over"
                      : druzyna.gap < 0
                        ? " upset-gap--under"
                        : ""
                  }`}
                >
                  {druzyna.gap > 0 ? "+" : druzyna.gap < 0 ? "−" : ""}
                  {Math.abs(druzyna.gap)}
                </strong>
              </div>
            ))}
          </div>

          <p className="ui-note">
            {t("upsets.teams.note", { count: progMeczow })}
          </p>
        </>
      )}
    </main>
  );
}

export default UpsetsPage;
