import { useEffect, useState } from "react";
import { Link, useOutletContext, useParams } from "react-router-dom";

import { getEventLeaderboard } from "../lib/api.js";
import { odmien } from "../lib/odmiana.js";
import { useAuth } from "../auth/useAuth.js";

// Rozbicie punktów na fazy. Wcześniej sklejane w jeden szary ciąg
// ("Swiss 42 · Playoffs 4"), w którym nie dało się nic wyłowić wzrokiem.
function rozbicieNaFazy(player) {
  return [
    ["Swiss", player.swiss_points],
    ["Play-In", player.playin_points],
    ["Playoffs", player.playoffs_points],
    ["Double Elim", player.doubleelim_points],
    ["Mecze", player.phase_match_points],
    ["MVP", player.mvp_points],
  ].filter(([, punkty]) => Number(punkty) > 0);
}

// Klasa miejsca na podium. Tablica, a nie sklejanie `ui-row-item--${rank}`:
// przy sklejaniu nazwa nie wystepuje w kodzie doslownie, wiec narzedzie do
// usuwania martwego CSS nie widzi jej jako uzywanej i skasowaloby cale
// podium razem z medalami.
const PODIUM = {
  1: " ui-row-item--1",
  2: " ui-row-item--2",
  3: " ui-row-item--3",
};

function LeaderboardPage() {
  const { slug } = useParams();
  const { realtimeRefresh } = useOutletContext();
  const { user } = useAuth();
  const [leaderboard, setLeaderboard] = useState([]);
  const [uczestnicy, setUczestnicy] = useState(0);
  const [strony, setStrony] = useState(null);

  // Numer strony trzymamy razem z turniejem, dla którego go wybrano.
  // Dzięki temu wejście na inny turniej wraca na stronę 1 samo, bez
  // zerowania stanu w efekcie (to wywołuje kaskadę renderów).
  const [wybranaStrona, setWybranaStrona] = useState({ slug, numer: 1 });

  const strona = wybranaStrona.slug === slug ? wybranaStrona.numer : 1;

  const idzDoStrony = (numer) => setWybranaStrona({ slug, numer });

  // To, co wpisano, i to, czego faktycznie szukamy, to dwie różne rzeczy -
  // bez odczekania każde naciśnięcie klawisza byłoby osobnym zapytaniem.
  const [wpisane, setWpisane] = useState("");
  const [szukane, setSzukane] = useState({ slug, fraza: "" });

  const szukaj = szukane.slug === slug ? szukane.fraza : "";

  // Skok do własnego miejsca: serwer sam liczy, na której stronie stoi gracz.
  const [znajdz, setZnajdz] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const licznik = setTimeout(() => {
      setSzukane({ slug, fraza: wpisane.trim() });
      setWybranaStrona({ slug, numer: 1 });
    }, 350);

    return () => clearTimeout(licznik);
  }, [wpisane, slug]);

  useEffect(() => {
    async function loadLeaderboard() {
      try {
        setLoading(true);
        setError(null);

        const data = await getEventLeaderboard(slug, {
          strona,
          szukaj,
          znajdz,
        });

        setLeaderboard(data.leaderboard ?? []);
        setUczestnicy(Number(data.uczestnicy) || 0);
        setStrony(data.strony ?? null);

        // Skok jest jednorazowy - inaczej każde kliknięcie "Następna"
        // wracałoby na stronę z naszym miejscem.
        if (znajdz && data.strony?.numer) {
          setWybranaStrona({ slug, numer: data.strony.numer });
          setZnajdz(null);
        }
      } catch (err) {
        console.error("LEADERBOARD ERROR:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadLeaderboard();
  }, [slug, strona, szukaj, znajdz]);

  useEffect(() => {
    if (!realtimeRefresh?.version) {
      return;
    }

    const payload = realtimeRefresh.payload;

    if (payload?.slug && String(payload.slug) !== String(slug)) {
      return;
    }

    async function refreshLeaderboard() {
      try {
        const data = await getEventLeaderboard(slug, { strona, szukaj });

        setLeaderboard(data.leaderboard ?? []);
        setUczestnicy(Number(data.uczestnicy) || 0);
        setStrony(data.strony ?? null);
        setError(null);
      } catch (err) {
        console.error("LEADERBOARD REALTIME REFRESH ERROR:", err);
      }
    }

    refreshLeaderboard();
  }, [realtimeRefresh, slug, strona, szukaj]);

  // Szkielet zamiast spinnera: lista od razu pokazuje, ile wierszy będzie,
  // więc układ nie skacze w chwili, gdy dane dojdą.
  if (loading) {
    return (
      <main className="ui-page">
        <div className="ui-section-head">
          <div>
            <span className="ui-kicker">Ranking</span>
            <h2>Ranking graczy</h2>
          </div>
        </div>

        <div
          className="ui-table"
          aria-busy="true"
          aria-label="Ładowanie rankingu"
        >
          {Array.from({ length: 8 }, (_, i) => (
            <div className="ui-skeleton ui-skeleton--row" key={i} />
          ))}
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
            Nie udało się wczytać rankingu
          </strong>

          <p className="ui-error__text">{error}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="ui-page">
      <div className="ui-section-head">
        <div>
          <span className="ui-kicker">Ranking</span>

          <h2>Ranking graczy</h2>

          {strony?.wRankingu > 0 && (
            <p>
              {strony.wRankingu}{" "}
              {odmien(strony.wRankingu, "gracz", "gracze", "graczy")} w
              klasyfikacji
            </p>
          )}
        </div>

        <Link
          className="ui-btn ui-btn--ghost ui-btn--sm"
          to={`/events/${slug}`}
        >
          ← Wróć do eventu
        </Link>
      </div>

      {/* Przy 500 graczach na 11 stronach jedyną drogą do własnego miejsca
          było klikanie "Następna" dziewięć razy. */}
      <div className="ui-row ui-row--wrap leaderboard-szukaj">
        <input
          type="search"
          value={wpisane}
          onChange={(e) => setWpisane(e.target.value)}
          placeholder="Szukaj gracza po nicku..."
          aria-label="Szukaj gracza"
        />

        {user?.id && (
          <button
            type="button"
            className="ui-btn ui-btn--sm"
            onClick={() => setZnajdz(user.id)}
          >
            Znajdź mnie
          </button>
        )}
      </div>

      {szukaj && strony && (
        <p className="ui-stat__hint">
          {strony.wszystkich > 0 ? (
            <>
              Znaleziono <strong>{strony.wszystkich}</strong> z{" "}
              {strony.wRankingu}{" "}
              {odmien(strony.wRankingu, "gracza", "graczy", "graczy")}
            </>
          ) : (
            <>
              Nikt nie pasuje do <strong>{szukaj}</strong>
            </>
          )}
        </p>
      )}

      {leaderboard.length === 0 ? (
        <div className="ui-empty">
          <span className="ui-empty__icon" aria-hidden="true">
            {uczestnicy > 0 ? "⏳" : "🎯"}
          </span>

          {uczestnicy > 0 ? (
            <>
              <strong className="ui-empty__title">
                Ranking jeszcze się nie zaczął
              </strong>

              <p className="ui-empty__text">
                Ten event ma już {uczestnicy}{" "}
                {odmien(uczestnicy, "gracza", "graczy", "graczy")} z oddanymi
                typami, ale nikt nie ma jeszcze punktów — pojawią się po
                pierwszych rozliczonych meczach i fazach.
              </p>
            </>
          ) : (
            <>
              <strong className="ui-empty__title">
                Nikt jeszcze nie typował
              </strong>

              <p className="ui-empty__text">
                Ranking pojawi się, gdy pierwsi gracze oddadzą typy.
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="ui-table">
          <div className="ui-table__head" aria-hidden="true">
            <span>#</span>
            <span>Gracz</span>
            <span>Rozbicie</span>
            <span>Punkty</span>
          </div>

          {leaderboard.map((player) => {
            // Miejsce bierzemy z pola rank, policzonego po stronie serwera na
            // pełnej liście. Wcześniej szło z indeksu w tablicy, więc każda
            // strona zaczynała się od pierwszego miejsca i medali.
            const podium = PODIUM[player.rank] ?? "";

            const ja =
              user?.id && String(user.id) === String(player.user_id)
                ? " ui-row-item--me"
                : "";

            const fazy = rozbicieNaFazy(player);

            return (
              <div className={`ui-row-item${podium}${ja}`} key={player.user_id}>
                <span className="ui-row-item__rank">{player.rank}</span>

                <Link
                  className="ui-row-item__who"
                  to={`/events/${slug}/player/${player.user_id}`}
                >
                  {/* Awatar zawsze zajmuje miejsce - bez tego wiersze graczy
                      bez awatara były węższe i lista falowała. */}
                  {player.avatar ? (
                    <img
                      className="ui-avatar"
                      src={`https://cdn.discordapp.com/avatars/${player.user_id}/${player.avatar}.png?size=64`}
                      alt=""
                      loading="lazy"
                    />
                  ) : (
                    <span className="ui-avatar" aria-hidden="true" />
                  )}

                  <span className="ui-row-item__name">
                    {player.displayname ?? player.user_id}
                  </span>
                </Link>

                <div className="ui-row-item__meta">
                  {fazy.length > 0 ? (
                    fazy.map(([nazwa, punkty]) => (
                      <span className="ui-badge" key={nazwa}>
                        {nazwa} {punkty}
                      </span>
                    ))
                  ) : (
                    <span>brak punktów</span>
                  )}
                </div>

                <strong className="ui-row-item__score">
                  {Number(player.total_points ?? 0)}
                </strong>
              </div>
            );
          })}
        </div>
      )}

      {/* Pasek stron pokazuje się dopiero, gdy jest co przewijać. */}
      {strony && strony.ile > 1 && (
        <nav
          className="ui-row ui-row--between leaderboard-strony"
          aria-label="Strony rankingu"
        >
          <button
            type="button"
            className="ui-btn ui-btn--ghost ui-btn--sm"
            disabled={strona <= 1}
            onClick={() => idzDoStrony(strona - 1)}
          >
            ← Poprzednia
          </button>

          <span className="ui-stat__hint">
            Strona <strong>{strony.numer}</strong> z {strony.ile}
          </span>

          <button
            type="button"
            className="ui-btn ui-btn--ghost ui-btn--sm"
            disabled={strona >= strony.ile}
            onClick={() => idzDoStrony(strona + 1)}
          >
            Następna →
          </button>
        </nav>
      )}
    </main>
  );
}

export default LeaderboardPage;
