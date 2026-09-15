import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import BackLink from "../components/BackLink.jsx";
import PlayerAvatar from "../components/PlayerAvatar.jsx";
import Ladowanie from "../components/Ladowanie.jsx";
import { getEventPlayerProfile, getHeadToHead } from "../lib/api.js";
import { betterSide, splitWidths } from "../lib/headToHeadStats.js";
import { odmien } from "../lib/odmiana.js";

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
  { label: "Punkty w klasyfikacji", pole: "total_points" },

  {
    label: "Miejsce w rankingu",
    pole: "rank",
    lowerIsBetter: true,
    format: (v) => (v > 0 ? `#${v}` : "—"),
  },

  { label: "Skuteczność", pole: "accuracy", format: (v) => `${v ?? 0}%` },
  { label: "Trafieni zwycięzcy", pole: "correct_winners" },
  { label: "Dokładne wyniki serii", pole: "exact_series" },
  { label: "Exacty map", pole: "exact_maps" },
  { label: "Trafione mapy", pole: "correct_maps" },
  { label: "Najdłuższa seria", pole: "best_correct_streak" },
  { label: "Komplety", pole: "perfect_matches" },
  { label: "Najlepszy mecz", pole: "best_match_points" },
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
          <>Żaden wspólny mecz nie został jeszcze rozstrzygnięty.</>
        ) : prowadzi ? (
          <>
            <strong>{prowadzi.displayname}</strong> prowadzi o {przewaga}{" "}
            {odmien(przewaga, "mecz", "mecze", "meczów")} przy{" "}
            {summary.ties} {odmien(summary.ties, "remisie", "remisach", "remisach")}{" "}
            na {summary.settled}{" "}
            {odmien(summary.settled, "wspólnym meczu", "wspólnych meczach", "wspólnych meczach")}
            .
          </>
        ) : (
          <>
            Remis po {summary.settled}{" "}
            {odmien(
              summary.settled,
              "wspólnym meczu",
              "wspólnych meczach",
              "wspólnych meczach",
            )}
            .
          </>
        )}
      </p>

      <div className="ui-stats ui-stats--4">
        <div className="ui-stat">
          <span>Punkty ze wspólnych</span>

          <strong className="h2h-board__pair">
            {summary.points_a} : {summary.points_b}
          </strong>

          <small>tylko z rozstrzygniętych meczów</small>
        </div>

        <div className="ui-stat">
          <span>Remisy</span>
          <strong>{summary.ties}</strong>
          <small>tyle samo punktów za mecz</small>
        </div>

        <div className="ui-stat">
          <span>Ten sam typ serii</span>
          <strong>{summary.same_picks}</strong>
          <small>punkty i tak mogą się różnić — decydują mapy</small>
        </div>

        <div className="ui-stat">
          <span>Jeszcze nierozegrane</span>
          <strong>{summary.pending}</strong>
          <small>obstawione przez obu</small>
        </div>
      </div>
    </section>
  );
}

function Statystyki({ a, b }) {
  return (
    <section className="ui-card ui-stack">
      <div className="ui-section-head">
        <div>
          <span className="ui-kicker">Statystyki</span>

          <h2>Cały turniej</h2>

          <p>
            Tu liczy się wszystko, co każdy z nich obstawił — także mecze,
            których ten drugi nie typował.
          </p>
        </div>
      </div>

      <div className="ui-stack ui-stack--tight">
        {WIERSZE.map(({ label, pole, lowerIsBetter, format }) => {
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

              <span className="h2h-row__label">{label}</span>

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
  if (!matches.length) {
    return (
      <section className="ui-card ui-stack">
        <div className="ui-empty">
          <span className="ui-empty__icon" aria-hidden="true">
            🤝
          </span>

          <strong className="ui-empty__title">Brak wspólnych meczów</strong>

          <p className="ui-empty__text">
            Ci dwaj gracze nie obstawili w tym turnieju ani jednego tego samego
            meczu, więc nie ma czego porównać.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="ui-card ui-stack">
      <div className="ui-section-head">
        <div>
          <span className="ui-kicker">Mecz po meczu</span>

          <h2>Wspólne typy</h2>
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
                  <span className="ui-badge ui-badge--warn">Bez wyniku</span>
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

                  <span className="h2h-pick__points">{mecz.a.points} pkt</span>
                </div>

                {/* "Serii", a nie po prostu "ten sam typ". Punkty za mecz to
                    suma punktów za serię I za mapy, więc dwie osoby z tym
                    samym wynikiem serii biorą różne punkty, jeśli różnie
                    obstawiły mapy. Na prawdziwym turnieju dotyczy to 16 z 26
                    takich meczów - bez słowa "serii" identyczny typ obok
                    "5 pkt" i "4 pkt" wygląda jak błąd w danych. */}
                <span className="h2h-match__mid">
                  {mecz.same_pick ? "ten sam typ serii" : "—"}
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

                  <span className="h2h-pick__points">{mecz.b.points} pkt</span>
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
          setError(err.message || "Nie udało się wczytać porównania.");
        }
      } finally {
        if (!anulowane) setLoading(false);
      }
    }

    wczytaj();

    return () => {
      anulowane = true;
    };
  }, [slug, userA, userB]);

  if (loading) {
    return (
      <main className="ui-page">
        <Ladowanie>Liczę pojedynek...</Ladowanie>
      </main>
    );
  }

  if (error) {
    return (
      <main className="ui-page">
        <BackLink to={`/events/${slug}/leaderboard`}>Wróć do rankingu</BackLink>

        <div className="ui-error">
          <span className="ui-error__icon" aria-hidden="true">
            ⚠️
          </span>

          <strong className="ui-error__title">
            Nie udało się wczytać porównania
          </strong>

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
          <span className="ui-kicker">Pojedynek</span>

          <h2>
            {a.displayname} kontra {b.displayname}
          </h2>

          <p>
            {summary.common}{" "}
            {odmien(
              summary.common,
              "wspólny mecz",
              "wspólne mecze",
              "wspólnych meczów",
            )}{" "}
            w tym turnieju
          </p>
        </div>

        <BackLink to={`/events/${slug}/player/${a.user_id}`}>
          Wróć do profilu
        </BackLink>
      </div>

      <Tablica a={a} b={b} summary={summary} />

      <Statystyki a={a} b={b} />

      <WspolneMecze slug={slug} matches={matches} a={a} b={b} />
    </main>
  );
}

export default HeadToHeadPage;
