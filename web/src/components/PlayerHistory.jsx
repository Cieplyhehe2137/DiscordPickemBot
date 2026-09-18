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

// Naglowek domyslny mowi "poza tym turniejem", bo ten komponent powstal
// na profilu wewnatrz eventu. Profil ponad turniejami pokazuje TE SAMA
// liste jako tresc glowna, wiec podaje wlasny naglowek - wiersze, linki
// i sposob liczenia zostaja te same, bo to dokladnie te same starty.
const DOMYSLNY_NAGLOWEK = {
  kicker: "history.kicker",
  title: "history.title",
  // "{count} INNE turnieje" - slowo prawdziwe wylacznie wtedy, gdy jeden
  // turniej wlasnie sie oglada. Dlatego liczebnik tez jest do podmiany.
  count: "history.count",
  hint: "history.hint",
};

function PlayerHistory({ events, userId, headings }) {
  const t = useT();

  if (!events?.length) return null;

  const naglowek = headings ?? DOMYSLNY_NAGLOWEK;

  return (
    <section className="ui-card ui-stack">
      <div className="ui-section-head">
        <div>
          <span className="ui-kicker">{t(naglowek.kicker)}</span>

          <h2>{t(naglowek.title)}</h2>

          <p>
            {t(naglowek.count, { count: events.length })}
            {t(naglowek.hint)}
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
