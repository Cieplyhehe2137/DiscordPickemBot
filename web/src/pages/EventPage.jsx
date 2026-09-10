import { useEffect, useState } from "react";
import { Link, useOutletContext, useParams } from "react-router-dom";
import { useAuth } from "../auth/useAuth.js";

import {
  getEventSummary,
  getEventStats,
  getEventLeaderboard,
  getEventPlayerProfile,
} from "../lib/api.js";
import BackLink from "../components/BackLink.jsx";
import { phaseRouteLabel, humanPhase } from "../lib/phaseLabels.js";
import { odmien, gracze, typy } from "../lib/odmiana.js";
import Ladowanie from "../components/Ladowanie.jsx";

function formatMatchesCount(count) {
  const number = Number(count) || 0;

  return `${number} ${odmien(number, "mecz", "mecze", "meczów")}`;
}

function formatFinishedCount(count) {
  const number = Number(count) || 0;

  return `${number} ${odmien(number, "zakończony", "zakończone", "zakończonych")}`;
}

function formatScheduledCount(count) {
  const number = Number(count) || 0;

  return `${number} ${odmien(number, "zaplanowany", "zaplanowane", "zaplanowanych")}`;
}

// Klucz fazy z API -> adres na froncie. Swiss ma etap w ścieżce,
// pozostałe fazy mają własne trasy.
function sciezkaFazy(slug, faza) {
  if (faza === "stage1" || faza === "stage2" || faza === "stage3") {
    return `/events/${slug}/swiss/${faza}`;
  }

  return `/events/${slug}/${faza}`;
}

function EventPage() {
  const { slug } = useParams();
  const { user: currentUser, authLoading } = useAuth();
  const { realtimeRefresh } = useOutletContext();

  // Lokalna mapa nie obsługiwała wariantów zapisu, jakie faktycznie są
  // w bazie (SWISS_STAGE_1, DOUBLE_ELIM, NOT_STARTED), więc na ekran
  // trafiał surowy identyfikator. humanPhase() normalizuje je wszystkie.

  const statusLabels = {
    OPEN: "Otwarte",
    CLOSED: "Zamknięte",
    FINISHED: "Zakończone",
  };

  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [eventStats, setEventStats] = useState(null);
  const [loadingEventStats, setLoadingEventStats] = useState(true);
  const [eventStatsError, setEventStatsError] = useState("");
  const [topPlayers, setTopPlayers] = useState([]);
  // Trzymamy profil razem z kluczem (event + gracz), dla ktorego go pobrano.
  // Bez tego po zmianie eventu albo konta przez moment widac stare dane,
  // a zerowanie stanu w ciele efektu wywoluje kaskade renderow.
  const [myEventProfile, setMyEventProfile] = useState(null);

  const kluczProfilu =
    authLoading || !currentUser?.id ? null : `${slug}:${currentUser.id}`;

  const profilEventu =
    kluczProfilu && myEventProfile?.klucz === kluczProfilu
      ? myEventProfile.profil
      : null;

  useEffect(() => {
    if (!kluczProfilu) return undefined;

    let anulowane = false;

    async function loadMyEventProfile() {
      try {
        const data = await getEventPlayerProfile(slug, currentUser.id);

        if (!anulowane) {
          setMyEventProfile({ klucz: kluczProfilu, profil: data.profile ?? null });
        }
      } catch (err) {
        console.error("MY EVENT PROFILE ERROR:", err);

        if (!anulowane) {
          setMyEventProfile({ klucz: kluczProfilu, profil: null });
        }
      }
    }

    loadMyEventProfile();

    return () => {
      anulowane = true;
    };
  }, [kluczProfilu, slug, currentUser?.id]);

  useEffect(() => {
    async function loadEvent() {
      try {
        const data = await getEventSummary(slug);

        setEvent(data);
      } catch (err) {
        console.error("EVENT SUMMARY ERROR:", err);

        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadEvent();
  }, [slug]);

  useEffect(() => {
    async function loadEventStats() {
      try {
        setLoadingEventStats(true);
        setEventStatsError("");

        const data = await getEventStats(slug);

        setEventStats(data.stats ?? null);
      } catch (err) {
        console.error("EVENT STATS ERROR:", err);

        setEventStatsError(
          err.message || "Nie udało się pobrać statystyk eventu.",
        );
      } finally {
        setLoadingEventStats(false);
      }
    }

    loadEventStats();
  }, [slug]);

  useEffect(() => {
    async function loadTopPlayers() {
      try {
        const data = await getEventLeaderboard(slug);

        setTopPlayers((data.leaderboard ?? []).slice(0, 3));
      } catch (err) {
        console.error("TOP PLAYERS ERROR:", err);
      }
    }

    loadTopPlayers();
  }, [slug]);

  useEffect(() => {
    if (!realtimeRefresh?.version) {
      return;
    }

    const payload = realtimeRefresh.payload;

    if (payload?.slug && String(payload.slug) !== String(slug)) {
      return;
    }

    async function refreshEventPage() {
      try {
        const requests = [
          getEventSummary(slug),
          getEventStats(slug),
          getEventLeaderboard(slug),
        ];

        if (!authLoading && currentUser?.id) {
          requests.push(getEventPlayerProfile(slug, currentUser.id));
        }

        const results = await Promise.all(requests);

        const [summaryData, statsData, leaderboardData, profileData] = results;

        setEvent(summaryData);
        setEventStats(statsData.stats ?? null);
        setTopPlayers((leaderboardData.leaderboard ?? []).slice(0, 3));

        if (profileData) {
          setMyEventProfile(profileData.profile ?? null);
        }

        setError(null);
        setEventStatsError("");
      } catch (err) {
        console.error("EVENT PAGE REALTIME REFRESH ERROR:", err);
      }
    }

    refreshEventPage();
  }, [realtimeRefresh, slug, currentUser?.id, authLoading]);

  // Kafelek typowania drużyn pokazuje fazę, w której event JEST teraz.
  // Gdy bieżąca faza nie ma typowania drużyn (albo turniej się skończył),
  // spadamy na ostatnią fazę z wynikiem - żeby kafelek prowadził do czegoś,
  // co da się obejrzeć, zamiast znikać.
  const pickemDruzyn = (() => {
    const dane = event?.pickem_druzyn;
    const fazy = dane?.fazy ?? [];

    if (!fazy.length) return null;

    const aktywna = fazy.find((f) => f.aktywna);

    if (aktywna) {
      return {
        faza: aktywna.faza,
        otwarte: Boolean(aktywna.otwarta),
        opis: aktywna.otwarta
          ? aktywna.mamTyp
            ? "typ zapisany, możesz zmienić"
            : "otwarte — oddaj typ"
          : aktywna.wynikOpublikowany
            ? "rozliczone"
            : "zamknięte",
      };
    }

    const ostatnia = [...fazy].reverse().find((f) => f.wynikOpublikowany) ?? fazy[fazy.length - 1];

    return {
      faza: ostatnia.faza,
      otwarte: false,
      opis: ostatnia.wynikOpublikowany ? "rozliczone" : "zamknięte",
    };
  })();

  return (
    <main className="event-page">
      <BackLink to="/events">Wróć do listy turniejów</BackLink>
      <section className="event-page__hero">
        <span className="events-kicker">Event</span>

        <h1>
          {loading
            ? "Ładowanie..."
            : error
              ? "Błąd"
              : (event?.event?.name ?? slug)}
        </h1>

        {!loading && !error && event && (
          <div className="event-page__meta">
            <span>
              Faza:{" "}
              <strong>
                {humanPhase(event.phase_info?.current) ?? "brak"}
              </strong>
            </span>

            <span
              className={`event-page__status event-page__status--${(
                event.phase_info?.status ?? "unknown"
              ).toLowerCase()}`}
            >
              Status:{" "}
              <strong>
                {statusLabels[event.phase_info?.status] ??
                  event.phase_info?.status ??
                  "brak"}
              </strong>
            </span>

            <span>
              Uczestnicy: <strong>{event.stats?.participants ?? 0}</strong>
            </span>
          </div>
        )}

        {error ? (
          <p>{error}</p>
        ) : (
          <p>
            Centrum eventu — mecze, typy, ranking i aktualny postęp turnieju.
          </p>
        )}
      </section>

      {!loading && !error && event && (
        <>
          <section className="event-stats">
            <div className="event-stat">
              <span>🎯 Mecze</span>

              <strong>{event.stats?.matches ?? 0}</strong>

              <small>
                {formatFinishedCount(event.match_status?.finished)} ·{" "}
                {formatScheduledCount(event.match_status?.scheduled)}
              </small>
            </div>

            <div className="event-stat">
              <span>👥 Uczestnicy</span>

              <strong>{eventStats?.participants ?? 0}</strong>
            </div>

            <div className="event-stat">
              <span>✓ Oddane typy</span>

              <strong>{eventStats?.total_predictions ?? 0}</strong>
            </div>

            <div className="event-stat">
              <span>🗺️ Typy map</span>

              <strong>{eventStats?.total_map_predictions ?? 0}</strong>
            </div>

            <div className="event-stat">
              <span>📊 Średnia punktów</span>

              <strong>{eventStats?.average_points ?? 0}</strong>
            </div>

            <div className="event-stat">
              <span>🎯 Exacty map</span>

              <strong>{eventStats?.exact_maps ?? 0}</strong>
            </div>

            <div className="event-stat">
              <span>🔥 Najlepszy wynik</span>

              <strong>{eventStats?.best_score ?? 0} pkt</strong>

              {eventStats?.best_player && (
                <small>
                  <Link
                    to={`/events/${slug}/player/${eventStats.best_player.user_id}`}
                  >
                    {eventStats.best_player.displayname}
                  </Link>
                </small>
              )}
            </div>

            <div className="event-stat">
              <span>🎯 Najwięcej exactów</span>

              <strong>{eventStats?.best_exact_player?.exact_maps ?? 0}</strong>

              {eventStats?.best_exact_player && (
                <small>
                  <Link
                    to={`/events/${slug}/player/${eventStats.best_exact_player.user_id}`}
                  >
                    {eventStats.best_exact_player.displayname}
                  </Link>
                </small>
              )}
            </div>
            <div className="event-stat">
              <span>🏹 Najlepsza skuteczność</span>

              <strong>
                {eventStats?.best_accuracy_player?.accuracy ?? 0}%
              </strong>

              {eventStats?.best_accuracy_player && (
                <>
                  <small>
                    <Link
                      to={`/events/${slug}/player/${eventStats.best_accuracy_player.user_id}`}
                    >
                      {eventStats.best_accuracy_player.displayname}
                    </Link>
                  </small>

                  <small style={{ display: "block" }}>
                    {eventStats.best_accuracy_player.correct_winners}/
                    {eventStats.best_accuracy_player.finished_predictions}{" "}
                    trafionych
                  </small>
                </>
              )}
            </div>

            {eventStats?.favorite_team && (
              <div className="event-stat">
                <span>💜 Ulubieniec graczy</span>

                <strong>{eventStats.favorite_team.team}</strong>

                <small>{eventStats.favorite_team.picks} {typy(eventStats.favorite_team.picks)}</small>
              </div>
            )}
          </section>

          {loadingEventStats && <Ladowanie>Ładowanie statystyk eventu...</Ladowanie>}

          {eventStatsError && (
            <p className="admin-feedback admin-feedback--error">
              {eventStatsError}
            </p>
          )}

          {profilEventu && (
            <section className="event-my-summary">
              <div className="event-my-summary__header">
                <span className="events-kicker">Twój wynik</span>

                <h2>Twoje podsumowanie eventu</h2>
              </div>

              <div className="event-my-summary__card">
                <div className="event-my-summary__main">
                  <div className="event-my-summary__rank">
                    <span>Miejsce</span>

                    {/* Brak miejsca = nic jeszcze nie rozliczono. Wtedy sam
                        myślnik, bez "#" i bez percentyla liczonego z pustej
                        klasyfikacji. */}
                    <strong>
                      {profilEventu.rank ? `#${profilEventu.rank}` : "—"}
                    </strong>

                    {profilEventu.rank &&
                      profilEventu.event_comparison?.points && (
                        <small>
                          TOP {profilEventu.event_comparison.points.top_percent}
                          %
                        </small>
                      )}
                  </div>

                  <div className="event-my-summary__points">
                    <span>Punkty</span>

                    <strong>{profilEventu.total_points ?? 0}</strong>

                    <small>
                      Seria {profilEventu.series_points ?? 0}
                      {" · "}
                      Mapy {profilEventu.map_points ?? 0}
                    </small>
                  </div>
                </div>

                <div className="event-my-summary__stats">
                  <div>
                    <span>Skuteczność</span>
                    <strong>{profilEventu.accuracy ?? 0}%</strong>
                  </div>

                  <div>
                    <span>Trafione mecze</span>
                    <strong>
                      {profilEventu.correct_winners ?? 0}/
                      {profilEventu.finished_predictions ?? 0}
                    </strong>
                  </div>

                  <div>
                    <span>Exacty map</span>
                    <strong>{profilEventu.exact_maps ?? 0}</strong>
                  </div>

                  <div>
                    <span>Aktualna seria</span>
                    <strong>
                      {profilEventu.current_correct_streak ?? 0}
                    </strong>
                  </div>
                </div>

                <Link
                  className="event-my-summary__profile"
                  to={`/events/${slug}/player/${currentUser.id}`}
                >
                  Zobacz pełny profil →
                </Link>
              </div>
            </section>
          )}

          {topPlayers.length > 0 && (
            <section className="event-podium">
              <div className="event-podium__header">
                <span className="events-kicker">TOP 3</span>

                <h2>Liderzy eventu</h2>
              </div>

              <div
                className={`event-podium__grid event-podium__grid--${topPlayers.length}`}
              >
                {topPlayers.map((player, index) => {
                  // Miejsce z serwera; indeks tylko wtedy, gdy go zabraknie.
                  // Dziś podium bierze zawsze pierwszą stronę rankingu, więc
                  // wychodzi to samo - ale liczenie z indeksu przestaje być
                  // prawdą, jak tylko dane przyjdą z innego wycinka listy.
                  const position = Number(player.rank) || index + 1;

                  return (
                    <Link
                      key={player.user_id}
                      className={`event-podium__player event-podium__player--${position}`}
                      to={`/events/${slug}/player/${player.user_id}`}
                    >
                      <div className="event-podium__medal">
                        {position === 1 ? "🥇" : position === 2 ? "🥈" : "🥉"}
                      </div>

                      {player.avatar ? (
                        <img
                          className="event-podium__avatar"
                          src={`https://cdn.discordapp.com/avatars/${player.user_id}/${player.avatar}.png?size=128`}
                          alt=""
                        />
                      ) : (
                        <div className="event-podium__avatar event-podium__avatar--empty">
                          {player.displayname?.charAt(0)?.toUpperCase() ?? "?"}
                        </div>
                      )}

                      <strong>{player.displayname ?? player.user_id}</strong>

                      <span>{Number(player.total_points ?? 0)} pkt</span>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {eventStats?.closest_match &&
            Number(eventStats.closest_match.total_picks) >= 3 && (
              <section className="event-close-match">
                <div className="event-close-match__header">
                  <span className="events-kicker">
                    ⚔️ Najbardziej wyrównane
                  </span>

                  <h2>Najbardziej podzielony mecz społeczności</h2>
                </div>

                <Link
                  className="event-close-match__card"
                  to={`/events/${slug}/matches/${eventStats.closest_match.match_id}`}
                >
                  <div className="event-close-match__teams">
                    <div>
                      <strong>{eventStats.closest_match.team_a}</strong>
                      <span>{eventStats.closest_match.team_a_percentage}%</span>
                    </div>

                    <div>
                      <strong>{eventStats.closest_match.team_b}</strong>
                      <span>{eventStats.closest_match.team_b_percentage}%</span>
                    </div>
                  </div>

                  <div className="event-close-match__bar">
                    <div
                      className="event-close-match__bar-a"
                      style={{
                        width: `${eventStats.closest_match.team_a_percentage}%`,
                      }}
                    />

                    <div
                      className="event-close-match__bar-b"
                      style={{
                        width: `${eventStats.closest_match.team_b_percentage}%`,
                      }}
                    />
                  </div>

                  <div className="event-close-match__footer">
                    <span>BO{eventStats.closest_match.best_of}</span>

                    <span>{eventStats.closest_match.total_picks} {typy(eventStats.closest_match.total_picks)}</span>
                  </div>
                </Link>
              </section>
            )}

          {eventStats?.biggest_upset &&
            Number(eventStats.biggest_upset.total_picks) >= 3 &&
            Number(eventStats.biggest_upset.winner_percentage) < 50 && (
              <section className="event-upset">
                <div className="event-upset__header">
                  <span className="events-kicker">💥 Największy upset</span>

                  <h2>Społeczność się przeliczyła</h2>
                </div>

                <Link
                  className="event-upset__card"
                  to={`/events/${slug}/matches/${eventStats.biggest_upset.match_id}`}
                >
                  <div className="event-upset__teams">
                    <div>
                      <strong>{eventStats.biggest_upset.team_a}</strong>

                      <span>{eventStats.biggest_upset.team_a_percentage}%</span>

                      {eventStats.biggest_upset.winner ===
                        eventStats.biggest_upset.team_a && (
                        <small>👑 ZWYCIĘZCA</small>
                      )}
                    </div>

                    <div>
                      <strong>{eventStats.biggest_upset.team_b}</strong>

                      <span>{eventStats.biggest_upset.team_b_percentage}%</span>

                      {eventStats.biggest_upset.winner ===
                        eventStats.biggest_upset.team_b && (
                        <small>👑 ZWYCIĘZCA</small>
                      )}
                    </div>
                  </div>

                  <div className="event-upset__bar">
                    <div
                      className="event-upset__bar-a"
                      style={{
                        width: `${eventStats.biggest_upset.team_a_percentage}%`,
                      }}
                    />

                    <div
                      className="event-upset__bar-b"
                      style={{
                        width: `${eventStats.biggest_upset.team_b_percentage}%`,
                      }}
                    />
                  </div>

                  <div className="event-upset__result">
                    <strong>{eventStats.biggest_upset.winner}</strong>

                    <span>
                      wygrał {eventStats.biggest_upset.res_a}:
                      {eventStats.biggest_upset.res_b}
                    </span>
                  </div>

                  <div className="event-upset__footer">
                    <span>
                      Tylko{" "}
                      <strong>
                        {eventStats.biggest_upset.winner_percentage}%
                      </strong>{" "}
                      przewidziało zwycięzcę
                    </span>

                    <span>{eventStats.biggest_upset.total_picks} {typy(eventStats.biggest_upset.total_picks)}</span>
                  </div>
                </Link>
              </section>
            )}

          <section className="event-page__grid">
            <Link
              className="event-section-card event-section-card--matches"
              to={`/events/${slug}/matches`}
            >
              <span>🎯 Mecze</span>

              <strong>
                Typuj BO1 / BO3 / BO5 ·{" "}
                {formatMatchesCount(event.stats?.matches)} ·{" "}
                {formatFinishedCount(event.match_status?.finished)}
              </strong>
            </Link>

            {/* Typowanie DRUŻYN - osobne od typowania meczów.
                Prowadzi wprost do fazy, w której event aktualnie jest,
                bo tylko w niej da się cokolwiek zapisać. */}
            {pickemDruzyn && (
              <Link
                className={
                  pickemDruzyn.otwarte
                    ? "event-section-card event-section-card--pickem event-section-card--pickem-otwarte"
                    : "event-section-card event-section-card--pickem"
                }
                to={sciezkaFazy(slug, pickemDruzyn.faza)}
              >
                <span>🧩 Typowanie drużyn</span>

                <strong>
                  {phaseRouteLabel(pickemDruzyn.faza)}
                  {" · "}
                  {pickemDruzyn.opis}
                </strong>
              </Link>
            )}

            <Link
              className="event-section-card event-section-card--picks"
              to={`/events/${slug}/my-picks`}
            >
              <span>✓ Moje typy</span>

              <strong>
                Zobacz swoje zapisane predykcje ·{" "}
                {event.stats?.my_predictions ?? 0}{" "}
                {typy(event.stats?.my_predictions ?? 0)}
              </strong>
            </Link>

            <Link
              className="event-section-card event-section-card--my-stats"
              to={`/events/${slug}/my-stats`}
            >
              <span>📊 Moje statystyki</span>

              <strong>Skuteczność · forma · analiza · styl · trendy</strong>
            </Link>

            <Link
              className="event-section-card event-section-card--leaderboard"
              to={`/events/${slug}/leaderboard`}
            >
              <span>🏆 Ranking</span>

              <strong>
                Sprawdź tabelę graczy · {event.stats?.participants ?? 0}{" "}
                {gracze(event.stats?.participants ?? 0)}
              </strong>
            </Link>
            {/* Tylko fazy, które ten turniej faktycznie ma. Wcześniej
                wszystkie sześć było wpisane na sztywno, więc event bez
                Play-In i tak go pokazywał, a link prowadził na stronę
                z komunikatem "faza niedostępna". */}
            {(event.pickem_druzyn?.fazy ?? []).length > 0 && (
              <div className="event-page__swiss-links">
                {event.pickem_druzyn.fazy.map((f) => (
                  <Link
                    key={f.faza}
                    className={
                      f.aktywna ? "event-phase-link is-active" : "event-phase-link"
                    }
                    to={sciezkaFazy(slug, f.faza)}
                    title={
                      f.otwarta
                        ? "Typowanie otwarte"
                        : f.wynikOpublikowany
                          ? "Faza rozliczona"
                          : "Faza zamknięta"
                    }
                  >
                    {phaseRouteLabel(f.faza)}

                    {f.mamTyp && <em className="event-phase-link__typ">✓</em>}
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="event-next-match">
            <div className="event-next-match__header">
              <span>Następny mecz</span>
              <h2>
                {event.next_match
                  ? `${event.next_match.team_a} vs ${event.next_match.team_b}`
                  : "Brak zaplanowanego meczu"}
              </h2>
            </div>

            {event.next_match && (
              <>
                <p>
                  BO{event.next_match.best_of} ·{" "}
                  {humanPhase(event.next_match.phase)}
                </p>

                <p>
                  {new Date(event.next_match.start_time_utc).toLocaleString(
                    "pl-PL",
                  )}
                </p>

                <Link to={`/events/${slug}/matches/${event.next_match.id}`}>
                  Przejdź do meczu
                </Link>
              </>
            )}
          </section>

          <section className="event-phases">
            <div className="event-phases__header">
              <span>Turniej</span>

              <h2>Fazy eventu</h2>
            </div>

            <div className="event-phases__current">
              <span>Aktualna faza</span>

              <strong>
                {event.phase_info?.current
                  ? humanPhase(event.phase_info.current)
                  : "Brak aktywnej fazy"}
              </strong>
            </div>

            <div className="event-phases__list">
              {(event.phase_info?.available ?? []).map((phase) => (
                <Link
                  className="event-phases__item"
                  key={phase}
                  to={`/events/${slug}/matches?phase=${phase}`}
                >
                  <span>{humanPhase(phase)}</span>
                </Link>
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  );
}

export default EventPage;
