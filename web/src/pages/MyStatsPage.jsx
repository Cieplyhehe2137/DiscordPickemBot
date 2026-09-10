import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { getMyStats } from "../lib/api.js";
import socket from "../lib/socket.js";
import BackLink from "../components/BackLink.jsx";

const TABS = [
  { key: "general", label: "📊 Ogólne" },
  { key: "accuracy", label: "🎯 Skuteczność" },
  { key: "form", label: "🔥 Forma" },
  { key: "comparison", label: "👥 Porównanie" },
  { key: "analysis", label: "🧠 Analiza" },
  { key: "style", label: "🎭 Styl" },
  { key: "trends", label: "📈 Trendy" },
];

function pct(value, total) {
  if (!total) return "—";

  return `${((Number(value) / Number(total)) * 100)
    .toFixed(1)
    .replace(".0", "")}%`;
}

function MyStatsPage() {
  const { slug } = useParams();

  const [activeTab, setActiveTab] = useState("general");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadStats({ silent = false } = {}) {
      try {
        if (!silent) {
          setLoading(true);
        }

        setError("");

        const response = await getMyStats(slug);

        if (!cancelled) {
          setData(response);
        }
      } catch (err) {
        console.error("MY STATS LOAD ERROR:", err);

        if (!cancelled) {
          setError(err.message || "Nie udało się pobrać statystyk.");
        }
      } finally {
        if (!cancelled && !silent) {
          setLoading(false);
        }
      }
    }

    loadStats();

    function handleStatsUpdate(payload) {
      if (payload?.event_slug && payload.event_slug !== slug) {
        return;
      }

      loadStats({ silent: true });
    }

    socket.on("dashboard:refresh", handleStatsUpdate);

    return () => {
      cancelled = true;
      socket.off("dashboard:refresh", handleStatsUpdate);
    };
  }, [slug]);

  if (loading) {
    return (
      <main className="my-stats-page">
        <p>Ładowanie statystyk...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="my-stats-page">
        <BackLink to={`/events/${slug}`} />

        <p className="admin-feedback admin-feedback--error">{error}</p>
      </main>
    );
  }

  if (!data?.has_data) {
    return (
      <main className="my-stats-page">
        <BackLink to={`/events/${slug}`} />

        <div className="my-stats-empty">
          <span className="events-kicker">Twoje dane</span>

          <h1>
            Moje statystyki
            {data?.event?.name ? ` — ${data.event.name}` : ""}
          </h1>

          <p>Nie masz jeszcze typów meczowych w tym evencie.</p>
        </div>
      </main>
    );
  }

  const general = data.general;
  const accuracy = data.accuracy;
  const form = data.form;
  const comparison = data.comparison;
  const analysis = data.analysis;
  const style = data.style;
  const trends = data.trends;

  return (
    <main className="my-stats-page">
      <BackLink to={`/events/${slug}`} />
      <div className="my-stats-page__header">
        <span className="events-kicker">Twoje dane</span>

        <h1>Moje statystyki — {data.event.name}</h1>

        <p>Szczegółowe podsumowanie Twojego typowania w evencie.</p>
      </div>

      <div className="my-stats-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={
              activeTab === tab.key
                ? "my-stats-tab my-stats-tab--active"
                : "my-stats-tab"
            }
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "general" && (
        <section className="my-stats-grid">
          <article className="my-stat-card">
            <span>🏅 Ranking</span>
            <strong>
              {general.rank
                ? `#${general.rank} / ${general.participant_count}`
                : `— / ${general.participant_count}`}
            </strong>

            <small>
              {general.rank
                ? `TOP ${general.top_percent}%`
                : "brak jeszcze rozliczonych punktów"}
            </small>
          </article>

          <article className="my-stat-card">
            <span>⭐ Punkty</span>
            <strong>{general.total_points} pkt</strong>
            <small>{general.average_points} pkt / mecz</small>
          </article>

          <article className="my-stat-card">
            <span>🎭 Profil</span>
            <strong>
              {general.style?.emoji} {general.style?.name}
            </strong>
            <small>{general.trends?.direction?.name ?? "Stabilna forma"}</small>
          </article>

          <article className="my-stat-card">
            <span>🎮 Typy</span>
            <strong>{general.total_predictions}</strong>
            <small>Rozliczone: {general.settled_matches}</small>
          </article>

          <article className="my-stat-card">
            <span>🏆 Zwycięzcy</span>
            <strong>
              {general.winner_hits}/{general.settled_matches}
            </strong>
            <small>{pct(general.winner_hits, general.settled_matches)}</small>
          </article>

          <article className="my-stat-card">
            <span>🎯 Exact serii</span>
            <strong>
              {general.series_exacts}/{general.settled_matches}
            </strong>
            <small>{pct(general.series_exacts, general.settled_matches)}</small>
          </article>

          <article className="my-stat-card my-stat-card--wide">
            <span>🗺️ Mapy</span>
            <strong>
              Zwycięzca: {general.map_winner_hits}/{general.settled_maps}
            </strong>
            <small>
              Exact: {general.exact_maps}/{general.settled_maps}
            </small>
          </article>

          <article className="my-stat-card my-stat-card--wide">
            <span>📦 Punkty</span>
            <strong>Serie: {general.series_points} pkt</strong>
            <small>Mapy: {general.map_points} pkt</small>
          </article>
        </section>
      )}

      {activeTab === "accuracy" && (
        <section className="my-stats-grid">
          <article className="my-stat-card">
            <span>🏆 Zwycięzca meczu</span>
            <strong>
              {accuracy.winner_hits}/{accuracy.settled_matches}
            </strong>
            <small>{pct(accuracy.winner_hits, accuracy.settled_matches)}</small>
          </article>

          <article className="my-stat-card">
            <span>🎯 Exact serii</span>
            <strong>
              {accuracy.series_exacts}/{accuracy.settled_matches}
            </strong>
            <small>
              {pct(accuracy.series_exacts, accuracy.settled_matches)}
            </small>
          </article>

          <article className="my-stat-card">
            <span>🗺️ Zwycięzca mapy</span>
            <strong>
              {accuracy.map_winner_hits}/{accuracy.settled_maps}
            </strong>
            <small>
              {pct(accuracy.map_winner_hits, accuracy.settled_maps)}
            </small>
          </article>

          <article className="my-stat-card">
            <span>💯 Exact mapy</span>
            <strong>
              {accuracy.exact_maps}/{accuracy.settled_maps}
            </strong>
            <small>{pct(accuracy.exact_maps, accuracy.settled_maps)}</small>
          </article>

          {[1, 3, 5].map((bo) => {
            const stats = accuracy[`bo${bo}`];

            return (
              <article className="my-stat-card" key={bo}>
                <span>BO{bo}</span>

                <strong>
                  {stats.winnerHits}/{stats.total}
                </strong>

                <small>
                  Exact: {stats.exactHits}/{stats.total}
                </small>
              </article>
            );
          })}
        </section>
      )}

      {activeTab === "form" && (
        <section className="my-stats-grid">
          <article className="my-stat-card my-stat-card--wide">
            <span>📈 Ostatnie mecze</span>
            <strong>
              {form.recent?.length ? form.recent.join(" ") : "Brak danych"}
            </strong>
          </article>

          <article className="my-stat-card">
            <span>⚡ Ostatnie 5</span>
            <strong>
              {form.last5.hits}/{form.last5.total}
            </strong>
            <small>{form.last5.percentage}</small>
          </article>

          <article className="my-stat-card">
            <span>📊 Ostatnie 10</span>
            <strong>
              {form.last10.hits}/{form.last10.total}
            </strong>
            <small>{form.last10.percentage}</small>
          </article>

          <article className="my-stat-card">
            <span>🔥 Aktualna seria</span>
            <strong>{form.current_streak}</strong>
          </article>

          <article className="my-stat-card">
            <span>🏅 Rekordowa seria</span>
            <strong>{form.best_streak}</strong>
          </article>

          <article className="my-stat-card my-stat-card--wide">
            <span>💎 Najlepszy mecz</span>

            {form.best_match ? (
              <>
                <strong>
                  {form.best_match.match_no
                    ? `#${form.best_match.match_no} · `
                    : ""}
                  {form.best_match.team_a}
                  {" vs "}
                  {form.best_match.team_b}
                </strong>

                <small>{form.best_match.points} pkt</small>
              </>
            ) : (
              <strong>—</strong>
            )}
          </article>
        </section>
      )}

      {activeTab === "comparison" && (
        <section className="my-stats-grid">
          <article className="my-stat-card">
            <span>🏅 Ranking</span>
            <strong>
              {comparison.rank
                ? `#${comparison.rank} / ${comparison.participant_count}`
                : `— / ${comparison.participant_count}`}
            </strong>

            <small>
              {comparison.rank
                ? `TOP ${comparison.top_percent}%`
                : "brak jeszcze rozliczonych punktów"}
            </small>
          </article>

          <article className="my-stat-card">
            <span>⭐ Punkty</span>
            <strong>{comparison.user.total_points}</strong>
            <small>Średnia: {comparison.community.average_total_points}</small>
          </article>

          <article className="my-stat-card">
            <span>📈 Punkty / mecz</span>
            <strong>{comparison.user.average_points}</strong>
            <small>Średnia: {comparison.community.average_points}</small>
          </article>

          <article className="my-stat-card">
            <span>🏆 Zwycięzcy</span>
            <strong>{comparison.user.winner_accuracy.toFixed(1)}%</strong>
            <small>
              Event: {comparison.community.winner_accuracy.toFixed(1)}%
            </small>
          </article>

          <article className="my-stat-card">
            <span>🎯 Exact serii</span>
            <strong>{comparison.user.exact_accuracy.toFixed(1)}%</strong>
            <small>
              Event: {comparison.community.exact_accuracy.toFixed(1)}%
            </small>
          </article>
        </section>
      )}

      {activeTab === "analysis" && (
        <section className="my-stats-grid">
          <article className="my-stat-card">
            <span>🟢 Najlepiej typowana</span>
            <strong>{analysis.team_stats.best?.name ?? "—"}</strong>
          </article>

          <article className="my-stat-card">
            <span>😈 Nemesis</span>
            <strong>{analysis.team_stats.nemesis?.name ?? "—"}</strong>
          </article>

          <article className="my-stat-card">
            <span>❤️ Najczęściej wybierana</span>
            <strong>{analysis.team_stats.mostPicked?.name ?? "—"}</strong>
          </article>

          <article className="my-stat-card">
            <span>🔥 Najbardziej jednostronny</span>
            <strong>
              {analysis.community.mostOneSided?.majorityTeam ?? "—"}
            </strong>
          </article>

          <article className="my-stat-card">
            <span>⚔️ Najbardziej podzielony</span>
            <strong>
              {analysis.community.mostDivided?.teamA ?? "—"}
              {analysis.community.mostDivided ? " vs " : ""}
              {analysis.community.mostDivided?.teamB ?? ""}
            </strong>
          </article>

          <article className="my-stat-card">
            <span>🎯 Popularny wynik</span>
            <strong>{analysis.community.mostPopularScore?.score ?? "—"}</strong>
          </article>

          <article className="my-stat-card my-stat-card--wide">
            <span>🗺️ Dokładność map</span>
            <strong>
              Exact: {analysis.map_accuracy.exact}/{analysis.map_accuracy.total}
            </strong>
            <small>
              Średni błąd:{" "}
              {Number(analysis.map_accuracy.averageError ?? 0).toFixed(2)}
            </small>
          </article>
        </section>
      )}

      {activeTab === "style" && (
        <section className="my-stats-grid">
          <article className="my-stat-card my-stat-card--wide">
            <span>🎭 Twój profil</span>
            <strong>
              {style.profile.emoji} {style.profile.name}
            </strong>
            <small>{style.profile.description}</small>
          </article>

          <article className="my-stat-card">
            <span>💎 Przeciw większości</span>
            <strong>{style.contrarian.contrarianPicks}</strong>
            <small>Trafione: {style.contrarian.contrarianHits}</small>
          </article>

          <article className="my-stat-card">
            <span>👥 Z większością</span>
            <strong>{style.contrarian.majorityPicks}</strong>
            <small>Trafione: {style.contrarian.majorityHits}</small>
          </article>

          <article className="my-stat-card my-stat-card--wide">
            <span>💠 Najrzadszy trafiony pick</span>
            <strong>
              {style.contrarian.rarestHit
                ? `${style.contrarian.rarestHit.team} vs ${style.contrarian.rarestHit.opponent}`
                : "—"}
            </strong>
          </article>
        </section>
      )}

      {activeTab === "trends" && (
        <section className="my-stats-grid">
          {!trends.enoughData ? (
            <article className="my-stat-card my-stat-card--wide">
              <span>📈 Trendy</span>
              <strong>Za mało danych</strong>
              <small>Rozliczone mecze: {trends.totalMatches} / 4</small>
            </article>
          ) : (
            <>
              <article className="my-stat-card my-stat-card--wide">
                <span>{trends.direction.emoji} Kierunek</span>
                <strong>{trends.direction.name}</strong>
                <small>{trends.direction.description}</small>
              </article>

              <article className="my-stat-card">
                <span>🏆 Zwycięzcy</span>
                <strong>
                  {trends.first.winnerAccuracy.toFixed(1)}% →{" "}
                  {trends.second.winnerAccuracy.toFixed(1)}%
                </strong>
              </article>

              <article className="my-stat-card">
                <span>🎯 Exact serii</span>
                <strong>
                  {trends.first.seriesExactAccuracy.toFixed(1)}% →{" "}
                  {trends.second.seriesExactAccuracy.toFixed(1)}%
                </strong>
              </article>

              <article className="my-stat-card">
                <span>⭐ Punkty / mecz</span>
                <strong>
                  {trends.first.averagePoints.toFixed(2)}
                  {" → "}
                  {trends.second.averagePoints.toFixed(2)}
                </strong>
              </article>

              <article className="my-stat-card">
                <span>🗺️ Exact map</span>
                <strong>
                  {trends.first.mapExactAccuracy.toFixed(1)}% →{" "}
                  {trends.second.mapExactAccuracy.toFixed(1)}%
                </strong>
              </article>
            </>
          )}
        </section>
      )}
    </main>
  );
}

export default MyStatsPage;
