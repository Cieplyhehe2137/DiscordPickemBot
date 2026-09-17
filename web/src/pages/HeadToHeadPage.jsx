import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import BackLink from "../components/BackLink.jsx";
import PlayerAvatar from "../components/PlayerAvatar.jsx";
import Ladowanie from "../components/Ladowanie.jsx";
import { getEventPlayerProfile, getHeadToHead } from "../lib/api.js";
import PointsChart from "../components/PointsChart.jsx";
import {
  betterSide,
  duelProgress,
  splitWidths,
} from "../lib/headToHeadStats.js";
import { T } from "../i18n/T.jsx";
import { useT } from "../i18n/useLanguage.js";

// Porównanie dwóch graczy w obrębie jednego turnieju.
//
// Strona składa się z dwóch rzeczy, które celowo liczą co innego:
//
//  - TABLICA POJEDYNKU bierze wyłącznie mecze, które obaj obstawili. To jest
//    odpowiedź na "kto z nas typuje lepiej" i tylko ona jest uczciwa, bo
//    mecz obstawiony przez jednego z nich nie mówi nic o przewadze.
//
//  - PORÓWNANIE STATYSTYK bierze cały dorobek każdego z nich w turnieju,
//    prosto z profilu. Suma punktów będzie się tu różnić od tablicy wyżej
//    i tak ma być - to dwa różne pytania.
//
// Stąd trzy zapytania zamiast jednego: dwa profile (nazwy, awatary, serie,
// rekordy, miejsce w rankingu) i sam pojedynek. Profil jest już policzony
// i sprawdzony, więc powtarzanie jego logiki po stronie pojedynku dałoby
// drugi zestaw zapytań, który z czasem rozjechałby się z pierwszym.

// Wiersze porównania. Kolejność od najważniejszego: punkty i miejsce są tym,
// o co ludzie pytają najpierw.
const WIERSZE = [
  { labelKey: "h2h.row.points", pole: "total_points" },

  {
    labelKey: "h2h.row.rank",
    pole: "rank",
    lowerIsBetter: true,
    format: (v) => (v > 0 ? `#${v}` : "—"),
  },

  {
    labelKey: "h2h.row.accuracy",
    pole: "accuracy",
    format: (v) => `${v ?? 0}%`,
  },
  { labelKey: "h2h.row.winners", pole: "correct_winners" },
  { labelKey: "h2h.row.exactSeries", pole: "exact_series" },
  { labelKey: "h2h.row.exactMaps", pole: "exact_maps" },
  { labelKey: "h2h.row.correctMaps", pole: "correct_maps" },
  { labelKey: "h2h.row.streak", pole: "best_correct_streak" },
  { labelKey: "h2h.row.perfect", pole: "perfect_matches" },
  { labelKey: "h2h.row.bestMatch", pole: "best_match_points" },
];

// Klasy zwycięskiej strony trzymane w tablicy, a nie sklejane z wyniku.
// Sklejanie `h2h-value--best-${strona}` sprawia, że nazwa nie występuje
// w kodzie dosłownie i narzędzie do usuwania martwego CSS kasuje te reguły.
//
// Każda strona ma własny kolor - ten sam, co jej liczba na tablicy wyżej.
// Jeden wspólny kolor "lepszego" kazałby przy każdym wierszu sprawdzać, po
// której stronie stoi wyróżniona liczba.
const STRONA_KLASA = {
  a: " h2h-value--best-a",
  b: " h2h-value--best-b",
};

const MECZ_KLASA = {
  won: " h2h-pick--won",
  lost: " h2h-pick--lost",
  tie: "",
};

// Jak wypadła dana strona w pojedynczym meczu pojedynku.
function jakWypadl(winner, strona) {
  if (winner === null) return "tie";

  if (winner === "tie") return "tie";

  return winner === strona ? "won" : "lost";
}

function Tablica({ a, b, summary }) {
  const t = useT();

  const paski = splitWidths(summary);

  // Kto prowadzi w pojedynku - do podpisu pod tablicą.
  const prowadzi =
    summary.wins_a > summary.wins_b
      ? a
      : summary.wins_b > summary.wins_a
        ? b
        : null;

  const przewaga = Math.abs(summary.wins_a - summary.wins_b);

  return (
    <section className="ui-card ui-stack h2h-board">
      <div className="h2h-board__row">
        <div className="h2h-board__player">
          <PlayerAvatar
            userId={a.user_id}
            avatar={a.avatar}
            name={a.displayname}
            size="ui-avatar--lg"
            lazy={false}
          />

          <span className="h2h-board__name">{a.displayname}</span>
        </div>

        <div className="h2h-board__score">
          <strong className="h2h-board__wins h2h-board__wins--a">
            {summary.wins_a}
          </strong>

          <span className="h2h-board__sep">:</span>

          <strong className="h2h-board__wins h2h-board__wins--b">
            {summary.wins_b}
          </strong>
        </div>

        <div className="h2h-board__player h2h-board__player--b">
          <PlayerAvatar
            userId={b.user_id}
            avatar={b.avatar}
            name={b.displayname}
            size="ui-avatar--lg"
            lazy={false}
          />

          <span className="h2h-board__name">{b.displayname}</span>
        </div>
      </div>

      {/* Pasek pokazuje też remisy - bez nich dwie osoby, które w połowie
          wspólnych meczów wzięły tyle samo punktów, wyglądałyby na
          poróżnione dużo mocniej, niż są. */}
      <div className="ui-split">
        <div className="ui-split__a" style={{ width: `${paski.a}%` }} />
        <div className="ui-split__tie" style={{ width: `${paski.tie}%` }} />
        <div className="ui-split__b" style={{ width: `${paski.b}%` }} />
      </div>

      <p className="ui-stat__hint h2h-board__summary">
        {summary.settled === 0 ? (
          t("h2h.nothingSettled")
        ) : prowadzi ? (
          <T
            k="h2h.lead"
            vars={{
              name: <strong>{prowadzi.displayname}</strong>,
              count: przewaga,
              ties: t("h2h.ties", { count: summary.ties }),
              settled: t("h2h.settled", { count: summary.settled }),
            }}
          />
        ) : (
          t("h2h.draw", { count: summary.settled })
        )}
      </p>

      <div className="ui-stats ui-stats--4">
        <div className="ui-stat">
          <span>{t("h2h.sharedPoints")}</span>

          <strong className="h2h-board__pair">
            {summary.points_a} : {summary.points_b}
          </strong>

          <small>{t("h2h.sharedPointsHint")}</small>
        </div>

        <div className="ui-stat">
          <span>{t("h2h.tiesLabel")}</span>
          <strong>{summary.ties}</strong>
          <small>{t("h2h.tiesHint")}</small>
        </div>

        <div className="ui-stat">
          <span>{t("h2h.samePick")}</span>
          <strong>{summary.same_picks}</strong>
          <small>{t("h2h.samePickHint")}</small>
        </div>

        <div className="ui-stat">
          <span>{t("h2h.pending")}</span>
          <strong>{summary.pending}</strong>
          <small>{t("h2h.pendingHint")}</small>
        </div>
      </div>
    </section>
  );
}

// Dwie linie na jednej skali: widac nie tylko KTO ma wiecej, ale gdzie
// sie rozjechali. Suma na koncu tego nie powie - dwie osoby z ta sama
// przewaga moga ja zbudowac na jednym wieczorze albo po punkcie na mecz.
function Przebieg({ a, b, matches }) {
  const t = useT();

  const { a: ciagA, b: ciagB } = duelProgress(matches);

  if (ciagA.length === 0) return null;

  return (
    <section className="ui-card ui-stack">
      <div className="ui-section-head">
        <div>
          <span className="ui-kicker">{t("h2h.progress.kicker")}</span>

          <h2>{t("h2h.progress.title")}</h2>

          <p>{t("h2h.progress.text")}</p>
        </div>
      </div>

      <PointsChart
        series={[
          { side: "a", name: a.displayname, points: ciagA },
          { side: "b", name: b.displayname, points: ciagB },
        ]}
      />
    </section>
  );
}

function Statystyki({ a, b }) {
  const t = useT();

  return (
    <section className="ui-card ui-stack">
      <div className="ui-section-head">
        <div>
          <span className="ui-kicker">{t("h2h.stats.kicker")}</span>

          <h2>{t("h2h.stats.title")}</h2>

          <p>{t("h2h.stats.text")}</p>
        </div>
      </div>

      <div className="ui-stack ui-stack--tight">
        {WIERSZE.map(({ labelKey, pole, lowerIsBetter, format }) => {
          const wartoscA = a[pole];
          const wartoscB = b[pole];

          const lepszy = betterSide(wartoscA, wartoscB, { lowerIsBetter });

          const pokaz = format ?? ((v) => Number(v ?? 0));

          return (
            <div className="h2h-row" key={pole}>
              <strong
                className={`h2h-value${lepszy === "a" ? STRONA_KLASA.a : ""}`}
              >
                {pokaz(wartoscA)}
              </strong>

              <span className="h2h-row__label">{t(labelKey)}</span>

              <strong
                className={`h2h-value${lepszy === "b" ? STRONA_KLASA.b : ""}`}
              >
                {pokaz(wartoscB)}
              </strong>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// Pierwsza litera nicku - ta sama, którą pokazuje awatar bez obrazka.
function inicjal(nazwa) {
  return nazwa?.[0]?.toUpperCase() ?? "?";
}

function WspolneMecze({ slug, matches, a, b }) {
  const t = useT();

  if (!matches.length) {
    return (
      <section className="ui-card ui-stack">
        <div className="ui-empty">
          <span className="ui-empty__icon" aria-hidden="true">
            🤝
          </span>

          <strong className="ui-empty__title">{t("h2h.empty.title")}</strong>

          <p className="ui-empty__text">{t("h2h.empty.text")}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="ui-card ui-stack">
      <div className="ui-section-head">
        <div>
          <span className="ui-kicker">{t("h2h.matches.kicker")}</span>

          <h2>{t("h2h.matches.title")}</h2>
        </div>
      </div>

      <div className="ui-stack ui-stack--tight">
        {matches.map((mecz) => {
          const stanA = jakWypadl(mecz.winner, "a");
          const stanB = jakWypadl(mecz.winner, "b");

          return (
            <div className="h2h-match" key={mecz.match_id}>
              <div className="h2h-match__head">
                <Link
                  className="h2h-match__teams"
                  to={`/events/${slug}/matches/${mecz.match_id}`}
                >
                  {mecz.team_a} <span className="h2h-match__vs">vs</span>{" "}
                  {mecz.team_b}
                </Link>

                {mecz.settled ? (
                  <span className="ui-badge">
                    {mecz.res_a}:{mecz.res_b}
                  </span>
                ) : (
                  <span className="ui-badge ui-badge--warn">
                    {t("team.noScore")}
                  </span>
                )}
              </div>

              {/* Inicjał przy każdym typie, bo przy wąskim ekranie te dwa
                  pudełka stoją jedno pod drugim i nic nie mówi, które jest
                  czyje. Kolor ten sam, co liczba gracza na tablicy. */}
              <div className="h2h-match__picks">
                <div
                  className={`h2h-pick${MECZ_KLASA[stanA]}`}
                  role="group"
                  aria-label={a.displayname}
                >
                  <span className="h2h-pick__who h2h-pick__who--a" aria-hidden="true">
                    {inicjal(a.displayname)}
                  </span>

                  <span className="h2h-pick__score">
                    {mecz.a.pred_a}:{mecz.a.pred_b}
                  </span>

                  <span className="h2h-pick__points">
                    {t("common.pointsValue", { value: mecz.a.points })}
                  </span>
                </div>

                {/* "Serii", a nie po prostu "ten sam typ". Punkty za mecz to
                    suma punktów za serię I za mapy, więc dwie osoby z tym
                    samym wynikiem serii biorą różne punkty, jeśli różnie
                    obstawiły mapy. Na prawdziwym turnieju dotyczy to 16 z 26
                    takich meczów - bez słowa "serii" identyczny typ obok
                    "5 pkt" i "4 pkt" wygląda jak błąd w danych. */}
                <span className="h2h-match__mid">
                  {mecz.same_pick ? t("h2h.samePickShort") : "—"}
                </span>

                <div
                  className={`h2h-pick${MECZ_KLASA[stanB]}`}
                  role="group"
                  aria-label={b.displayname}
                >
                  <span className="h2h-pick__who h2h-pick__who--b" aria-hidden="true">
                    {inicjal(b.displayname)}
                  </span>

                  <span className="h2h-pick__score">
                    {mecz.b.pred_a}:{mecz.b.pred_b}
                  </span>

                  <span className="h2h-pick__points">
                    {t("common.pointsValue", { value: mecz.b.points })}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function HeadToHeadPage() {
  const t = useT();

  const { slug, userA, userB } = useParams();

  const [dane, setDane] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let anulowane = false;

    async function wczytaj() {
      try {
        setLoading(true);
        setError("");

        // Równolegle, bo żadne z tych zapytań nie potrzebuje wyniku
        // pozostałych - po kolei strona wstawałaby trzy razy dłużej.
        const [profilA, profilB, pojedynek] = await Promise.all([
          getEventPlayerProfile(slug, userA),
          getEventPlayerProfile(slug, userB),
          getHeadToHead(slug, userA, userB),
        ]);

        if (!anulowane) {
          setDane({
            event: pojedynek.event,
            a: profilA.profile,
            b: profilB.profile,
            summary: pojedynek.summary,
            matches: pojedynek.matches,
          });
        }
      } catch (err) {
        if (!anulowane) {
          setError(err.message || t("h2h.errorText"));
        }
      } finally {
        if (!anulowane) setLoading(false);
      }
    }

    wczytaj();

    return () => {
      anulowane = true;
    };
  }, [slug, userA, userB, t]);

  if (loading) {
    return (
      <main className="ui-page">
        <Ladowanie>{t("h2h.loading")}</Ladowanie>
      </main>
    );
  }

  if (error) {
    return (
      <main className="ui-page">
        <BackLink to={`/events/${slug}/leaderboard`}>
          {t("profile.backToLeaderboard")}
        </BackLink>

        <div className="ui-error">
          <span className="ui-error__icon" aria-hidden="true">
            ⚠️
          </span>

          <strong className="ui-error__title">{t("h2h.error")}</strong>

          <p className="ui-error__text">{error}</p>
        </div>
      </main>
    );
  }

  const { a, b, summary, matches } = dane;

  return (
    <main className="ui-page">
      <div className="ui-section-head">
        <div>
          <span className="ui-kicker">{t("h2h.kicker")}</span>

          <h2>
            {t("h2h.title", { a: a.displayname, b: b.displayname })}
          </h2>

          <p>{t("h2h.common", { count: summary.common })}</p>
        </div>

        <BackLink to={`/events/${slug}/player/${a.user_id}`}>
          {t("h2h.backToProfile")}
        </BackLink>
      </div>

      <Tablica a={a} b={b} summary={summary} />

      <Przebieg a={a} b={b} matches={matches} />

      <Statystyki a={a} b={b} />

      <WspolneMecze slug={slug} matches={matches} a={a} b={b} />
    </main>
  );
}

export default HeadToHeadPage;
