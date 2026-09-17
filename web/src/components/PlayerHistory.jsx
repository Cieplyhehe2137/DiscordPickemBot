import { Link } from "react-router-dom";

import { useT } from "../i18n/useLanguage.js";

// Starty gracza w pozostałych turniejach.
//
// Profil jest w tym serwisie zawsze w obrębie jednego eventu i do tej pory
// nie dało się nigdzie zobaczyć, że ktoś grał w kilku.
//
// Sekcja nie pojawia się dla 85% graczy - tylu zagrało w dokładnie jednym
// turnieju. To nie jest stan pusty do zagospodarowania, tylko przypadek
// normalny: nie ma czego pokazać, więc nie ma sekcji.

function PlayerHistory({ events, userId }) {
  const t = useT();

  if (!events?.length) return null;

  return (
    <section className="ui-card ui-stack">
      <div className="ui-section-head">
        <div>
          <span className="ui-kicker">{t("history.kicker")}</span>

          <h2>{t("history.title")}</h2>

          <p>
            {t("history.count", { count: events.length })}
            {t("history.hint")}
          </p>
        </div>
      </div>

      <div className="ui-stack ui-stack--tight">
        {events.map((e) => (
          <Link
            className="history-row"
            key={e.event_id}
            to={`/events/${e.slug}/player/${userId}`}
          >
            <div className="history-row__main">
              <strong className="history-row__name">{e.name}</strong>

              <span className="ui-stat__hint">
                {e.rank === null ? (
                  t("history.unranked")
                ) : (
                  <>
                    {t("history.place", {
                      rank: e.rank,
                      total: e.participants,
                    })}
                    {e.top_percent !== null &&
                      ` · ${t("history.top", { percent: e.top_percent })}`}
                  </>
                )}
              </span>
            </div>

            <strong className="history-row__points">
              {t("common.points", { count: e.points })}
            </strong>
          </Link>
        ))}
      </div>
    </section>
  );
}

export default PlayerHistory;
