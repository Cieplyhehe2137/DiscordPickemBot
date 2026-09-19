import { useEffect, useState } from "react";
import { Link, useOutletContext, useParams } from "react-router-dom";
import { useAuth } from "../auth/useAuth.js";

import {
  getEventSummary,
  getEventStats,
  getEventLeaderboard,
  getEventPlayerProfile,
  getEventMvp,
  eventArchiveUrl,
} from "../lib/api.js";
import BackLink from "../components/BackLink.jsx";
import TournamentOutcome from "../components/TournamentOutcome.jsx";
import { phaseRouteLabel, humanPhase } from "../lib/phaseLabels.js";
import { winnerFirstScore, nobodyPickedWinner } from "../lib/upset.js";
import Ladowanie from "../components/Ladowanie.jsx";
import { T } from "../i18n/T.jsx";
import { useLanguage } from "../i18n/useLanguage.js";

// Liczniki biorą tłumacza, bo liczba mnoga jest częścią zdania, a nie
// czymś doklejanym po liczbie - patrz i18n/translate.js.
function formatMatchesCount(t, count) {
  return t("event.matchesCount", { count: Number(count) || 0 });
}

function formatFinishedCount(t, count) {
  return t("event.finishedCount", { count: Number(count) || 0 });
}

function formatScheduledCount(t, count) {
  return t("event.scheduledCount", { count: Number(count) || 0 });
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
  const { jezyk, t } = useLanguage();

  const { slug } = useParams();
  const { user: currentUser, authLoading } = useAuth();
  const { realtimeRefresh } = useOutletContext();

  // Lokalna mapa nie obsługiwała wariantów zapisu, jakie faktycznie są
  // w bazie (SWISS_STAGE_1, DOUBLE_ELIM, NOT_STARTED), więc na ekran
  // trafiał surowy identyfikator. humanPhase() normalizuje je wszystkie.

  const statusLabels = {
    OPEN: t("event.status.open"),
    CLOSED: t("event.status.closed"),
    FINISHED: t("event.status.finished"),
  };

  // Ton plakietki statusu. Tablica, a nie sklejanie nazwy klasy z wartości:
  // klasa zbudowana przez `--${status}` nie występuje w źródle dosłownie,
  // więc przegląd martwego CSS-a jej nie widzi i kasuje regułę. Wcześniej
  // stała tu właśnie taka sklejanka i nie miała ani jednej reguły - status
  // wyglądał identycznie niezależnie od tego, co mówił.
  const STATUS_TONES = {
    OPEN: "ui-badge ui-badge--ok",
    CLOSED: "ui-badge ui-badge--warn",
    FINISHED: "ui-badge",
  };

  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [eventStats, setEventStats] = useState(null);
  const [loadingEventStats, setLoadingEventStats] = useState(true);
  const [eventStatsError, setEventStatsError] = useState("");
  const [topPlayers, setTopPlayers] = useState([]);

  const [mvp, setMvp] = useState(null);
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
          err.message || t("event.statsError"),
        );
      } finally {
        setLoadingEventStats(false);
      }
    }

    loadEventStats();
  }, [slug, t]);

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

  // Głosowanie na MVP. Osobne pobranie, tak samo jak reszta sekcji na tej
  // stronie - i celowo BEZ zgłaszania błędu na ekran: nie każdy turniej ma
  // MVP, a brak sekcji jest tu stanem normalnym, nie awarią.
  useEffect(() => {
    async function loadMvp() {
      try {
        const data = await getEventMvp(slug);

        setMvp(data);
      } catch (err) {
        console.error("MVP VOTE ERROR:", err);
      }
    }

    loadMvp();
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

  // Czy ten turniej miał w ogóle fazę Swiss. Lista faz przychodzi
  // z /summary i zawiera stage1..3 tylko tam, gdzie Swiss był rozgrywany.
  const maSwiss = (event?.pickem_druzyn?.fazy ?? []).some((f) =>
    String(f.faza).startsWith("stage"),
  );

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
            ? t("event.teamPick.saved")
            : t("event.teamPick.open")
          : aktywna.wynikOpublikowany
            ? t("event.teamPick.settled")
            : t("event.teamPick.closed"),
      };
    }

    const ostatnia = [...fazy].reverse().find((f) => f.wynikOpublikowany) ?? fazy[fazy.length - 1];

    return {
      faza: ostatnia.faza,
      otwarte: false,
      opis: ostatnia.wynikOpublikowany
        ? t("event.teamPick.settled")
        : t("event.teamPick.closed"),
    };
  })();

  return (
    <main className="ui-page">
      <BackLink to="/events">{t("event.backToList")}</BackLink>
      <section className="event-page__hero">
        <span className="ui-kicker">{t("event.kicker")}</span>

        <h1>
          {loading
            ? t("common.loading")
            : error
              ? t("event.error")
              : (event?.event?.name ?? slug)}
        </h1>

        {!loading && !error && event && (
          <div className="event-page__meta">
            <span>
              {t("event.phaseLabel")}{" "}
              <strong>
                {humanPhase(event.phase_info?.current, t) ?? t("event.none")}
              </strong>
            </span>

            <span>
              {t("event.statusLabel")}{" "}
              <span
                className={STATUS_TONES[event.phase_info?.status] ?? "ui-badge"}
              >
                {statusLabels[event.phase_info?.status] ??
                  event.phase_info?.status ??
                  t("event.none")}
              </span>
            </span>

            <span>
              {t("event.participantsLabel")}{" "}
              <strong>{event.stats?.participants ?? 0}</strong>
            </span>
          </div>
        )}


        {error ? (
          <p>{error}</p>
        ) : (
          <p>{t("event.intro")}</p>
        )}

        {/* Archiwum całego turnieju w jednym pliku: klasyfikacja, typy
            wszystkich graczy w każdej fazie, mecze i mapy.

            Stoi POD zdaniem opisu, a nie między pigułkami "Faza" i
            "Uczestnicy". Tam było czwartym prostokątem z tą samą ramką co
            trzy etykiety nad nim i czytało się jak kolejna informacja,
            a nie jak coś do kliknięcia. Kolejność czytania jest teraz
            naturalna: etykiety, zdanie, działanie.

            Pokazywane dopiero po zarchiwizowaniu, bo tylko wtedy serwer je
            wydaje - dla turnieju w toku odpowiada 409. Przycisk, który
            odpowiada błędem, jest gorszy niż brak przycisku.

            Zwykły link, nie fetch: przeglądarka ma sama zapisać plik,
            a pierwsze pobranie potrafi trwać kilka sekund. */}
        {!loading && !error && event?.event?.is_archived && (
          <a
            className="ui-btn ui-btn--accent event-page__archive"
            href={eventArchiveUrl(slug)}
          >
            ⬇️ {t("event.archive")}
          </a>
        )}
      </section>

      {!loading && !error && event && (
        <>
          {/* Dziesięć kafelków: pięć i pięć. Bez ustalonej liczby kolumn
              auto-fit daje przy 1440 px siedem, czyli 7 + 3. */}
          <section className="ui-stats ui-stats--5">
            <div className="ui-stat">
              <span>🎯 {t("event.stat.matches")}</span>

              <strong>{event.stats?.matches ?? 0}</strong>

              <small>
                {formatFinishedCount(t, event.match_status?.finished)} ·{" "}
                {formatScheduledCount(t, event.match_status?.scheduled)}
              </small>
            </div>

            <div className="ui-stat">
              <span>👥 {t("event.stat.participants")}</span>

              <strong>{eventStats?.participants ?? 0}</strong>
            </div>

            <div className="ui-stat">
              <span>✓ {t("event.stat.predictions")}</span>

              <strong>{eventStats?.total_predictions ?? 0}</strong>
            </div>

            <div className="ui-stat">
              <span>🗺️ {t("event.stat.mapPredictions")}</span>

              <strong>{eventStats?.total_map_predictions ?? 0}</strong>
            </div>

            <div className="ui-stat">
              <span>📊 {t("event.stat.averagePoints")}</span>

              <strong>{eventStats?.average_points ?? 0}</strong>
            </div>

            <div className="ui-stat">
              <span>🎯 {t("event.stat.exactMaps")}</span>

              <strong>{eventStats?.exact_maps ?? 0}</strong>
            </div>

            <div className="ui-stat">
              <span>🔥 {t("event.stat.bestScore")}</span>

              <strong>
                {t("common.pointsValue", { value: eventStats?.best_score ?? 0 })}
              </strong>

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

            <div className="ui-stat">
              <span>🎯 {t("event.stat.mostExacts")}</span>

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
            <div className="ui-stat">
              <span>🏹 {t("event.stat.bestAccuracy")}</span>

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

                  <small>
                    {t("event.stat.correctOf", {
                      correct: eventStats.best_accuracy_player.correct_winners,
                      total:
                        eventStats.best_accuracy_player.finished_predictions,
                    })}
                  </small>
                </>
              )}
            </div>

            {eventStats?.favorite_team && (
              // Wartością jest nazwa drużyny, a nie liczba - stąd wariant
              // tekstowy. Przy 375 px "GamerLegion" w rozmiarze dla liczb
              // wychodziło poza kafelek i rozpychało stronę w poziomie.
              <div className="ui-stat ui-stat--text">
                <span>💜 {t("event.stat.favoriteTeam")}</span>

                <strong>{eventStats.favorite_team.team}</strong>

                <small>
                  {t("event.picksCount", {
                    count: eventStats.favorite_team.picks,
                  })}
                </small>
              </div>
            )}
          </section>

          {loadingEventStats && (
            <Ladowanie>{t("event.statsLoading")}</Ladowanie>
          )}

          {eventStatsError && (
            <p className="ui-note ui-note--danger">
              {eventStatsError}
            </p>
          )}

          {profilEventu && (
            <section className="ui-stack ui-stack--loose">
              <div className="ui-section-head">
                <div>
                  <span className="ui-kicker">{t("event.summary.kicker")}</span>

                  <h2>{t("event.summary.title")}</h2>
                </div>
              </div>

              <div className="ui-card ui-stack ui-stack--loose">
                <div className="ui-stats">
                  <div className="ui-stat">
                    <span>{t("event.summary.place")}</span>

                    {/* Brak miejsca = nic jeszcze nie rozliczono. Wtedy sam
                        myślnik, bez "#" i bez percentyla liczonego z pustej
                        klasyfikacji. */}
                    <strong>
                      {profilEventu.rank ? `#${profilEventu.rank}` : "—"}
                    </strong>

                    {profilEventu.rank &&
                      profilEventu.event_comparison?.points && (
                        <small>
                          {t("history.top", {
                            percent:
                              profilEventu.event_comparison.points.top_percent,
                          })}
                        </small>
                      )}
                  </div>

                  <div className="ui-stat ui-stat--featured">
                    <span>{t("profile.points")}</span>

                    <strong>{profilEventu.total_points ?? 0}</strong>

                    <small>
                      {t("event.summary.split", {
                        series: profilEventu.series_points ?? 0,
                        maps: profilEventu.map_points ?? 0,
                      })}
                    </small>
                  </div>
                </div>

                <div className="ui-stats">
                  <div className="ui-stat">
                    <span>{t("profile.accuracy")}</span>
                    <strong>{profilEventu.accuracy ?? 0}%</strong>
                  </div>

                  <div className="ui-stat">
                    <span>{t("event.summary.correctMatches")}</span>
                    <strong>
                      {profilEventu.correct_winners ?? 0}/
                      {profilEventu.finished_predictions ?? 0}
                    </strong>
                  </div>

                  <div className="ui-stat">
                    <span>{t("profile.exactMaps")}</span>
                    <strong>{profilEventu.exact_maps ?? 0}</strong>
                  </div>

                  <div className="ui-stat">
                    <span>{t("profile.currentStreak")}</span>
                    <strong>
                      {profilEventu.current_correct_streak ?? 0}
                    </strong>
                  </div>
                </div>

                <Link
                  className="ui-btn ui-btn--ghost ui-btn--sm"
                  to={`/events/${slug}/player/${currentUser.id}`}
                >
                  {t("event.summary.fullProfile")}
                </Link>
              </div>
            </section>
          )}

          {topPlayers.length > 0 && (
            <section className="ui-stack ui-stack--loose">
              <div className="ui-section-head">
                <div>
                  <span className="ui-kicker">TOP 3</span>

                  <h2>{t("event.top.title")}</h2>
                </div>
              </div>

              <div className="ui-tiles">
                {topPlayers.map((player, index) => {
                  // Miejsce z serwera; indeks tylko wtedy, gdy go zabraknie.
                  // Dziś podium bierze zawsze pierwszą stronę rankingu, więc
                  // wychodzi to samo - ale liczenie z indeksu przestaje być
                  // prawdą, jak tylko dane przyjdą z innego wycinka listy.
                  const position = Number(player.rank) || index + 1;

                  return (
                    <Link
                      key={player.user_id}
                      className={`ui-card ui-card--interactive ui-tile ${
                        ["", "ui-card--gold", "ui-card--silver", "ui-card--bronze"][
                          position
                        ] ?? ""
                      }`}
                      to={`/events/${slug}/player/${player.user_id}`}
                    >
                      <div className="ui-row ui-row--full">
                        {player.avatar ? (
                          <img
                            className="ui-avatar ui-avatar--lg"
                            src={`https://cdn.discordapp.com/avatars/${player.user_id}/${player.avatar}.png?size=128`}
                            alt=""
                          />
                        ) : (
                          <span className="ui-avatar ui-avatar--lg ui-avatar--initials">
                            {player.displayname?.charAt(0)?.toUpperCase() ?? "?"}
                          </span>
                        )}

                        <span className="ui-badge">
                          {position === 1 ? "🥇" : position === 2 ? "🥈" : "🥉"}{" "}
                          {t("event.top.place", { no: position })}
                        </span>
                      </div>

                      <strong className="ui-tile__name">
                        {player.displayname ?? player.user_id}
                      </strong>

                      <span className="ui-stat__value ui-tile__meta">
                        {Number(player.total_points ?? 0)}
                        <small className="ui-stat__hint">
                          {" "}
                          {t("badge.unitPoints").trim()}
                        </small>
                      </span>
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
                  <span className="ui-kicker">
                    ⚔️ {t("event.close.kicker")}
                  </span>

                  <h2>{t("event.close.title")}</h2>
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

                  <div className="ui-split">
                    <div
                      className="ui-split__a"
                      style={{
                        width: `${eventStats.closest_match.team_a_percentage}%`,
                      }}
                    />

                    <div
                      className="ui-split__b"
                      style={{
                        width: `${eventStats.closest_match.team_b_percentage}%`,
                      }}
                    />
                  </div>

                  <div className="event-close-match__footer">
                    <span>BO{eventStats.closest_match.best_of}</span>

                    <span>
                      {t("event.picksCount", {
                        count: eventStats.closest_match.total_picks,
                      })}
                    </span>
                  </div>
                </Link>
              </section>
            )}

          {eventStats?.biggest_upset &&
            Number(eventStats.biggest_upset.total_picks) >= 3 &&
            Number(eventStats.biggest_upset.winner_percentage) < 50 && (
              <section className="event-upset">
                <div className="event-upset__header">
                  <span className="ui-kicker">
                    💥 {t("event.upset.kicker")}
                  </span>

                  <h2>{t("event.upset.title")}</h2>
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
                        <small>👑 {t("event.upset.winner")}</small>
                      )}
                    </div>

                    <div>
                      <strong>{eventStats.biggest_upset.team_b}</strong>

                      <span>{eventStats.biggest_upset.team_b_percentage}%</span>

                      {eventStats.biggest_upset.winner ===
                        eventStats.biggest_upset.team_b && (
                        <small>👑 {t("event.upset.winner")}</small>
                      )}
                    </div>
                  </div>

                  <div className="ui-split">
                    <div
                      className="ui-split__a"
                      style={{
                        width: `${eventStats.biggest_upset.team_a_percentage}%`,
                      }}
                    />

                    <div
                      className="ui-split__b"
                      style={{
                        width: `${eventStats.biggest_upset.team_b_percentage}%`,
                      }}
                    />
                  </div>

                  <div className="event-upset__result">
                    <strong>{eventStats.biggest_upset.winner}</strong>

                    <span>
                      {t("event.upset.won", {
                        score: winnerFirstScore(eventStats.biggest_upset),
                      })}
                    </span>
                  </div>

                  <div className="event-upset__footer">
                    <span>
                      {nobodyPickedWinner(eventStats.biggest_upset) ? (
                        <strong>{t("event.upset.nobody")}</strong>
                      ) : (
                        <T
                          k="event.upset.only"
                          vars={{
                            percent: (
                              <strong>
                                {eventStats.biggest_upset.winner_percentage}%
                              </strong>
                            ),
                          }}
                        />
                      )}
                    </span>

                    <span>
                      {t("event.picksCount", {
                        count: eventStats.biggest_upset.total_picks,
                      })}
                    </span>
                  </div>
                </Link>
              </section>
            )}

          {/* Wynik turnieju: mistrz, finaliści i trafność społeczności.

              Stoi przy głosowaniu na MVP, bo obie sekcje odpowiadają na to
              samo pytanie - jak to się skończyło - i obie pobierają się
              osobno, więc żadna nie opóźnia reszty strony.

              Znika dla turnieju bez rozstrzygnięcia. */}
          <TournamentOutcome slug={slug} />

          {/* Głosowanie na MVP. Cztery tabele w bazie, a do tej pory było je
              widać wyłącznie w panelu administratora - i to mimo że kryje
              największą pomyłkę w historii serwisu: w IEM Cologne trafiły
              trzy osoby z dziewięćdziesięciu dziewięciu.

              Sekcja znika, gdy nikt nie głosował. Nie każdy turniej ma MVP:
              kandydatów musi najpierw ustawić administrator. */}
          {mvp && mvp.total_votes > 0 && (
            <section className="ui-card ui-stack">
              <div className="ui-section-head">
                <div>
                  <span className="ui-kicker">🏆 {t("mvp.kicker")}</span>

                  <h2>{t("mvp.title")}</h2>

                  <p>
                    {mvp.resolved
                      ? t("mvp.resolved", {
                          nickname: mvp.winner.nickname,
                          percent: mvp.hit_rate,
                        })
                      : t("mvp.open", { count: mvp.total_votes })}
                  </p>
                </div>
              </div>

              <div className="ui-table">
                <div className="ui-table__head" aria-hidden="true">
                  <span>#</span>
                  <span>{t("mvp.head.player")}</span>
                  <span>{t("mvp.head.votes")}</span>
                  <span>{t("mvp.head.share")}</span>
                </div>

                {mvp.candidates.map((kandydat, i) => (
                  <div
                    className={`ui-row-item${
                      kandydat.won ? " mvp-row--winner" : ""
                    }`}
                    key={kandydat.candidate_id}
                  >
                    {/* Numer to miejsce W GŁOSOWANIU, nie w turnieju -
                        zwycięzca stoi tam, gdzie postawiła go społeczność,
                        i o to w tej tabeli chodzi. */}
                    <span className="ui-row-item__rank">{i + 1}</span>

                    <span className="ui-row-item__who">
                      <span className="ui-row-item__stack">
                        <span className="ui-row-item__name">
                          {kandydat.won && <span aria-hidden="true">👑 </span>}
                          {kandydat.nickname}
                        </span>

                        {kandydat.team_name && (
                          <span className="ui-row-item__sub">
                            {kandydat.team_name}
                          </span>
                        )}
                      </span>
                    </span>

                    <div className="ui-row-item__meta">
                      <span className="ui-badge">
                        {t("mvp.votes", { count: kandydat.votes })}
                      </span>
                    </div>

                    <strong className="ui-row-item__score">
                      {t("common.percentValue", { percent: kandydat.share })}
                    </strong>
                  </div>
                ))}
              </div>

              <p className="ui-note">
                {t("mvp.note", { count: mvp.total_votes })}
              </p>
            </section>
          )}

          <section className="ui-tiles">
            <Link
              className="ui-card ui-card--interactive ui-tile"
              to={`/events/${slug}/matches`}
            >
              <span>🎯 {t("event.tile.matches")}</span>

              <strong>
                {t("event.tile.matchesHint", {
                  matches: formatMatchesCount(t, event.stats?.matches),
                  finished: formatFinishedCount(
                    t,
                    event.match_status?.finished,
                  ),
                })}
              </strong>
            </Link>

            {/* Typy na fazy Swiss zestawione z tym, co się stało. Kafelek
                tylko dla turniejów, które Swiss w ogóle miały - IEM Kraków
                2026 grał play-in i double elim, więc tam ta strona nie ma
                czego pokazać. */}
            {maSwiss && (
              <Link
                className="ui-card ui-card--interactive ui-tile"
                to={`/events/${slug}/phase-picks`}
              >
                <span>🇨🇭 {t("swissPicks.link")}</span>

                <strong>{t("swissPicks.kicker")}</strong>
              </Link>
            )}

            {/* Typowanie DRUŻYN - osobne od typowania meczów.
                Prowadzi wprost do fazy, w której event aktualnie jest,
                bo tylko w niej da się cokolwiek zapisać. */}
            {pickemDruzyn && (
              <Link
                className={
                  pickemDruzyn.otwarte
                    ? "ui-card ui-card--interactive ui-card--accent ui-tile"
                    : "ui-card ui-card--interactive ui-tile"
                }
                to={sciezkaFazy(slug, pickemDruzyn.faza)}
              >
                <span>🧩 {t("event.tile.teamPicks")}</span>

                <strong>
                  {phaseRouteLabel(pickemDruzyn.faza, t)}
                  {" · "}
                  {pickemDruzyn.opis}
                </strong>
              </Link>
            )}

            <Link
              className="ui-card ui-card--interactive ui-tile"
              to={`/events/${slug}/my-picks`}
            >
              <span>✓ {t("event.tile.myPicks")}</span>

              <strong>
                {t("event.tile.myPicksHint", {
                  picks: t("event.picksCount", {
                    count: event.stats?.my_predictions ?? 0,
                  }),
                })}
              </strong>
            </Link>

            <Link
              className="ui-card ui-card--interactive ui-tile"
              to={`/events/${slug}/my-stats`}
            >
              <span>📊 {t("event.tile.myStats")}</span>

              <strong>{t("event.tile.myStatsHint")}</strong>
            </Link>

            <Link
              className="ui-card ui-card--interactive ui-tile"
              to={`/events/${slug}/leaderboard`}
            >
              <span>🏆 {t("event.tile.leaderboard")}</span>

              <strong>
                {t("event.tile.leaderboardHint", {
                  players: t("common.playersCount", {
                    count: event.stats?.participants ?? 0,
                  }),
                })}
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
                        ? t("matchState.open")
                        : f.wynikOpublikowany
                          ? t("event.phaseLink.settled")
                          : t("event.phaseLink.closed")
                    }
                  >
                    {phaseRouteLabel(f.faza, t)}

                    {f.mamTyp && <em className="event-phase-link__pick">✓</em>}
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="event-next-match">
            <div className="event-next-match__header">
              <span>{t("event.nextMatch")}</span>
              <h2>
                {event.next_match
                  ? `${event.next_match.team_a} vs ${event.next_match.team_b}`
                  : t("event.noNextMatch")}
              </h2>
            </div>

            {event.next_match && (
              <>
                <p>
                  BO{event.next_match.best_of} ·{" "}
                  {humanPhase(event.next_match.phase, t)}
                </p>

                <p>
                  {/* Data w formacie wybranego języka - 14.09.2026 po
                      polsku i niemiecku, 9/14/2026 po angielsku. */}
                  {new Date(event.next_match.start_time_utc).toLocaleString(
                    jezyk,
                  )}
                </p>

                <Link to={`/events/${slug}/matches/${event.next_match.id}`}>
                  {t("event.goToMatch")}
                </Link>
              </>
            )}
          </section>

          <section className="event-phases">
            <div className="event-phases__header">
              <span>{t("event.phases.kicker")}</span>

              <h2>{t("event.phases.title")}</h2>
            </div>

            <div className="event-phases__current">
              <span>{t("event.phases.current")}</span>

              <strong>
                {event.phase_info?.current
                  ? humanPhase(event.phase_info.current, t)
                  : t("event.phases.none")}
              </strong>
            </div>

            <div className="event-phases__list">
              {(event.phase_info?.available ?? []).map((phase) => (
                <Link
                  className="event-phases__item"
                  key={phase}
                  to={`/events/${slug}/matches?phase=${phase}`}
                >
                  <span>{humanPhase(phase, t)}</span>
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
